from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from brain_shuffle.db import get_session
from brain_shuffle.models.problem import Problem
from brain_shuffle.schemas.problem import ProblemRead
from brain_shuffle.services.shuffle_engine import ShuffleEngine

router = APIRouter(prefix="/shuffle", tags=["shuffle"])


@router.get("/", response_model=List[ProblemRead])
def get_shuffle_batch(
    category_id: Optional[uuid.UUID] = Query(None, description="Optional category filter"),
    company: Optional[str] = Query(None, description="Optional company filter e.g. Google, Meta"),
    review_list_id: Optional[uuid.UUID] = Query(None, description="Optional persistent review list ID"),
    limit: int = Query(5, ge=1, le=50, description="Number of problems to retrieve"),
    mode: str = Query("cadence", description="Mode: 'cadence' (weighted by urgency) or 'pure_random'"),
    exclude_ids: Optional[List[uuid.UUID]] = Query(None, description="Problem IDs to put aside for immediate round"),
    session: Session = Depends(get_session),
) -> List[Problem]:
    """Retrieve a randomized or priority-weighted problem batch for active recall testing."""
    engine = ShuffleEngine(session)
    excluded_set = set(exclude_ids) if exclude_ids else None
    return engine.select_batch(
        category_id=category_id,
        company=company,
        review_list_id=review_list_id,
        limit=limit,
        mode=mode,
        excluded_problem_ids=excluded_set,
    )
