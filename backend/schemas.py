"""Request and response shapes.

Field names here are what the React app receives. They deliberately differ
from the database column names in places (reference, title, student_name),
because the API should present a complaint the way the UI needs it rather
than mirroring the table layout.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

CATEGORIES = ["Academic", "Hostel", "Infrastructure", "Dining", "IT Support"]
STATUSES = ["Pending", "In Progress", "Resolved", "Rejected"]


# --------------------------------------------------------------------- auth

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class VerifyOtpIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10)


class ResetPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


# --------------------------------------------------------------- complaints

class EvidenceOut(BaseModel):
    id: int
    kind: str
    url: str
    name: str
    size: int
    mime: str


class EvidenceIn(BaseModel):
    """An already-uploaded file, as returned by POST /uploads."""

    kind: str
    url: str
    public_id: str = ""
    name: str
    size: int = 0
    mime: str = ""


class TimelineOut(BaseModel):
    label: str
    by_name: str
    at: datetime


class ComplaintCreate(BaseModel):
    category: str
    transcript: str = Field(min_length=1)
    notes: str = ""
    evidence: list[EvidenceIn] = []


class ComplaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reference: str
    title: str
    transcript: str
    notes: str
    category: str
    priority: str
    status: str
    created_at: datetime
    resolved_at: datetime | None = None
    student_name: str
    student_email: str
    assigned_to: str | None = None
    evidence: list[EvidenceOut] = []
    timeline: list[TimelineOut] = []


class ComplaintListOut(BaseModel):
    """Trimmed shape for tables — no full text, no file list."""

    reference: str
    title: str
    category: str
    priority: str
    status: str
    created_at: datetime
    student_name: str
    evidence_count: int


class StatusUpdateIn(BaseModel):
    status: str
    note: str = ""


class StatsOut(BaseModel):
    total: int
    pending: int
    in_progress: int
    resolved: int
    active: int


class CategoryCount(BaseModel):
    name: str
    count: int


# ---------------------------------------------------------------- validation

class ValidateIn(BaseModel):
    transcript: str = ""


class ValidateOut(BaseModel):
    """Whether a transcript reads as a real complaint.

    The frontend calls this before submitting so the student gets the feedback
    while they can still fix it, rather than after pressing submit.
    """

    is_complaint: bool
    reason: str = ""
    category: str | None = None
    priority: str | None = None
