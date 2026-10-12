import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool
from brain_shuffle.main import app
from brain_shuffle.db import get_session
from brain_shuffle.models.category import Category
from brain_shuffle.models.problem import Problem


@pytest.fixture(name="client")
def client_fixture():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(test_engine)

    def override_get_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_category_and_problem_lifecycle_with_companies(client: TestClient):
    # 1. Create category
    cat_res = client.post("/api/categories/", json={
        "slug": "coding",
        "name": "Coding",
        "description": "Coding questions"
    })
    assert cat_res.status_code == 201
    cat_data = cat_res.json()
    cat_id = cat_data["id"]

    # 2. Create problem with companies and tags
    prob_res = client.post("/api/problems/", json={
        "category_id": cat_id,
        "title": "Two Sum",
        "prompt": "How to find two numbers that sum to target in O(N)?",
        "notes": "Use a hash map to store seen complement.",
        "tags": ["hash-table"],
        "companies": ["Google", "Meta"]
    })
    assert prob_res.status_code == 201
    prob_data = prob_res.json()
    prob_id = prob_data["id"]
    assert prob_data["title"] == "Two Sum"
    assert "Google" in prob_data["companies"]

    # 3. Filter problems by company
    list_res = client.get("/api/problems/?company=Google")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 4. Companies breakdown API
    comp_res = client.get("/api/companies/")
    assert comp_res.status_code == 200
    companies = comp_res.json()
    assert any(c["name"] == "Google" and c["coding_count"] == 1 for c in companies)

    # 5. Create persistent Review List
    list_create = client.post("/api/review-lists/", json={
        "name": "Google Tech Prep",
        "company": "Google",
        "problem_ids": [prob_id]
    })
    assert list_create.status_code == 201
    review_list_data = list_create.json()
    assert review_list_data["problem_count"] == 1
    rl_id = review_list_data["id"]

    # 6. Shuffle by review_list_id
    shuffle_res = client.get(f"/api/shuffle/?review_list_id={rl_id}")
    assert shuffle_res.status_code == 200
    batch = shuffle_res.json()
    assert len(batch) == 1
    assert batch[0]["id"] == prob_id

    # 7. Review problem with rolling intent actions
    review_res = client.post(f"/api/problems/{prob_id}/review", json={
        "rating": "intra_week",
        "time_spent_seconds": 45,
        "reflection": "Consolidate mid-week."
    })
    assert review_res.status_code == 200
    reviewed_prob = review_res.json()
    assert reviewed_prob["review_count"] == 1
    assert reviewed_prob["cadence"] == "intra_week"
    assert reviewed_prob["next_review_due"] is not None

    review_drill = client.post(f"/api/problems/{prob_id}/review", json={
        "rating": "drill_soon"
    })
    assert review_drill.status_code == 200
    assert review_drill.json()["cadence"] == "daily"

    # 8. Backup export
    backup_res = client.get("/api/backup/export")
    assert backup_res.status_code == 200
    backup_payload = backup_res.json()
    assert len(backup_payload["categories"]) == 1
    assert len(backup_payload["review_lists"]) == 1
    assert backup_payload["review_lists"][0]["name"] == "Google Tech Prep"

    # 9. Delete problem with linked review list and review logs
    del_res = client.delete(f"/api/problems/{prob_id}")
    assert del_res.status_code == 204

    # Verify problem is deleted
    get_res = client.get(f"/api/problems/{prob_id}")
    assert get_res.status_code == 404


def test_company_normalization_and_tag_preservation(client: TestClient):
    cat_res = client.post("/api/categories/", json={
        "slug": "algorithms",
        "name": "Algorithms",
    })
    cat_id = cat_res.json()["id"]

    res = client.post("/api/problems/", json={
        "category_id": cat_id,
        "title": "Shortest Path in DAG",
        "prompt": "Explain topological sort relaxation.",
        "notes": "O(V + E) runtime.",
        "companies": ["google", "two sigma", "ByteDance", "amazon"],
        "tags": ["DAG", "topSort", "dynamicProgramming_101"]
    })
    assert res.status_code == 201
    data = res.json()

    # Companies capitalized first letter of each word
    assert data["companies"] == ["Google", "Two Sigma", "ByteDance", "Amazon"]

    # Tags preserved strictly as input
    assert data["tags"] == ["DAG", "topSort", "dynamicProgramming_101"]


def test_problem_update_endpoint(client: TestClient):
    cat1_res = client.post("/api/categories/", json={"slug": "cat1", "name": "Category 1"})
    cat2_res = client.post("/api/categories/", json={"slug": "cat2", "name": "Category 2"})
    cat1_id = cat1_res.json()["id"]
    cat2_id = cat2_res.json()["id"]

    create_res = client.post("/api/problems/", json={
        "category_id": cat1_id,
        "title": "Initial Title",
        "prompt": "Initial Prompt",
        "notes": "Initial Notes",
        "companies": ["meta"],
        "tags": ["initial-tag"]
    })
    prob_id = create_res.json()["id"]

    # Update title, category, prompt, notes, companies, tags
    update_res = client.put(f"/api/problems/{prob_id}", json={
        "category_id": cat2_id,
        "title": "Updated Title",
        "prompt": "Updated Prompt",
        "notes": "Updated Notes",
        "companies": ["meta", "apple"],
        "tags": ["updated-tag"]
    })
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["category_id"] == cat2_id
    assert updated_data["title"] == "Updated Title"
    assert updated_data["prompt"] == "Updated Prompt"
    assert updated_data["notes"] == "Updated Notes"
    assert updated_data["companies"] == ["Meta", "Apple"]
    assert updated_data["tags"] == ["updated-tag"]

    # Verify persistence via get
    get_res = client.get(f"/api/problems/{prob_id}")
    assert get_res.status_code == 200
    assert get_res.json()["category_id"] == cat2_id
    assert get_res.json()["title"] == "Updated Title"


def test_problem_cadence_update_and_scheduling(client: TestClient):
    cat_res = client.post("/api/categories/", json={
        "slug": "sysdesign-cadence",
        "name": "System Design Cadence",
    })
    cat_id = cat_res.json()["id"]

    prob_res = client.post("/api/problems/", json={
        "category_id": cat_id,
        "title": "Rate Limiter",
        "prompt": "Design a distributed rate limiter",
        "notes": "Token bucket algorithm",
    })
    prob_id = prob_res.json()["id"]

    # 1. Update to intra-day drill_soon
    drill_res = client.put(f"/api/problems/{prob_id}", json={
        "cadence": "daily"
    })
    assert drill_res.status_code == 200
    drill_data = drill_res.json()
    assert drill_data["cadence"] == "daily"
    assert drill_data["next_review_due"] is not None

    # 2. Update to park / monthly
    park_res = client.put(f"/api/problems/{prob_id}", json={
        "cadence": "monthly"
    })
    assert park_res.status_code == 200
    park_data = park_res.json()
    assert park_data["cadence"] == "monthly"
    assert park_data["next_review_due"] is not None


