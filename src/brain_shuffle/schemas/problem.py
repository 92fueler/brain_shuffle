from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, field_validator


def normalize_company_name(name: str) -> str:
    cleaned = name.strip()
    if not cleaned:
        return ""
    # Capitalize the first letter of each word while preserving inner casing (e.g. ByteDance, OpenAI)
    return " ".join(
        w[0].upper() + w[1:] if len(w) > 1 else w.upper()
        for w in cleaned.split()
    )


def normalize_companies_list(companies: Optional[List[str]]) -> List[str]:
    if not companies:
        return []
    normalized: List[str] = []
    seen = set()
    for c in companies:
        if isinstance(c, str):
            norm = normalize_company_name(c)
            if norm and norm.lower() not in seen:
                seen.add(norm.lower())
                normalized.append(norm)
    return normalized


def clean_tags_list(tags: Optional[List[str]]) -> List[str]:
    if not tags:
        return []
    cleaned: List[str] = []
    seen = set()
    for t in tags:
        if isinstance(t, str):
            t_clean = t.strip()
            # Tags are preserved exactly the way user inputs
            if t_clean and t_clean not in seen:
                seen.add(t_clean)
                cleaned.append(t_clean)
    return cleaned


class ProblemBase(BaseModel):
    category_id: uuid.UUID
    title: str
    prompt: str
    notes: str
    tags: List[str] = []
    companies: List[str] = []
    cadence: str = "weekly"
    is_starred: bool = False

    @field_validator("companies", mode="before")
    @classmethod
    def validate_companies(cls, v: Optional[List[str]]) -> List[str]:
        return normalize_companies_list(v)

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> List[str]:
        return clean_tags_list(v)


class ProblemCreate(ProblemBase):
    pass


class ProblemUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    title: Optional[str] = None
    prompt: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    companies: Optional[List[str]] = None
    cadence: Optional[str] = None
    is_starred: Optional[bool] = None

    @field_validator("companies", mode="before")
    @classmethod
    def validate_companies(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        return normalize_companies_list(v)

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        return clean_tags_list(v)


class ProblemRead(ProblemBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    review_count: int
    retention_score: float
    cadence: str = "weekly"
    is_starred: bool = False
    last_reviewed_at: Optional[datetime] = None
    next_review_due: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ProblemReviewSubmission(BaseModel):
    rating: str  # drill_soon, intra_week, weekly, skip_park (also supports legacy again, hard, good, easy)
    time_spent_seconds: Optional[int] = None
    reflection: Optional[str] = None
