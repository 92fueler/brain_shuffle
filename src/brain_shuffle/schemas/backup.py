from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class BackupReviewLog(BaseModel):
    rating: str
    time_spent_seconds: Optional[int] = None
    reflection: Optional[str] = None
    reviewed_at: datetime


class BackupProblem(BaseModel):
    title: str
    prompt: str
    notes: str
    tags: List[str] = []
    companies: List[str] = []
    review_count: int = 0
    retention_score: float = 1.0
    cadence: str = "weekly"
    last_reviewed_at: Optional[datetime] = None
    next_review_due: Optional[datetime] = None
    review_logs: List[BackupReviewLog] = []


class BackupCategory(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    problems: List[BackupProblem] = []


class BackupReviewList(BaseModel):
    name: str
    company: Optional[str] = None
    description: Optional[str] = None
    problem_titles: List[str] = []


class BackupPayload(BaseModel):
    version: str = "2.0"
    exported_at: datetime
    categories: List[BackupCategory]
    review_lists: List[BackupReviewList] = []
