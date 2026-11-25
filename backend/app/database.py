from collections.abc import Generator

import logging

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import config

engine = create_engine(
    config.database_url,
    # FastAPI handles requests across threads; SQLite needs this flag
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _record):
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")   # SQLite ignores FKs unless enabled
    cur.execute("PRAGMA journal_mode=WAL")  # readers don't block the pipeline writer
    cur.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401  (registers tables on Base)

    Base.metadata.create_all(bind=engine)
    ensure_columns()


# Nullable columns added after the first release. create_all() creates new TABLES but never
# alters existing ones, so add these here instead of asking people to delete app.db.
_ADDED_COLUMNS = {
    "tone_evidence": [("basis", "VARCHAR(20)"), ("voice_cues", "JSON")],
}


def ensure_columns() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, cols in _ADDED_COLUMNS.items():
            if not insp.has_table(table):
                continue
            have = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in cols:
                if name not in have:
                    logging.getLogger(__name__).info("Adding column %s.%s", table, name)
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
