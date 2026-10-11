from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING, Optional
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from brain_shuffle.models.problem import Problem


class ReviewLog(SQLModel, table=True):
    __tablename__ = "review_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    problem_id: uuid.UUID = Field(foreign_key="problems.id", index=True)
    rating: str = Field(max_length=32, description="Rolling review action: drill_soon, intra_week, weekly, skip_park")
    time_spent_seconds: Optional[int] = Field(default=None)
    reflection: Optional[str] = Field(default=None)
    reviewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    problem: Optional["Problem"] = Relationship(back_populates="review_logs")
