from datetime import datetime, timezone, timedelta
import random
from typing import List, Optional, Set
import uuid
from sqlmodel import Session, select
from brain_shuffle.models.problem import Problem
from brain_shuffle.models.review_log import ReviewLog
from brain_shuffle.models.review_list import ReviewListProblemLink


class ShuffleEngine:
    def __init__(self, session: Session):
        self.session = session

    def select_batch(
        self,
        category_id: Optional[uuid.UUID] = None,
        company: Optional[str] = None,
        review_list_id: Optional[uuid.UUID] = None,
        limit: int = 5,
        mode: str = "cadence",
        excluded_problem_ids: Optional[Set[uuid.UUID]] = None,
    ) -> List[Problem]:
        """Select a randomized or review-weighted batch of problems with company, category, and review list filtering."""
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

        # If pool is small (<= limit), return all problems shuffled
        if len(all_problems) <= limit:
            random.shuffle(all_problems)
            return all_problems

        # Recency protection: set aside problems from immediate prior rounds if pool is large enough
        candidate_pool = all_problems
        if excluded_problem_ids:
            filtered = [p for p in all_problems if p.id not in excluded_problem_ids]
            if len(filtered) >= limit:
                candidate_pool = filtered

        # Pure Random Mode
        if mode == "pure_random":
            return random.sample(candidate_pool, limit)

        # Dynamic Priority Mode: Additive Base + Review Urgency
        weights = [self._calculate_weight(p) for p in candidate_pool]

        # Weighted sampling without replacement
        selected: List[Problem] = []
        pool = list(zip(candidate_pool, weights))

        for _ in range(min(limit, len(pool))):
            total_weight = sum(w for _, w in pool)
            if total_weight <= 0:
                picked_idx = random.randrange(len(pool))
            else:
                r = random.uniform(0, total_weight)
                upto = 0.0
                picked_idx = 0
                for idx, (_, w) in enumerate(pool):
                    if upto + w >= r:
                        picked_idx = idx
                        break
                    upto += w
            picked_problem, _ = pool.pop(picked_idx)
            selected.append(picked_problem)

        return selected

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
