from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from brain_shuffle.db import get_session
from brain_shuffle.models.review_list import ReviewList, ReviewListProblemLink
from brain_shuffle.models.problem import Problem
from brain_shuffle.schemas.review_list import ReviewListCreate, ReviewListRead
from brain_shuffle.schemas.problem import ProblemRead

router = APIRouter(prefix="/review-lists", tags=["review-lists"])


@router.get("/", response_model=List[ReviewListRead])
def list_review_lists(session: Session = Depends(get_session)) -> List[ReviewListRead]:
    lists = session.exec(select(ReviewList).order_by(ReviewList.created_at.desc())).all()
    result = []
    for rl in lists:
        links = session.exec(
            select(ReviewListProblemLink).where(ReviewListProblemLink.review_list_id == rl.id)
        ).all()
        problem_ids = [l.problem_id for l in links]
        result.append(
            ReviewListRead(
                id=rl.id,
                name=rl.name,
                company=rl.company,
                description=rl.description,
                created_at=rl.created_at,
                problem_count=len(problem_ids),
                problem_ids=problem_ids,
                problems=[],
            )
        )
    return result


@router.post("/", response_model=ReviewListRead, status_code=status.HTTP_201_CREATED)
def create_review_list(payload: ReviewListCreate, session: Session = Depends(get_session)) -> ReviewListRead:
    rl = ReviewList(
        name=payload.name,
        company=payload.company,
        description=payload.description,
    )
    session.add(rl)
    session.commit()
    session.refresh(rl)

    # Link problems
    valid_problems = []
    for pid in payload.problem_ids:
        problem = session.get(Problem, pid)
        if problem:
            session.add(ReviewListProblemLink(review_list_id=rl.id, problem_id=pid))
            valid_problems.append(ProblemRead.model_validate(problem))

    session.commit()

    return ReviewListRead(
        id=rl.id,
        name=rl.name,
        company=rl.company,
        description=rl.description,
        created_at=rl.created_at,
        problem_count=len(valid_problems),
        problem_ids=[p.id for p in valid_problems],
        problems=valid_problems,
    )


@router.get("/{list_id}", response_model=ReviewListRead)
def get_review_list(list_id: uuid.UUID, session: Session = Depends(get_session)) -> ReviewListRead:
    rl = session.get(ReviewList, list_id)
    if not rl:
        raise HTTPException(status_code=404, detail="Review list not found")

    links = session.exec(
        select(ReviewListProblemLink).where(ReviewListProblemLink.review_list_id == rl.id)
    ).all()
    problem_ids = [l.problem_id for l in links]
    problems = []
    if problem_ids:
        problem_records = session.exec(select(Problem).where(Problem.id.in_(problem_ids))).all()
        problems = [ProblemRead.model_validate(p) for p in problem_records]

    return ReviewListRead(
        id=rl.id,
        name=rl.name,
        company=rl.company,
        description=rl.description,
        created_at=rl.created_at,
        problem_count=len(problems),
        problem_ids=problem_ids,
        problems=problems,
    )


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review_list(list_id: uuid.UUID, session: Session = Depends(get_session)) -> None:
    rl = session.get(ReviewList, list_id)
    if not rl:
        raise HTTPException(status_code=404, detail="Review list not found")

    session.delete(rl)
    session.commit()
