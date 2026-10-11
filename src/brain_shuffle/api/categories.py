from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from brain_shuffle.db import get_session
from brain_shuffle.models.category import Category
from brain_shuffle.schemas.category import CategoryCreate, CategoryRead

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=List[CategoryRead])
def list_categories(session: Session = Depends(get_session)) -> List[Category]:
    statement = select(Category).order_by(Category.name)
    return session.exec(statement).all()


@router.post("/", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, session: Session = Depends(get_session)) -> Category:
    existing = session.exec(select(Category).where(Category.slug == payload.slug)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category slug already exists")
    category = Category.model_validate(payload)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category
