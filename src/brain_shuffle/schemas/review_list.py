from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, field_validator
from brain_shuffle.schemas.problem import ProblemRead, normalize_company_name


class ReviewListBase(BaseModel):
    name: str
    company: Optional[str] = None
    description: Optional[str] = None

    @field_validator("company", mode="before")
    @classmethod
    def validate_company(cls, v: Optional[str]) -> Optional[str]:
        if not v or not isinstance(v, str):
            return None
        return normalize_company_name(v) or None


class ReviewListCreate(ReviewListBase):
    problem_ids: List[uuid.UUID] = []


class ReviewListUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    description: Optional[str] = None
    problem_ids: Optional[List[uuid.UUID]] = None

    @field_validator("company", mode="before")
    @classmethod
    def validate_company(cls, v: Optional[str]) -> Optional[str]:
        if not v or not isinstance(v, str):
            return None
        return normalize_company_name(v) or None


class ReviewListRead(ReviewListBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    problem_count: int = 0
    problem_ids: List[uuid.UUID] = []
    problems: List[ProblemRead] = []
