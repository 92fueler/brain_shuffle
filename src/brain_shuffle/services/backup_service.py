from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import sqlite3
from typing import List, Optional, Dict, Any
from sqlmodel import Session, select
from brain_shuffle.models.category import Category
from brain_shuffle.models.problem import Problem
from brain_shuffle.models.review_log import ReviewLog
from brain_shuffle.models.review_list import ReviewList, ReviewListProblemLink
from brain_shuffle.models.subtext import Subtext, SubtextReviewLog
from brain_shuffle.schemas.backup import (
    BackupPayload,
    BackupCategory,
    BackupProblem,
    BackupSubtext,
    BackupReviewLog,
    BackupReviewList,
)


class BackupService:
    def __init__(self, session: Session):
        self.session = session

    def export_data(self) -> BackupPayload:
        """Export all categories, problems, reviews, and persistent review lists."""
        categories = self.session.exec(select(Category)).all()
        backup_categories: List[BackupCategory] = []

        for cat in categories:
            problems = self.session.exec(
                select(Problem).where(Problem.category_id == cat.id)
            ).all()
            backup_problems: List[BackupProblem] = []

            for prob in problems:
                logs = self.session.exec(
                    select(ReviewLog).where(ReviewLog.problem_id == prob.id)
                ).all()
                backup_logs = [
                    BackupReviewLog(
                        rating=log_item.rating,
                        time_spent_seconds=log_item.time_spent_seconds,
                        reflection=log_item.reflection,
                        reviewed_at=log_item.reviewed_at,
                    )
                    for log_item in logs
                ]
                backup_problems.append(
                    BackupProblem(
                        title=prob.title,
                        prompt=prob.prompt,
                        notes=prob.notes,
                        tags=prob.tags or [],
                        companies=prob.companies or [],
                        review_count=prob.review_count,
                        retention_score=prob.retention_score,
                        cadence=prob.cadence,
                        last_reviewed_at=prob.last_reviewed_at,
                        next_review_due=prob.next_review_due,
                        review_logs=backup_logs,
                    )
                )

            # Export subtexts
            subtexts = self.session.exec(
                select(Subtext).where(Subtext.category_id == cat.id)
            ).all()
            backup_subtexts: List[BackupSubtext] = []
            for sub in subtexts:
                sub_logs = self.session.exec(
                    select(SubtextReviewLog).where(SubtextReviewLog.subtext_id == sub.id)
                ).all()
                backup_sub_logs = [
                    BackupReviewLog(
                        rating=log_item.rating,
                        time_spent_seconds=log_item.time_spent_seconds,
                        reflection=log_item.reflection,
                        reviewed_at=log_item.reviewed_at,
                    )
                    for log_item in sub_logs
                ]
                backup_subtexts.append(
                    BackupSubtext(
                        title=sub.title,
                        original_text=sub.original_text,
                        subtext=sub.subtext,
                        tags=sub.tags or [],
                        cadence=sub.cadence,
                        review_count=sub.review_count,
                        retention_score=sub.retention_score,
                        last_reviewed_at=sub.last_reviewed_at,
                        next_review_due=sub.next_review_due,
                        review_logs=backup_sub_logs,
                    )
                )

            backup_categories.append(
                BackupCategory(
                    slug=cat.slug,
                    name=cat.name,
                    description=cat.description,
                    problems=backup_problems,
                    subtexts=backup_subtexts,
                )
            )

        # Export review lists
        review_lists = self.session.exec(select(ReviewList)).all()
        backup_lists: List[BackupReviewList] = []
        for rl in review_lists:
            links = self.session.exec(
                select(ReviewListProblemLink).where(ReviewListProblemLink.review_list_id == rl.id)
            ).all()
            problem_titles = []
            for link in links:
                prob = self.session.get(Problem, link.problem_id)
                if prob:
                    problem_titles.append(prob.title)
            backup_lists.append(
                BackupReviewList(
                    name=rl.name,
                    company=rl.company,
                    description=rl.description,
                    problem_titles=problem_titles,
                )
            )

        return BackupPayload(
            version="2.0",
            exported_at=datetime.now(timezone.utc),
            categories=backup_categories,
            review_lists=backup_lists,
        )

    def import_data(self, payload: BackupPayload) -> int:
        """Restore categories, problems, and review lists from payload into database."""
        imported_problems_count = 0
        problem_title_to_id = {}

        for cat_data in payload.categories:
            cat = self.session.exec(
                select(Category).where(Category.slug == cat_data.slug)
            ).first()
            if not cat:
                cat = Category(
                    slug=cat_data.slug,
                    name=cat_data.name,
                    description=cat_data.description,
                )
                self.session.add(cat)
                self.session.commit()
                self.session.refresh(cat)

            for prob_data in cat_data.problems:
                problem = self.session.exec(
                    select(Problem)
                    .where(Problem.category_id == cat.id)
                    .where(Problem.title == prob_data.title)
                ).first()

                if not problem:
                    problem = Problem(
                        category_id=cat.id,
                        title=prob_data.title,
                        prompt=prob_data.prompt,
                        notes=prob_data.notes,
                        tags=prob_data.tags,
                        companies=prob_data.companies,
                        review_count=prob_data.review_count,
                        retention_score=prob_data.retention_score,
                        cadence=getattr(prob_data, "cadence", "weekly") or "weekly",
                        last_reviewed_at=prob_data.last_reviewed_at,
                        next_review_due=prob_data.next_review_due,
                    )
                    self.session.add(problem)
                    self.session.commit()
                    self.session.refresh(problem)
                else:
                    problem.prompt = prob_data.prompt
                    problem.notes = prob_data.notes
                    problem.tags = prob_data.tags
                    problem.companies = prob_data.companies
                    problem.review_count = prob_data.review_count
                    problem.retention_score = prob_data.retention_score
                    if getattr(prob_data, "cadence", None):
                        problem.cadence = prob_data.cadence
                    problem.last_reviewed_at = prob_data.last_reviewed_at
                    problem.next_review_due = prob_data.next_review_due
                    self.session.add(problem)
                    self.session.commit()

                problem_title_to_id[problem.title] = problem.id

                # Restore logs idempotently (avoid duplicate logs on repeat imports)
                existing_log_dates = {
                    log_item.reviewed_at
                    for log_item in self.session.exec(
                        select(ReviewLog).where(ReviewLog.problem_id == problem.id)
                    ).all()
                }
                for log_data in prob_data.review_logs:
                    if log_data.reviewed_at not in existing_log_dates:
                        log = ReviewLog(
                            problem_id=problem.id,
                            rating=log_data.rating,
                            time_spent_seconds=log_data.time_spent_seconds,
                            reflection=log_data.reflection,
                            reviewed_at=log_data.reviewed_at,
                        )
                        self.session.add(log)
                        existing_log_dates.add(log_data.reviewed_at)

                imported_problems_count += 1

            for sub_data in getattr(cat_data, "subtexts", []):
                subtext = self.session.exec(
                    select(Subtext)
                    .where(Subtext.category_id == cat.id)
                    .where(Subtext.title == sub_data.title)
                ).first()

                if not subtext:
                    subtext = Subtext(
                        category_id=cat.id,
                        title=sub_data.title,
                        original_text=sub_data.original_text,
                        subtext=sub_data.subtext,
                        tags=sub_data.tags,
                        cadence=getattr(sub_data, "cadence", "weekly") or "weekly",
                        review_count=sub_data.review_count,
                        retention_score=sub_data.retention_score,
                        last_reviewed_at=sub_data.last_reviewed_at,
                        next_review_due=sub_data.next_review_due,
                    )
                    self.session.add(subtext)
                    self.session.commit()
                    self.session.refresh(subtext)
                else:
                    subtext.original_text = sub_data.original_text
                    subtext.subtext = sub_data.subtext
                    subtext.tags = sub_data.tags
                    if getattr(sub_data, "cadence", None):
                        subtext.cadence = sub_data.cadence
                    subtext.review_count = sub_data.review_count
                    subtext.retention_score = sub_data.retention_score
                    subtext.last_reviewed_at = sub_data.last_reviewed_at
                    subtext.next_review_due = sub_data.next_review_due
                    self.session.add(subtext)
                    self.session.commit()

                # Restore subtext logs idempotently
                existing_sub_log_dates = {
                    log_item.reviewed_at
                    for log_item in self.session.exec(
                        select(SubtextReviewLog).where(SubtextReviewLog.subtext_id == subtext.id)
                    ).all()
                }
                for log_data in sub_data.review_logs:
                    if log_data.reviewed_at not in existing_sub_log_dates:
                        sub_log = SubtextReviewLog(
                            subtext_id=subtext.id,
                            rating=log_data.rating,
                            time_spent_seconds=log_data.time_spent_seconds,
                            reflection=log_data.reflection,
                            reviewed_at=log_data.reviewed_at,
                        )
                        self.session.add(sub_log)
                        existing_sub_log_dates.add(log_data.reviewed_at)

        # Restore review lists
        for rl_data in getattr(payload, "review_lists", []):
            rl = self.session.exec(
                select(ReviewList).where(ReviewList.name == rl_data.name)
            ).first()
            if not rl:
                rl = ReviewList(
                    name=rl_data.name,
                    company=rl_data.company,
                    description=rl_data.description,
                )
                self.session.add(rl)
                self.session.commit()
                self.session.refresh(rl)

            # Link problems
            for title in rl_data.problem_titles:
                p_id = problem_title_to_id.get(title)
                if p_id:
                    existing_link = self.session.exec(
                        select(ReviewListProblemLink)
                        .where(ReviewListProblemLink.review_list_id == rl.id)
                        .where(ReviewListProblemLink.problem_id == p_id)
                    ).first()
                    if not existing_link:
                        self.session.add(ReviewListProblemLink(review_list_id=rl.id, problem_id=p_id))

        self.session.commit()
        return imported_problems_count

    def dump_to_file(self, destination: Path) -> Path:
        """Serialize data to JSON file on disk."""
        payload = self.export_data()
        destination.parent.mkdir(parents=True, exist_ok=True)
        with open(destination, "w", encoding="utf-8") as f:
            f.write(payload.model_dump_json(indent=2))
        return destination

    def load_from_file(self, source: Path) -> int:
        """Load serialized data from JSON file on disk."""
        with open(source, "r", encoding="utf-8") as f:
            content = json.load(f)
        payload = BackupPayload.model_validate(content)
        return self.import_data(payload)

    @staticmethod
    def get_canonical_snapshot_path() -> Path:
        return Path("./data/backups/brain_shuffle_snapshot.db")

    @staticmethod
    def get_live_db_path() -> Path:
        return Path("./data/brain_shuffle.db")

    def create_sqlite_snapshot(self, target_path: Optional[Path] = None) -> Path:
        """Create a defragmented, standalone SQLite binary snapshot using VACUUM INTO."""
        if target_path is None:
            target_path = self.get_canonical_snapshot_path()

        target_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_target = target_path.with_suffix(".tmp")
        if tmp_target.exists():
            tmp_target.unlink()

        live_db = self.get_live_db_path()
        if not live_db.exists():
            self.session.commit()

        # Execute online VACUUM INTO to staging file
        with sqlite3.connect(live_db) as conn:
            conn.execute(f"VACUUM INTO '{tmp_target.resolve()}'")

        shutil.move(str(tmp_target), str(target_path))
        return target_path

    def restore_sqlite_snapshot(self, source_path: Optional[Path] = None) -> int:
        """Atomically restore the live SQLite database from a canonical binary snapshot."""
        if source_path is None:
            source_path = self.get_canonical_snapshot_path()

        if not source_path.exists():
            raise FileNotFoundError(f"Snapshot file not found at {source_path}")

        # Integrity verification
        with sqlite3.connect(source_path) as chk_conn:
            res = chk_conn.execute("PRAGMA integrity_check").fetchone()
            if not res or res[0] != "ok":
                raise ValueError("Corrupt snapshot file: failed integrity_check")
            count = chk_conn.execute("SELECT count(*) FROM problems").fetchone()[0]

        live_db = self.get_live_db_path()
        rollback_bak = live_db.with_suffix(".rollback.bak")

        # Dispose connection pool to release locked file handles
        from brain_shuffle.db import engine
        engine.dispose()

        if live_db.exists():
            shutil.copyfile(live_db, rollback_bak)

        try:
            shutil.copyfile(source_path, live_db)
            if rollback_bak.exists():
                rollback_bak.unlink()
        except Exception:
            if rollback_bak.exists():
                shutil.copyfile(rollback_bak, live_db)
            raise

        return count

    def get_snapshot_status(self, snapshot_path: Optional[Path] = None) -> Dict[str, Any]:
        """Query existence, size, last modification time, and problem count of snapshot."""
        if snapshot_path is None:
            snapshot_path = self.get_canonical_snapshot_path()

        if not snapshot_path.exists():
            return {
                "exists": False,
                "file_path": str(snapshot_path),
                "size_bytes": 0,
                "last_modified": None,
                "problem_count": 0,
            }

        stat = snapshot_path.stat()
        mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
        size_bytes = stat.st_size

        problem_count = 0
        try:
            with sqlite3.connect(snapshot_path) as conn:
                cur = conn.execute("SELECT count(*) FROM problems")
                problem_count = cur.fetchone()[0]
        except Exception:
            pass

        return {
            "exists": True,
            "file_path": str(snapshot_path),
            "size_bytes": size_bytes,
            "last_modified": mtime,
            "problem_count": problem_count,
        }
