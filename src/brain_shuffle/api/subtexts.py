from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from brain_shuffle.db import get_session
from brain_shuffle.models.subtext import Subtext, SubtextReviewLog
from brain_shuffle.schemas.subtext import (
    SubtextCreate,
    SubtextRead,
    SubtextReviewSubmission,
    SubtextUpdate,
)
from brain_shuffle.services.shuffle_engine import apply_review_action, resolve_cadence_schedule

router = APIRouter(prefix="/subtexts", tags=["subtexts"])


@router.get("/", response_model=List[SubtextRead])
def list_subtexts(
    category_id: Optional[uuid.UUID] = Query(None, description="Filter by category"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    search: Optional[str] = Query(None, description="Search in title, original_text, subtext, or tags"),
    session: Session = Depends(get_session),
) -> List[Subtext]:
    query = select(Subtext).order_by(Subtext.created_at.desc())
    if category_id:
        query = query.where(Subtext.category_id == category_id)

    items = list(session.exec(query).all())

    if tag:
        t_lower = tag.strip().lower()
        items = [i for i in items if any(t.lower() == t_lower for t in (i.tags or []))]

    if search:
        s = search.lower()
        items = [
            i for i in items
            if s in i.title.lower()
            or s in i.original_text.lower()
            or s in i.subtext.lower()
            or any(s in t.lower() for t in (i.tags or []))
        ]

    return items


@router.get("/shuffle", response_model=List[SubtextRead])
def get_subtext_shuffle_batch(
    category_id: Optional[uuid.UUID] = Query(None, description="Optional category filter"),
    tag: Optional[str] = Query(None, description="Optional tag filter"),
    limit: int = Query(5, ge=1, le=50, description="Number of entries to retrieve"),
    mode: Optional[str] = Query("cadence", description="Sampling mode: 'cadence' or 'pure_random'"),
    session: Session = Depends(get_session),
) -> List[Subtext]:
    """Retrieve a prioritized batch of subtexts based on rolling cadence and random weighting."""
    query = select(Subtext)
    if category_id:
        query = query.where(Subtext.category_id == category_id)

    items = list(session.exec(query).all())
    if tag:
        t_lower = tag.strip().lower()
        items = [i for i in items if any(t.lower() == t_lower for t in (i.tags or []))]

    if not items:
        return []

    import random

    if mode == "pure_random":
        random.shuffle(items)
        return items[:limit]

    now = datetime.now(timezone.utc)

    def sort_key(s: Subtext):
        if not s.last_reviewed_at:
            return (0, 0.0)
        due = s.next_review_due
        if due:
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            overdue_seconds = (now - due).total_seconds()
            return (1, -overdue_seconds)
        return (2, 0.0)

    items_sorted = sorted(items, key=sort_key)
    top_slice = items_sorted[: max(limit * 2, len(items_sorted))]
    random.shuffle(top_slice)
    return top_slice[:limit]


@router.post("/", response_model=SubtextRead, status_code=status.HTTP_201_CREATED)
def create_subtext(payload: SubtextCreate, session: Session = Depends(get_session)) -> Subtext:
    subtext = Subtext.model_validate(payload)
    now = datetime.now(timezone.utc)
    if subtext.cadence:
        subtext.cadence, subtext.next_review_due = resolve_cadence_schedule(subtext.cadence, now)
    else:
        subtext.cadence = "weekly"
        subtext.next_review_due = now + timedelta(hours=168.0)

    session.add(subtext)
    session.commit()
    session.refresh(subtext)
    return subtext


@router.get("/{subtext_id}", response_model=SubtextRead)
def get_subtext(subtext_id: uuid.UUID, session: Session = Depends(get_session)) -> Subtext:
    subtext = session.get(Subtext, subtext_id)
    if not subtext:
        raise HTTPException(status_code=404, detail="Subtext not found")
    return subtext


@router.put("/{subtext_id}", response_model=SubtextRead)
def update_subtext(
    subtext_id: uuid.UUID,
    payload: SubtextUpdate,
    session: Session = Depends(get_session),
) -> Subtext:
    subtext = session.get(Subtext, subtext_id)
    if not subtext:
        raise HTTPException(status_code=404, detail="Subtext not found")

    update_data = payload.model_dump(exclude_unset=True)
    now = datetime.now(timezone.utc)

    if "cadence" in update_data and update_data["cadence"] is not None:
        subtext.cadence, subtext.next_review_due = resolve_cadence_schedule(str(update_data["cadence"]), now)
        del update_data["cadence"]

    for key, val in update_data.items():
        setattr(subtext, key, val)

    subtext.updated_at = now
    session.add(subtext)
    session.commit()
    session.refresh(subtext)
    return subtext


@router.delete("/{subtext_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subtext(subtext_id: uuid.UUID, session: Session = Depends(get_session)) -> None:
    subtext = session.get(Subtext, subtext_id)
    if not subtext:
        raise HTTPException(status_code=404, detail="Subtext not found")
    session.delete(subtext)
    session.commit()


@router.post("/{subtext_id}/review", response_model=SubtextRead)
def submit_subtext_review(
    subtext_id: uuid.UUID,
    review: SubtextReviewSubmission,
    session: Session = Depends(get_session),
) -> Subtext:
    subtext = session.get(Subtext, subtext_id)
    if not subtext:
        raise HTTPException(status_code=404, detail="Subtext not found")

    now = datetime.now(timezone.utc)
    canonical_action = apply_review_action(subtext, review.rating, now)

    log = SubtextReviewLog(
        subtext_id=subtext.id,
        rating=canonical_action,
        time_spent_seconds=review.time_spent_seconds,
        reflection=review.reflection,
        reviewed_at=now,
    )
    session.add(log)
    session.add(subtext)
    session.commit()
    session.refresh(subtext)
    return subtext
