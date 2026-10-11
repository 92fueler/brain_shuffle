from datetime import datetime, timezone, timedelta
from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy.pool import StaticPool
from brain_shuffle.models.category import Category
from brain_shuffle.models.problem import Problem
from brain_shuffle.models.review_log import ReviewLog
from brain_shuffle.services.shuffle_engine import ShuffleEngine
from brain_shuffle.services.backup_service import BackupService


def test_shuffle_engine_weights_and_review():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        cat = Category(slug="system_design", name="System Design")
        session.add(cat)
        session.commit()
        session.refresh(cat)

        now = datetime.now(timezone.utc)

        # Unreviewed new problem (high initial priority)
        new_prob = Problem(
            category_id=cat.id,
            title="Consistent Hashing",
            prompt="Prompt 1",
            notes="Notes 1",
            companies=["Google", "Amazon"],
            last_reviewed_at=None,
        )
        # Previously reviewed problem
        reviewed_prob = Problem(
            category_id=cat.id,
            title="Token Bucket",
            prompt="Prompt 2",
            notes="Notes 2",
            companies=["Stripe"],
            last_reviewed_at=now - timedelta(hours=2),
            retention_score=1.3,
        )
        session.add(new_prob)
        session.add(reviewed_prob)
        session.commit()

        import random
        random.seed(42)

        shuffle = ShuffleEngine(session)
        # Verify weight calculation: new problem has higher weight than reviewed problem in cooldown
        w_new = shuffle._calculate_weight(new_prob)
        w_rev = shuffle._calculate_weight(reviewed_prob)
        assert w_new > w_rev

        batch = shuffle.select_batch(category_id=cat.id, limit=1, mode="cadence")
        assert len(batch) == 1
        assert batch[0].title == "Consistent Hashing"

        # Record review for new problem with 'drill_soon' (rolling intra-day)
        updated = shuffle.record_review(new_prob, rating="drill_soon")
        assert updated.review_count == 1
        assert updated.retention_score < 1.0
        assert updated.cadence == "daily"
        assert updated.next_review_due is not None

        # Record review for reviewed problem with 'intra_week' (rolling 2.5d consolidation)
        updated_intra = shuffle.record_review(reviewed_prob, rating="intra_week")
        assert updated_intra.review_count == 1
        assert updated_intra.cadence == "intra_week"
        assert updated_intra.next_review_due > now + timedelta(days=2)


def test_rolling_cadence_weight_logic():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        cat = Category(slug="system_design", name="System Design")
        session.add(cat)
        session.commit()
        session.refresh(cat)

        now = datetime.now(timezone.utc)
        shuffle = ShuffleEngine(session)

        # 1. Problem in rolling intra_week cooldown
        prob_intra_cooldown = Problem(
            category_id=cat.id,
            title="Consensus Algorithm",
            prompt="Paxos vs Raft",
            notes="Quorum",
            cadence="intra_week",
            last_reviewed_at=now - timedelta(hours=10),
            next_review_due=now + timedelta(hours=50),
        )
        # Should be heavily attenuated during cooldown
        assert shuffle._calculate_weight(prob_intra_cooldown) == 0.1

        # 2. Problem in rolling skip_park cooldown
        prob_parked = Problem(
            category_id=cat.id,
            title="Obscure Bit Manipulation",
            prompt="Bit trick",
            notes="Notes",
            cadence="monthly",
            last_reviewed_at=now - timedelta(days=2),
            next_review_due=now + timedelta(days=19),
        )
        assert shuffle._calculate_weight(prob_parked) == 0.1

        # 3. Problem overdue for rolling intra_week review
        prob_intra_due = Problem(
            category_id=cat.id,
            title="Distributed Lock",
            prompt="Redlock",
            notes="TTL",
            cadence="intra_week",
            last_reviewed_at=now - timedelta(days=4),
            next_review_due=now - timedelta(hours=12),
        )
        w_due = shuffle._calculate_weight(prob_intra_due)
        # Base weight (1.0) + consolidation boost (+6.0) + overdue escalation
        assert w_due >= 7.0


def test_recency_exclusion_and_company_filtering():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        cat = Category(slug="coding", name="Coding")
        session.add(cat)
        session.commit()
        session.refresh(cat)

        now = datetime.now(timezone.utc)

        # Create problems with different companies
        p_google = Problem(
            category_id=cat.id,
            title="Google Coding 1",
            prompt="Prompt",
            notes="Notes",
            companies=["Google"],
            last_reviewed_at=now - timedelta(hours=1),
        )
        p_meta = Problem(
            category_id=cat.id,
            title="Meta Coding 1",
            prompt="Prompt",
            notes="Notes",
            companies=["Meta"],
            last_reviewed_at=now - timedelta(hours=1),
        )
        session.add(p_google)
        session.add(p_meta)
        session.commit()

        shuffle = ShuffleEngine(session)

        # Filter by company = Google
        batch = shuffle.select_batch(company="Google", limit=5)
        assert len(batch) == 1
        assert batch[0].title == "Google Coding 1"

        # Filter by company = Meta
        batch_meta = shuffle.select_batch(company="Meta", limit=5)
        assert len(batch_meta) == 1
        assert batch_meta[0].title == "Meta Coding 1"


def test_backup_service_export_and_import():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        cat = Category(slug="llm", name="LLM")
        session.add(cat)
        session.commit()
        session.refresh(cat)

        problem = Problem(
            category_id=cat.id,
            title="FlashAttention",
            prompt="What is tiling?",
            notes="Tiling loads tiles into SRAM.",
            companies=["OpenAI", "Meta"],
            cadence="intra_week",
        )
        session.add(problem)
        session.commit()

        backup = BackupService(session)
        payload = backup.export_data()
        assert len(payload.categories) == 1
        assert payload.categories[0].slug == "llm"
        assert payload.categories[0].problems[0].title == "FlashAttention"
        assert payload.categories[0].problems[0].cadence == "intra_week"
        assert "OpenAI" in payload.categories[0].problems[0].companies

        # Re-importing payload is idempotent and preserves cadence
        imported_count = backup.import_data(payload)
        assert imported_count == 1
        refreshed = session.exec(select(Problem).where(Problem.title == "FlashAttention")).first()
        assert refreshed is not None
        assert refreshed.cadence == "intra_week"

        # Re-importing second time does not duplicate logs
        imported_again = backup.import_data(payload)
        assert imported_again == 1
        logs = session.exec(select(ReviewLog).where(ReviewLog.problem_id == refreshed.id)).all()
        assert len(logs) == len(payload.categories[0].problems[0].review_logs)
