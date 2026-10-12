from collections import Counter
from datetime import datetime, timezone, timedelta
import random
from typing import List, Optional, Set, Tuple
import uuid
from sqlmodel import Session, select
from brain_shuffle.models.problem import Problem
from brain_shuffle.models.review_log import ReviewLog
from brain_shuffle.models.review_list import ReviewListProblemLink

CADENCE_SCHEDULE_MAP = {
    "daily": ("daily", 4.0),
    "drill_soon": ("daily", 4.0),
    "again": ("daily", 4.0),
    "intra_week": ("intra_week", 60.0),
    "mid_week": ("intra_week", 60.0),
    "hard": ("intra_week", 60.0),
    "weekly": ("weekly", 168.0),
    "next_week": ("weekly", 168.0),
    "good": ("weekly", 168.0),
    "monthly": ("monthly", 504.0),
    "skip_park": ("monthly", 504.0),
    "park": ("monthly", 504.0),
    "parked": ("monthly", 504.0),
    "easy": ("monthly", 504.0),
}


def resolve_cadence_schedule(
    cadence_str: Optional[str], base_time: Optional[datetime] = None
) -> Tuple[str, datetime]:
    """Normalizes cadence string and calculates rolling next_review_due timestamp."""
    now = base_time or datetime.now(timezone.utc)
    key = cadence_str.strip().lower() if cadence_str else "weekly"
    canonical_cadence, interval_hours = CADENCE_SCHEDULE_MAP.get(key, ("weekly", 168.0))
    next_due = now + timedelta(hours=interval_hours)
    return canonical_cadence, next_due


class ShuffleEngine:
    def __init__(self, session: Session):
        self.session = session

    @staticmethod
    def _get_topic_signature(problem: Problem) -> Tuple[Set[str], Set[str], str]:
        """Extracts normalized exact tags, word tokens, and category ID string."""
        exact_tags: Set[str] = set()
        tokens: Set[str] = set()
        if problem.tags:
            for t in problem.tags:
                if t and isinstance(t, str):
                    cleaned = t.strip().lower().replace("-", " ").replace("_", " ").replace("/", " ")
                    if cleaned:
                        exact_tags.add(cleaned)
                        for word in cleaned.split():
                            if len(word) > 2 and word not in ("and", "the", "for", "with"):
                                tokens.add(word)
        cat_id = str(problem.category_id)
        return exact_tags, tokens, cat_id

    @classmethod
    def _topic_overlap_score(
        cls,
        sig_a: Tuple[Set[str], Set[str], str],
        sig_b: Tuple[Set[str], Set[str], str],
    ) -> float:
        """Calculates topic collision penalty between two problems.
        
        Exact tag collisions receive the highest penalty (1000).
        Shared subtopic tokens (e.g. 'pointers') receive secondary penalties (250).
        Identical categories receive a domain tie-break penalty (50).
        """
        exact_a, tokens_a, cat_a = sig_a
        exact_b, tokens_b, cat_b = sig_b
        score = 0.0

        exact_overlap = len(exact_a.intersection(exact_b))
        if exact_overlap > 0:
            score += 1000.0 * exact_overlap
        elif exact_a and exact_b:
            token_overlap = len(tokens_a.intersection(tokens_b))
            if token_overlap > 0:
                score += 250.0 * token_overlap
        elif not exact_a and not exact_b:
            score += 400.0

        if cat_a == cat_b:
            score += 50.0

        return score

    @classmethod
    def _interleave_by_topic(
        cls,
        problems: List[Problem],
        initial_predecessor: Optional[Problem] = None,
    ) -> List[Problem]:
        """Arranges problems to prevent consecutive topic clustering using frequency-aware anti-clustering."""
        if len(problems) <= 1:
            return list(problems)

        signatures = {p.id: cls._get_topic_signature(p) for p in problems}

        def primary_topic_key(p: Problem) -> str:
            exact, _, cat = signatures[p.id]
            if exact:
                return sorted(list(exact))[0]
            return f"category:{cat}"

        remaining = list(problems)
        ordered: List[Problem] = []

        # If an initial predecessor is provided (e.g. last reviewed problem from prior round),
        # select a starting problem with minimal topic overlap with it
        if initial_predecessor:
            pred_sig = cls._get_topic_signature(initial_predecessor)
            overlaps = [cls._topic_overlap_score(signatures[p.id], pred_sig) for p in remaining]
            min_overlap = min(overlaps)
            best_starts = [p for p, ov in zip(remaining, overlaps) if abs(ov - min_overlap) < 1e-4]
            first = random.choice(best_starts)
            remaining.remove(first)
            ordered.append(first)
        else:
            # Pick from highest remaining topic frequency to prevent end-clustering
            topic_counts = Counter(primary_topic_key(p) for p in remaining)
            max_freq = max(topic_counts.values())
            top_candidates = [p for p in remaining if topic_counts[primary_topic_key(p)] == max_freq]
            first = random.choice(top_candidates)
            remaining.remove(first)
            ordered.append(first)

        while remaining:
            topic_counts = Counter(primary_topic_key(p) for p in remaining)
            candidates_eval = []

            for cand in remaining:
                cand_sig = signatures[cand.id]
                c1 = cls._topic_overlap_score(cand_sig, signatures[ordered[-1].id])
                c2 = cls._topic_overlap_score(cand_sig, signatures[ordered[-2].id]) if len(ordered) >= 2 else 0.0
                c3 = cls._topic_overlap_score(cand_sig, signatures[ordered[-3].id]) if len(ordered) >= 3 else 0.0
                overlap_penalty = c1 + 0.3 * c2 + 0.1 * c3

                # Prioritize placing topics with higher remaining counts to avoid end clustering
                rem_freq = topic_counts[primary_topic_key(cand)]
                urgency_score = overlap_penalty - 5.0 * rem_freq
                candidates_eval.append((overlap_penalty, urgency_score, cand))

            # Strictly minimize overlap penalty first
            min_overlap = min(item[0] for item in candidates_eval)
            min_overlap_candidates = [item for item in candidates_eval if abs(item[0] - min_overlap) < 1e-4]

            # Break ties by frequency urgency
            min_urgency = min(item[1] for item in min_overlap_candidates)
            best_candidates = [item[2] for item in min_overlap_candidates if abs(item[1] - min_urgency) < 1e-4]

            chosen = random.choice(best_candidates)
            remaining.remove(chosen)
            ordered.append(chosen)

        return ordered

    def select_batch(
        self,
        category_id: Optional[uuid.UUID] = None,
        company: Optional[str] = None,
        review_list_id: Optional[uuid.UUID] = None,
        limit: int = 5,
        mode: str = "cadence",
        excluded_problem_ids: Optional[Set[uuid.UUID]] = None,
    ) -> List[Problem]:
        """Select a randomized, topic-interleaved batch of problems with company, category, and review list filtering."""
        query = select(Problem)

        if category_id:
            query = query.where(Problem.category_id == category_id)

        all_problems = list(self.session.exec(query).all())

        # Filter by company if requested
        if company:
            company_lower = company.strip().lower()
            all_problems = [
                p for p in all_problems
                if any(c.lower() == company_lower for c in (p.companies or []))
            ]

        # Filter by review list if requested
        if review_list_id:
            links = self.session.exec(
                select(ReviewListProblemLink).where(ReviewListProblemLink.review_list_id == review_list_id)
            ).all()
            allowed_ids = {l.problem_id for l in links}
            all_problems = [p for p in all_problems if p.id in allowed_ids]

        if not all_problems:
            return []

        # Find initial predecessor for smooth inter-batch topic transitions
        initial_predecessor: Optional[Problem] = None
        if excluded_problem_ids:
            for p in all_problems:
                if p.id in excluded_problem_ids:
                    initial_predecessor = p
                    break

        # If pool is small (<= limit), return all problems topic-interleaved
        if len(all_problems) <= limit:
            return self._interleave_by_topic(all_problems, initial_predecessor)

        # Recency protection: set aside problems from immediate prior rounds if pool is large enough
        candidate_pool = all_problems
        if excluded_problem_ids:
            filtered = [p for p in all_problems if p.id not in excluded_problem_ids]
            if len(filtered) >= limit:
                candidate_pool = filtered

        signatures = {p.id: self._get_topic_signature(p) for p in candidate_pool}

        # Pure Random Mode with topic diversity
        if mode == "pure_random":
            selected: List[Problem] = []
            pool = list(candidate_pool)
            for _ in range(limit):
                if not pool:
                    break
                scores = []
                for p in pool:
                    overlap_sum = sum(
                        self._topic_overlap_score(signatures[p.id], signatures[s.id])
                        for s in selected
                    )
                    scores.append(overlap_sum)
                min_score = min(scores)
                best_cands = [p for p, sc in zip(pool, scores) if abs(sc - min_score) < 1e-4]
                chosen = random.choice(best_cands)
                pool.remove(chosen)
                selected.append(chosen)
            return self._interleave_by_topic(selected, initial_predecessor)

        # Dynamic Priority Mode: Additive Base + Review Urgency with Topic Diversity Discount
        base_weights = {p.id: self._calculate_weight(p) for p in candidate_pool}
        selected: List[Problem] = []
        pool = list(candidate_pool)

        for _ in range(min(limit, len(pool))):
            effective_weights = []
            for p in pool:
                w = base_weights[p.id]
                overlap_sum = sum(
                    self._topic_overlap_score(signatures[p.id], signatures[s.id])
                    for s in selected
                )
                discount = 1.0 + (overlap_sum / 250.0)
                effective_weights.append(max(0.01, w / discount))

            total_weight = sum(effective_weights)
            if total_weight <= 0:
                picked_idx = random.randrange(len(pool))
            else:
                r = random.uniform(0, total_weight)
                upto = 0.0
                picked_idx = 0
                for idx, ew in enumerate(effective_weights):
                    if upto + ew >= r:
                        picked_idx = idx
                        break
                    upto += ew
            chosen = pool.pop(picked_idx)
            selected.append(chosen)

        return self._interleave_by_topic(selected, initial_predecessor)

    def _calculate_weight(self, problem: Problem) -> float:
        """Rolling-based Additive Priority & Cadence Weight calculation.
        
        - Base weight is 1.0 (guarantees continuous random eligibility on the same day and future).
        - Newly added problems (never reviewed) receive high initial weight (+9.0) so they appear during initial session.
        - Rolling cooldown & overdue calculations:
          * If 'drill_soon' (daily): high immediate priority (+8.0) once rolling 4h cooldown passes.
          * If 'intra_week': protected by rolling cooldown; once in 48h-72h window, receives consolidation boost (+6.0).
          * If 'weekly': once elapsed >= 7 days, receives overdue escalation boost (+4.0 to +8.0).
          * If 'skip_park': deferred with minimal background weight (0.1) until 21 days elapse.
        """
        now = datetime.now(timezone.utc)
        base_weight = 1.0

        # Newly added problem: high initial weight so it appears throughout the day added
        if not problem.last_reviewed_at:
            return base_weight + 9.0

        # Rolling overdue check against problem.next_review_due
        next_due = problem.next_review_due
        if next_due:
            if next_due.tzinfo is None:
                next_due = next_due.replace(tzinfo=timezone.utc)
            if now < next_due:
                # Still within rolling cooldown period
                if problem.cadence == "daily":
                    return max(0.5, base_weight * 0.5)
                # Intra-week, weekly, and monthly are deferred during cooldown
                return 0.1
            else:
                # Overdue past rolling target window
                overdue_hours = (now - next_due).total_seconds() / 3600.0
                overdue_boost = min(8.0, (overdue_hours / 24.0) * 1.5)
                if problem.cadence == "daily":
                    cadence_boost = 8.0
                elif problem.cadence == "intra_week":
                    cadence_boost = 6.0
                else:
                    cadence_boost = 4.0
                return base_weight + cadence_boost + overdue_boost

        last_reviewed = problem.last_reviewed_at
        if last_reviewed.tzinfo is None:
            last_reviewed = last_reviewed.replace(tzinfo=timezone.utc)

        hours_elapsed = (now - last_reviewed).total_seconds() / 3600.0
        urgency_boost = 0.0
        if problem.retention_score < 1.0:
            urgency_boost += (1.0 - problem.retention_score) * 6.0

        if hours_elapsed > 24.0:
            days_over = (hours_elapsed - 24.0) / 24.0
            urgency_boost += min(5.0, days_over * 0.5)

        return float(base_weight + urgency_boost)

    def record_review(
        self,
        problem: Problem,
        rating: str,
        time_spent_seconds: Optional[int] = None,
        reflection: Optional[str] = None,
    ) -> Problem:
        """Update retention score, rolling cadence, and log review attempt based on intent."""
        now = datetime.now(timezone.utc)
        action = rating.strip().lower()

        # Intent-driven rolling action mapping
        if action in ("drill_soon", "again"):
            problem.cadence = "daily"
            problem.retention_score = max(0.5, problem.retention_score * 0.8)
            next_interval_hours = 4.0  # Rolling 4 hours (intra-day)
            canonical_action = "drill_soon"
        elif action in ("intra_week", "hard"):
            problem.cadence = "intra_week"
            problem.retention_score = min(2.5, max(1.0, problem.retention_score * 1.05))
            next_interval_hours = 60.0  # Rolling 2.5 days / 60h (intra-week consolidation window)
            canonical_action = "intra_week"
        elif action in ("weekly", "good"):
            problem.cadence = "weekly"
            problem.retention_score = min(3.5, problem.retention_score * 1.20)
            next_interval_hours = 168.0  # Rolling 7 days (weekly)
            canonical_action = "weekly"
        elif action in ("skip_park", "easy"):
            problem.cadence = "monthly"
            problem.retention_score = min(4.0, problem.retention_score * 1.10)
            next_interval_hours = 504.0  # Rolling 21 days (park / deferred)
            canonical_action = "skip_park"
        else:
            problem.cadence = "weekly"
            next_interval_hours = 168.0
            canonical_action = action

        problem.review_count += 1
        problem.last_reviewed_at = now
        problem.next_review_due = now + timedelta(hours=next_interval_hours)
        problem.updated_at = now

        log = ReviewLog(
            problem_id=problem.id,
            rating=canonical_action,
            time_spent_seconds=time_spent_seconds,
            reflection=reflection,
            reviewed_at=now,
        )
        self.session.add(log)
        self.session.add(problem)
        self.session.commit()
        self.session.refresh(problem)
        return problem
