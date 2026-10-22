"""
Copy everything from the local SQLite database into PostgreSQL.

Nothing is deleted. The SQLite file is only read, so if the migration goes
wrong you still have it and can carry on exactly as before.

    python migrate_to_postgres.py "postgresql://user:password@localhost:5432/grievance_system"

Or, with POSTGRES_URL already set in the environment:

    python migrate_to_postgres.py

What it does:

  1. Connects to both databases
  2. Creates the tables in PostgreSQL if they are missing
  3. Refuses to run if the target already has data, unless you pass --force
  4. Copies students, admins, complaints, attachments, status history and
     reset tokens, in that order so foreign keys always resolve
  5. Resets the PostgreSQL sequences, so the next insert does not collide
     with a copied primary key

Afterwards, point DATABASE_URL at PostgreSQL in backend/.env and restart.
"""

import os
import sys

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from database import Base, _normalise
from models import (
    Admin,
    Complaint,
    ComplaintAttachment,
    ComplaintStatusHistory,
    PasswordResetToken,
    Student,
)

# Order matters: a complaint needs its student to exist first.
TABLES = [
    (Student, "students"),
    (Admin, "admins"),
    (Complaint, "complaints"),
    (ComplaintAttachment, "complaint_attachments"),
    (ComplaintStatusHistory, "complaint_status_history"),
    (PasswordResetToken, "password_reset_tokens"),
]

# Primary key column per table, for resetting sequences afterwards.
PRIMARY_KEYS = {
    "students": "student_id",
    "admins": "admin_id",
    "complaints": "complaint_id",
    "complaint_attachments": "attachment_id",
    "complaint_status_history": "history_id",
    "password_reset_tokens": "token_id",
}


def copy_row(model, row):
    """Make a detached copy, so it can be inserted into the other session."""
    data = {c.name: getattr(row, c.name) for c in model.__table__.columns}
    return model(**data)


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--force"]
    force = "--force" in sys.argv

    target_url = args[0] if args else os.getenv("POSTGRES_URL", "")
    if not target_url:
        print(__doc__)
        raise SystemExit(1)

    source_url = os.getenv("SQLITE_URL", "sqlite:///./edvvoice.db")
    target_url = _normalise(target_url)

    if not target_url.startswith("postgresql"):
        print("That does not look like a PostgreSQL URL.")
        raise SystemExit(1)

    print(f"From: {source_url}")
    print(f"To:   {target_url.split('@')[-1]}\n")  # no credentials in the output

    source_engine = create_engine(source_url, connect_args={"check_same_thread": False})
    target_engine = create_engine(target_url)

    try:
        target_engine.connect().close()
    except Exception as exc:
        print(f"Could not reach PostgreSQL: {exc}")
        raise SystemExit(1)

    print("Creating any missing tables in PostgreSQL...")
    Base.metadata.create_all(bind=target_engine)

    SourceSession = sessionmaker(bind=source_engine)
    TargetSession = sessionmaker(bind=target_engine)

    with SourceSession() as src, TargetSession() as dst:
        existing = dst.scalar(select(func.count()).select_from(Student)) or 0
        if existing and not force:
            print(
                f"\nPostgreSQL already has {existing} student(s). Stopping so "
                "nothing is duplicated.\nRe-run with --force if you are sure."
            )
            raise SystemExit(1)

        total = 0
        for model, name in TABLES:
            rows = src.scalars(select(model)).all()
            for row in rows:
                dst.add(copy_row(model, row))
            dst.flush()
            print(f"  {name:28} {len(rows):4} row(s)")
            total += len(rows)

        dst.commit()

    # PostgreSQL identity columns do not know about the ids we just inserted,
    # so the next insert would reuse id 1 and fail. Move each sequence past
    # the highest copied value.
    print("\nResetting sequences...")
    with target_engine.begin() as conn:
        for table, pk in PRIMARY_KEYS.items():
            conn.exec_driver_sql(
                f"SELECT setval(pg_get_serial_sequence('{table}', '{pk}'), "
                f"COALESCE((SELECT MAX({pk}) FROM {table}), 1), true)"
            )
            print(f"  {table}")

    print(f"\nDone — {total} row(s) copied.")
    print("\nNext: set DATABASE_URL in backend/.env to the PostgreSQL URL, then")
    print("restart the server. Your SQLite file is untouched if you need to go back.")


if __name__ == "__main__":
    main()
