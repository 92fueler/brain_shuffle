import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, func, select
from brain_shuffle.db import get_session
from brain_shuffle.models.category import Category
from brain_shuffle.models.problem import Problem
from brain_shuffle.models.subtext import Subtext
from brain_shuffle.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=List[CategoryRead])
def list_categories(session: Session = Depends(get_session)) -> List[Category]:
    statement = select(Category).order_by(Category.name)
    return session.exec(statement).all()


@router.post("/", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, session: Session = Depends(get_session)) -> Category:
    norm_slug = payload.slug.strip().lower()
    if not norm_slug:
        raise HTTPException(status_code=400, detail="Category slug cannot be empty")
    norm_name = payload.name.strip()
    if not norm_name:
        raise HTTPException(status_code=400, detail="Category name cannot be empty")

    existing = session.exec(select(Category).where(Category.slug == norm_slug)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category slug already exists")

    desc = payload.description.strip() if payload.description and payload.description.strip() else None
    category = Category(
        slug=norm_slug,
        name=norm_name,
        description=desc,
    )
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: uuid.UUID, session: Session = Depends(get_session)) -> Category:
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    session: Session = Depends(get_session),
) -> Category:
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "slug" in update_data:
        raw_slug = update_data["slug"]
        if not raw_slug or not raw_slug.strip():
            raise HTTPException(status_code=400, detail="Category slug cannot be empty")
        slug_val = raw_slug.strip().lower()
        existing = session.exec(
            select(Category).where(Category.slug == slug_val, Category.id != category_id)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Category slug already in use by another category")
        update_data["slug"] = slug_val

    if "name" in update_data:
        raw_name = update_data["name"]
        if not raw_name or not raw_name.strip():
            raise HTTPException(status_code=400, detail="Category name cannot be empty")
        update_data["name"] = raw_name.strip()

    if "description" in update_data:
        desc_val = update_data["description"]
        update_data["description"] = desc_val.strip() if desc_val and desc_val.strip() else None

    for key, val in update_data.items():
        setattr(category, key, val)

    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> None:
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Safety constraint: prevent deleting category with attached problems or subtexts
    problem_count = session.exec(
        select(func.count()).select_from(Problem).where(Problem.category_id == category_id)
    ).one()
    subtext_count = session.exec(
        select(func.count()).select_from(Subtext).where(Subtext.category_id == category_id)
    ).one()
    total_count = problem_count + subtext_count
    if total_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category '{category.name}' because it contains {total_count} entry/entries. Please reassign or delete them first.",
        )

    session.delete(category)
    session.commit()

