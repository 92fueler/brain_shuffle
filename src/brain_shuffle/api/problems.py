from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from brain_shuffle.db import get_session
from brain_shuffle.models.problem import Problem
from brain_shuffle.schemas.problem import ProblemCreate, ProblemRead, ProblemReviewSubmission, ProblemUpdate
from brain_shuffle.services.shuffle_engine import ShuffleEngine, resolve_cadence_schedule

router = APIRouter(prefix="/problems", tags=["problems"])


@router.get("/", response_model=List[ProblemRead])
def list_problems(
    category_id: Optional[uuid.UUID] = Query(None, description="Filter by category"),
    company: Optional[str] = Query(None, description="Filter by company name"),
    search: Optional[str] = Query(None, description="Search by title, prompt, company, or tag"),
    session: Session = Depends(get_session),
) -> List[Problem]:
    query = select(Problem)
    if category_id:
        query = query.where(Problem.category_id == category_id)

    problems = list(session.exec(query).all())

    if company:
        c_lower = company.strip().lower()
        problems = [p for p in problems if any(c.lower() == c_lower for c in (p.companies or []))]

    if search:
        s = search.lower()
        problems = [
            p for p in problems
            if s in p.title.lower()
            or s in p.prompt.lower()
            or any(s in comp.lower() for comp in (p.companies or []))
            or any(s in tag.lower() for tag in (p.tags or []))
        ]

    return problems


@router.post("/", response_model=ProblemRead, status_code=status.HTTP_201_CREATED)
def create_problem(payload: ProblemCreate, session: Session = Depends(get_session)) -> Problem:
    problem = Problem.model_validate(payload)
    if problem.cadence:
        now = datetime.now(timezone.utc)
        problem.cadence, problem.next_review_due = resolve_cadence_schedule(problem.cadence, now)
    session.add(problem)
    session.commit()
    session.refresh(problem)
    return problem


@router.get("/{problem_id}", response_model=ProblemRead)
def get_problem(problem_id: uuid.UUID, session: Session = Depends(get_session)) -> Problem:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


@router.put("/{problem_id}", response_model=ProblemRead)
def update_problem(
    problem_id: uuid.UUID,
    payload: ProblemUpdate,
    session: Session = Depends(get_session),
) -> Problem:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    update_data = payload.model_dump(exclude_unset=True)

    now = datetime.now(timezone.utc)
    if "cadence" in update_data and update_data["cadence"] is not None:
        problem.cadence, problem.next_review_due = resolve_cadence_schedule(str(update_data["cadence"]), now)
        del update_data["cadence"]

    for key, val in update_data.items():
        setattr(problem, key, val)
    problem.updated_at = now
    session.add(problem)
    session.commit()
    session.refresh(problem)
    return problem


@router.delete("/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_problem(problem_id: uuid.UUID, session: Session = Depends(get_session)) -> None:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    session.delete(problem)
    session.commit()


@router.post("/{problem_id}/review", response_model=ProblemRead)
def submit_problem_review(
    problem_id: uuid.UUID,
    review: ProblemReviewSubmission,
    session: Session = Depends(get_session),
) -> Problem:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    engine = ShuffleEngine(session)
    updated_problem = engine.record_review(
        problem=problem,
        rating=review.rating,
        time_spent_seconds=review.time_spent_seconds,
        reflection=review.reflection,
    )
    return updated_problem
