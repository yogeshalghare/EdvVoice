"""Database tables.

These map onto the PostgreSQL schema in grievance_system.sql — same table
names, same column names — so moving from SQLite to Postgres is a connection
string change, not a rewrite.

Columns marked "added" are not in the original dump. They are all nullable or
defaulted, so the existing dump still loads cleanly. schema_additions.sql has
the ALTER TABLE statements that bring a Postgres database up to date.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Student(Base):
    __tablename__ = "students"

    student_id: Mapped[int] = mapped_column(primary_key=True)
    student_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), default="")  # added
    # added — False until the student clicks the link emailed at sign-up.
    # Only enforced when REQUIRE_EMAIL_VERIFICATION is on, so the column can
    # exist without changing behaviour.
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    complaints: Mapped[list["Complaint"]] = relationship(back_populates="student")

    # Uniform access, so one code path handles students and admins alike.
    @property
    def id(self) -> int:
        return self.student_id

    @property
    def name(self) -> str:
        return self.student_name

    @property
    def role(self) -> str:
        return "student"


class Admin(Base):
    __tablename__ = "admins"

    admin_id: Mapped[int] = mapped_column(primary_key=True)
    admin_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), default="")  # added

    @property
    def id(self) -> int:
        return self.admin_id

    @property
    def name(self) -> str:
        return self.admin_name

    @property
    def role(self) -> str:
        return "admin"


class Complaint(Base):
    __tablename__ = "complaints"

    complaint_id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.student_id"), index=True)
    admin_id: Mapped[int | None] = mapped_column(ForeignKey("admins.admin_id"), default=None)

    complaint: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(30), default="Pending", index=True)
    complaint_date: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    resolved_date: Mapped[datetime | None] = mapped_column(DateTime, default=None)

    priority: Mapped[str] = mapped_column(String(20), default="Normal")   # added
    notes: Mapped[str] = mapped_column(Text, default="")                  # added

    student: Mapped["Student"] = relationship(back_populates="complaints")
    admin: Mapped["Admin | None"] = relationship()
    attachments: Mapped[list["ComplaintAttachment"]] = relationship(
        back_populates="complaint_row", cascade="all, delete-orphan"
    )
    history: Mapped[list["ComplaintStatusHistory"]] = relationship(
        back_populates="complaint_row",
        cascade="all, delete-orphan",
        order_by="ComplaintStatusHistory.changed_at",
    )

    @property
    def reference(self) -> str:
        """The tracking ID students quote, derived from the primary key.

        Deriving it keeps the schema clean — no extra column to keep in sync —
        and it is stable because complaint_id never changes.
        """
        return f"GRV{1020 + self.complaint_id}"

    @staticmethod
    def id_from_reference(reference: str) -> int | None:
        digits = "".join(ch for ch in reference if ch.isdigit())
        if not digits:
            return None
        value = int(digits) - 1020
        return value if value > 0 else None


class ComplaintAttachment(Base):
    __tablename__ = "complaint_attachments"

    attachment_id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.complaint_id"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(Text)  # the Cloudinary secure_url
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    file_type: Mapped[str] = mapped_column(String(100), default="")  # added — mime type
    file_size: Mapped[int] = mapped_column(Integer, default=0)       # added — bytes

    complaint_row: Mapped["Complaint"] = relationship(back_populates="attachments")

    @property
    def kind(self) -> str:
        """image | video | audio, worked out from the mime type."""
        for prefix in ("image", "video", "audio"):
            if self.file_type.startswith(prefix):
                return prefix
        return "image"


class ComplaintStatusHistory(Base):
    """Added table — the original schema keeps only the current status."""

    __tablename__ = "complaint_status_history"

    history_id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.complaint_id"), index=True)
    status: Mapped[str] = mapped_column(String(30))
    note: Mapped[str] = mapped_column(Text, default="")
    changed_by: Mapped[str] = mapped_column(String(100))
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    complaint_row: Mapped["Complaint"] = relationship(back_populates="history")


class PasswordResetToken(Base):
    """Added table — supports the Resend password reset flow."""

    __tablename__ = "password_reset_tokens"

    token_id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    user_type: Mapped[str] = mapped_column(String(10))  # student | admin
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class EmailVerificationToken(Base):
    """Added table — holds the one-time code emailed at sign-up.

    `token` stores a bcrypt hash of the code, never the six digits. A
    code is short-lived and low-entropy, so anyone reading the table would
    otherwise be able to complete a pending sign-up.

    `attempts` is what makes six digits safe. A million combinations is
    trivial to script through, so the code is burned after five wrong
    guesses and the student has to request a new one.

    Kept separate from password_reset_tokens: the two have different
    lifetimes and conflating them would let one be replayed as the other.
    """

    __tablename__ = "email_verification_tokens"

    token_id: Mapped[int] = mapped_column(primary_key=True)
    # Named `token` for continuity with the table's first version; it holds
    # a bcrypt hash of the code, not the code.
    token: Mapped[str] = mapped_column("token", String(120), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.student_id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    attempts: Mapped[int] = mapped_column(Integer, default=0)  # added
