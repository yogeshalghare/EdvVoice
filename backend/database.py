"""SQLAlchemy session handling.

SQLite today, PostgreSQL when you're ready — the only thing that changes is
DATABASE_URL in .env. Nothing in models.py or the routers cares which one is
behind it.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import settings

def _normalise(url: str) -> str:
    """Render hands out URLs starting with postgres://.

    SQLAlchemy 2 dropped that alias and wants an explicit driver, so pasting
    Render's connection string in unchanged fails with a confusing error.
    Rewriting it here means you can paste exactly what Render gives you.
    """
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = _normalise(settings.database_url)

# check_same_thread is a SQLite-only quirk; skipped on Postgres.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_columns() -> None:
    """Add columns that models.py declares but an existing table lacks.

    Base.metadata.create_all() creates missing TABLES and nothing else — it
    never alters a table that already exists. So a new column breaks every
    database that was created before it, which on this project means the
    SQLite file on a developer's laptop while a fresh Render database is
    fine. This closes that gap.

    Idempotent: safe on every startup, and a no-op on a fresh database
    where create_all() already made the columns.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    is_postgres = engine.dialect.name == "postgresql"
    false_literal = "FALSE" if is_postgres else "0"

    # (table, column, DDL type+default, optional backfill statement)
    wanted = [
        (
            "students",
            "email_verified",
            f"BOOLEAN NOT NULL DEFAULT {false_literal}",
            # Accounts made before this column existed had nothing to
            # verify; defaulting them to unverified would lock out working
            # logins the moment the check is switched on.
            "UPDATE students SET email_verified = TRUE",
        ),
        (
            "email_verification_tokens",
            "attempts",
            "INTEGER NOT NULL DEFAULT 0",
            None,
        ),
    ]

    tables = set(inspector.get_table_names())
    for table, column, ddl, backfill in wanted:
        if table not in tables:
            continue  # create_all() will build it with the column already in
        if column in {c["name"] for c in inspector.get_columns(table)}:
            continue

        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
            if backfill:
                conn.execute(text(backfill))
        print(f"[schema] added {table}.{column}")
