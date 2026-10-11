from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from brain_shuffle.db import get_session
from brain_shuffle.models.problem import Problem
from brain_shuffle.models.category import Category
from brain_shuffle.schemas.problem import normalize_company_name

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/", response_model=List[Dict[str, Any]])
def list_companies(session: Session = Depends(get_session)) -> List[Dict[str, Any]]:
    """List all companies associated with problems, along with breakdown by category."""
    problems = session.exec(select(Problem)).all()
    categories = {c.id: c.slug for c in session.exec(select(Category)).all()}

    company_stats: Dict[str, Dict[str, Any]] = {}

    for p in problems:
        cat_slug = categories.get(p.category_id, "other")
        for comp in (p.companies or []):
            comp_norm = normalize_company_name(comp)
            if not comp_norm:
                continue
            key = comp_norm.lower()
            if key not in company_stats:
                company_stats[key] = {
                    "name": comp_norm,
                    "problem_count": 0,
                    "coding_count": 0,
                    "system_design_count": 0,
                    "other_count": 0,
                }
            company_stats[key]["problem_count"] += 1
            if cat_slug == "coding":
                company_stats[key]["coding_count"] += 1
            elif cat_slug in ("system_design", "system-design"):
                company_stats[key]["system_design_count"] += 1
            else:
                company_stats[key]["other_count"] += 1

    return sorted(company_stats.values(), key=lambda x: x["problem_count"], reverse=True)
