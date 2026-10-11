from fastapi.testclient import TestClient
from brain_shuffle.main import app
from brain_shuffle.models import Category, Problem, ReviewLog, ReviewList
from brain_shuffle.schemas import CategoryCreate, ProblemCreate, BackupPayload


def test_healthz_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_model_definitions() -> None:
    assert Category.__tablename__ == "categories"
    assert Problem.__tablename__ == "problems"
    assert ReviewLog.__tablename__ == "review_logs"
    assert ReviewList.__tablename__ == "review_lists"


def test_schema_validations() -> None:
    cat = CategoryCreate(slug="coding", name="Coding", description="Algorithms & Data Structures")
    assert cat.slug == "coding"

    prob = ProblemCreate(
        category_id="00000000-0000-0000-0000-000000000000",
        title="Two Sum",
        prompt="How to solve in O(N)?",
        notes="Hash map",
        tags=["hash-table"],
        companies=["Google"],
    )
    assert prob.title == "Two Sum"

    backup = BackupPayload(exported_at="2026-10-11T00:00:00Z", categories=[])
    assert backup.version in ("1.0", "2.0")
