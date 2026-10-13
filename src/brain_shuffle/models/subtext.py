from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Column, Field, JSON, Relationship, SQLModel, Text

if TYPE_CHECKING:
    from brain_shuffle.models.category import Category


class Subtext(SQLModel, table=True):
    __tablename__ = "subtexts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    category_id: uuid.UUID = Field(foreign_key="categories.id", index=True)

    # Core content fields
    title: str = Field(
        max_length=256,
        index=True,
        description="Headline, key phrase, topic, or semantic cluster anchor",
    )
    original_text: str = Field(
        sa_column=Column(Text, nullable=False),
        description="Verbatim long paragraph, dialogue transcript, or example sentence collection",
    )
    subtext: str = Field(
        sa_column=Column(Text, nullable=False),
        description="Underlying meaning, unstated intention, definition, translation, or nuance matrix",
    )

    # Classification and tags
    tags: List[str] = Field(
        default_factory=list,
        sa_column=Column(JSON),
        description="Domain tags (e.g. cinema, idioms, conversations, politics, personality)",
    )

    # Spaced repetition & cadence
    cadence: str = Field(
        default="weekly",
        description="Target rolling cadence: daily, intra_week, weekly, monthly",
    )
    review_count: int = Field(default=0)
    retention_score: float = Field(default=1.0)
    last_reviewed_at: Optional[datetime] = Field(default=None)
    next_review_due: Optional[datetime] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    category: Optional["Category"] = Relationship(back_populates="subtexts")
    review_logs: List["SubtextReviewLog"] = Relationship(
        back_populates="subtext",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class SubtextReviewLog(SQLModel, table=True):
    __tablename__ = "subtext_review_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    subtext_id: uuid.UUID = Field(foreign_key="subtexts.id", index=True)
    rating: str = Field(
        max_length=32,
        description="Rolling review action: drill_soon, intra_week, weekly, skip_park",
    )
    time_spent_seconds: Optional[int] = Field(default=None)
    reflection: Optional[str] = Field(default=None)
    reviewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    subtext: Optional[Subtext] = Relationship(back_populates="review_logs")
