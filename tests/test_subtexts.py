import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool
from brain_shuffle.main import app
from brain_shuffle.db import get_session


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


def test_subtext_crud_and_review_lifecycle(client: TestClient):
    # 1. Create a category
    cat_res = client.post("/api/categories/", json={
        "slug": "idioms",
        "name": "Idioms & Expressions",
        "description": "Figurative expressions and idioms"
    })
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    # 2. Create subtext entry with long context paragraph
    long_paragraph = (
        "With quarterly revenues declining and cash reserves dwindling after three consecutive "
        "quarters of negative cash flows, the executive board realized they could no longer kick "
        "the can down the road and had to bite the bullet by instituting immediate cost controls."
    )
    subtext_payload = {
        "category_id": cat_id,
        "title": "Bite the bullet",
        "original_text": long_paragraph,
        "subtext": (
            "Literal origin: biting a lead bullet to withstand battlefield surgery without anesthesia.\n"
            "Figurative meaning: to accept an inevitable, painful, but unavoidable decision with courage."
        ),
        "tags": ["idiom", "business", "courage"],
        "cadence": "weekly"
    }

    create_res = client.post("/api/subtexts/", json=subtext_payload)
    assert create_res.status_code == 201
    subtext_data = create_res.json()
    subtext_id = subtext_data["id"]
    assert subtext_data["title"] == "Bite the bullet"
    assert subtext_data["original_text"] == long_paragraph
    assert "Literal origin" in subtext_data["subtext"]
    assert subtext_data["cadence"] == "weekly"
    assert subtext_data["review_count"] == 0
    assert subtext_data["next_review_due"] is not None

    # 3. List and filter subtexts
    list_res = client.get(f"/api/subtexts/?category_id={cat_id}")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 1
    assert items[0]["id"] == subtext_id

    # Filter by tag
    tag_res = client.get("/api/subtexts/?tag=business")
    assert tag_res.status_code == 200
    assert len(tag_res.json()) == 1

    # Filter by search term
    search_res = client.get("/api/subtexts/?search=battlefield")
    assert search_res.status_code == 200
    assert len(search_res.json()) == 1

    # 4. Fetch single subtext
    get_res = client.get(f"/api/subtexts/{subtext_id}")
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Bite the bullet"

    # 5. Update subtext
    update_res = client.put(f"/api/subtexts/{subtext_id}", json={
        "title": "Bite the bullet (Updated)",
        "tags": ["idiom", "leadership"]
    })
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Bite the bullet (Updated)"
    assert "leadership" in update_res.json()["tags"]

    # 6. Submit review (Drill Soon)
    review_res = client.post(f"/api/subtexts/{subtext_id}/review", json={
        "rating": "drill_soon",
        "time_spent_seconds": 15,
        "reflection": "Remember military origin"
    })
    assert review_res.status_code == 200
    reviewed_data = review_res.json()
    assert reviewed_data["review_count"] == 1
    assert reviewed_data["cadence"] == "daily"
    assert reviewed_data["last_reviewed_at"] is not None

    # 7. Delete subtext
    del_res = client.delete(f"/api/subtexts/{subtext_id}")
    assert del_res.status_code == 204

    # Verify 404
    get_after_del = client.get(f"/api/subtexts/{subtext_id}")
    assert get_after_del.status_code == 404


def test_subtext_shuffle_modes(client: TestClient):
    cat_res = client.post("/api/categories/", json={
        "slug": "cinema",
        "name": "Cinema & Dialogue",
        "description": "Movie dialogue and conversational subtexts"
    })
    cat_id = cat_res.json()["id"]

    for i in range(3):
        client.post("/api/subtexts/", json={
            "category_id": cat_id,
            "title": f"Quote {i}",
            "original_text": f"Surface text line {i}",
            "subtext": f"Decoded underlying meaning {i}",
            "cadence": "weekly"
        })

    # Test default cadence mode
    shuffle_cadence = client.get(f"/api/subtexts/shuffle?category_id={cat_id}&limit=2&mode=cadence")
    assert shuffle_cadence.status_code == 200
    assert len(shuffle_cadence.json()) == 2

    # Test pure_random mode
    shuffle_random = client.get(f"/api/subtexts/shuffle?category_id={cat_id}&limit=3&mode=pure_random")
    assert shuffle_random.status_code == 200
    assert len(shuffle_random.json()) == 3


def test_subtext_backup_roundtrip(client: TestClient):
    cat_res = client.post("/api/categories/", json={
        "slug": "nuance",
        "name": "Nuance & Subtext",
        "description": "Cultural and contextual nuances"
    })
    cat_id = cat_res.json()["id"]

    create_res = client.post("/api/subtexts/", json={
        "category_id": cat_id,
        "title": "Bless your heart",
        "original_text": "Oh honey, you tried so hard with that presentation, bless your heart.",
        "subtext": "Southern US idiom: superficially affectionate, but frequently a condescending dismissal.",
        "tags": ["culture", "southern", "nuance"],
        "cadence": "weekly"
    })
    sub_id = create_res.json()["id"]

    # Submit review
    client.post(f"/api/subtexts/{sub_id}/review", json={
        "rating": "easy",
        "time_spent_seconds": 10,
        "reflection": "Understood immediately"
    })

    # Export backup
    export_res = client.get("/api/backup/export")
    assert export_res.status_code == 200
    payload = export_res.json()

    nuance_cat = next(c for c in payload["categories"] if c["slug"] == "nuance")
    assert len(nuance_cat["subtexts"]) == 1
    assert nuance_cat["subtexts"][0]["title"] == "Bless your heart"
    assert len(nuance_cat["subtexts"][0]["review_logs"]) == 1

    # Delete subtext from DB
    del_res = client.delete(f"/api/subtexts/{sub_id}")
    assert del_res.status_code == 204

    # Import backup back into DB
    import_res = client.post("/api/backup/import", json=payload)
    assert import_res.status_code == 200

    # Verify restored subtext
    list_res = client.get(f"/api/subtexts/?category_id={cat_id}")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 1
    assert items[0]["title"] == "Bless your heart"
    assert items[0]["review_count"] == 1


