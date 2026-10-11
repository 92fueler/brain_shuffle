from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from brain_shuffle.models.problem import Problem


class ReviewListProblemLink(SQLModel, table=True):
    __tablename__ = "review_list_problems"

    review_list_id: uuid.UUID = Field(foreign_key="review_lists.id", primary_key=True)
    problem_id: uuid.UUID = Field(foreign_key="problems.id", primary_key=True)

    review_list: Optional["ReviewList"] = Relationship(back_populates="problem_links")
    problem: Optional["Problem"] = Relationship(back_populates="review_list_links")


class ReviewList(SQLModel, table=True):
    __tablename__ = "review_lists"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=128, index=True)
    company: Optional[str] = Field(default=None, max_length=64, index=True)
    description: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    problem_links: List[ReviewListProblemLink] = Relationship(
        back_populates="review_list",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
