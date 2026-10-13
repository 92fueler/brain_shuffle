from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, field_validator
from brain_shuffle.schemas.problem import clean_tags_list


class SubtextBase(BaseModel):
    category_id: uuid.UUID
    title: str
    original_text: str
    subtext: str
    tags: List[str] = []
    cadence: str = "weekly"

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> List[str]:
        return clean_tags_list(v)


class SubtextCreate(SubtextBase):
    pass


class SubtextUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    title: Optional[str] = None
    original_text: Optional[str] = None
    subtext: Optional[str] = None
    tags: Optional[List[str]] = None
    cadence: Optional[str] = None

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        return clean_tags_list(v)


class SubtextRead(SubtextBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    review_count: int
    retention_score: float
    cadence: str = "weekly"
    last_reviewed_at: Optional[datetime] = None
    next_review_due: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SubtextReviewSubmission(BaseModel):
    rating: str  # drill_soon, intra_week, weekly, skip_park
    time_spent_seconds: Optional[int] = None
    reflection: Optional[str] = None
