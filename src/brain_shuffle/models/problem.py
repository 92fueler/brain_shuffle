from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Column, Field, JSON, Relationship, SQLModel

if TYPE_CHECKING:
    from brain_shuffle.models.category import Category
    from brain_shuffle.models.review_log import ReviewLog
    from brain_shuffle.models.review_list import ReviewListProblemLink


class Problem(SQLModel, table=True):
    __tablename__ = "problems"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    category_id: uuid.UUID = Field(foreign_key="categories.id", index=True)
    title: str = Field(max_length=256, index=True, description="Problem title")
    prompt: str = Field(description="Active recall prompt/question displayed during shuffle")
    notes: str = Field(description="Detailed notes/solution hidden until user reveals")
    tags: List[str] = Field(default_factory=list, sa_column=Column(JSON), description="Subtopic tags e.g. dp, two-pointers, attention")
    companies: List[str] = Field(default_factory=list, sa_column=Column(JSON), description="Associated companies e.g. Google, Meta")
    review_count: int = Field(default=0)
    retention_score: float = Field(default=1.0)
    cadence: str = Field(default="weekly", description="Target rolling cadence: daily, intra_week, weekly, monthly")
    last_reviewed_at: Optional[datetime] = Field(default=None)
    next_review_due: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    category: Optional["Category"] = Relationship(back_populates="problems")
    review_logs: List["ReviewLog"] = Relationship(
        back_populates="problem",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    review_list_links: List["ReviewListProblemLink"] = Relationship(
        back_populates="problem",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
