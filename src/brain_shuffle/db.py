from collections.abc import Generator
from pathlib import Path
from sqlalchemy import event, text
from sqlmodel import Session, SQLModel, create_engine
from brain_shuffle.config import settings

# Ensure data directory exists if using local sqlite or backups
Path("./data/backups").mkdir(parents=True, exist_ok=True)

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    echo=(settings.ENVIRONMENT == "debug"),
    connect_args=connect_args,
)

if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


def init_db() -> None:
    import brain_shuffle.models  # noqa: F401
    SQLModel.metadata.create_all(engine)
    if settings.DATABASE_URL.startswith("sqlite"):
        with Session(engine) as session:
            for ddl in (
                "ALTER TABLE problems ADD COLUMN cadence VARCHAR DEFAULT 'weekly'",
                "ALTER TABLE problems ADD COLUMN is_starred BOOLEAN DEFAULT 0",
                "ALTER TABLE subtexts ADD COLUMN is_starred BOOLEAN DEFAULT 0",
            ):
                try:
                    session.connection().execute(text(ddl))
                    session.commit()
                except Exception:
                    pass


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
