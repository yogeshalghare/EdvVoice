"""Complaint registration, tracking and administration.

Students only ever see their own complaints; the ownership check lives in
_fetch() so no endpoint can forget it.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from database import get_db
from deps import get_current_user, require_admin
from models import Complaint, ComplaintAttachment, ComplaintStatusHistory
from schemas import (
    CATEGORIES,
    STATUSES,
    CategoryCount,
    ComplaintCreate,
    ComplaintListOut,
    ComplaintOut,
    EvidenceOut,
    StatsOut,
    StatusUpdateIn,
    TimelineOut,
    ValidateIn,
    ValidateOut,
)
from services import email as email_service
from services import nlp

router = APIRouter(prefix="/api/complaints", tags=["complaints"])


def _to_out(c: Complaint) -> ComplaintOut:
    return ComplaintOut(
        reference=c.reference,
        title=nlp.summarise(c.complaint, c.category),
        transcript=c.complaint,
        notes=c.notes or "",
        category=c.category,
        priority=c.priority,
        status=c.status,
        created_at=c.complaint_date,
        resolved_at=c.resolved_date,
        student_name=c.student.student_name,
        student_email=c.student.email,
        assigned_to=c.admin.admin_name if c.admin else None,
        evidence=[
            EvidenceOut(
                id=a.attachment_id, kind=a.kind, url=a.file_path,
                name=a.file_name, size=a.file_size, mime=a.file_type,
            )
            for a in c.attachments
        ],
        timeline=[
            TimelineOut(
                label=h.status if not h.note else f"{h.status} — {h.note}",
                by_name=h.changed_by,
                at=h.changed_at,
            )
            for h in c.history
        ],
    )


def _fetch(db: Session, reference: str, account) -> Complaint:
    complaint_id = Complaint.id_from_reference(reference)
    if complaint_id is None:
        raise HTTPException(404, "No complaint with that tracking ID.")

    complaint = db.scalar(
        select(Complaint)
        .where(Complaint.complaint_id == complaint_id)
        .options(
            selectinload(Complaint.attachments),
            selectinload(Complaint.history),
            selectinload(Complaint.student),
            selectinload(Complaint.admin),
        )
    )
    if complaint is None:
        raise HTTPException(404, "No complaint with that tracking ID.")

    # 404 rather than 403 — a 403 would confirm the ID exists.
    if account.role != "admin" and complaint.student_id != account.id:
        raise HTTPException(404, "No complaint with that tracking ID.")

    return complaint


@router.post("/validate", response_model=ValidateOut)
def validate_complaint(payload: ValidateIn, _=Depends(get_current_user)):
    """Check a transcript before submitting.

    The frontend calls this as the student finishes recording, so unusable
    input is caught while it can still be fixed rather than after submission.
    """
    verdict = nlp.validate(payload.transcript)
    if not verdict["is_complaint"]:
        return ValidateOut(is_complaint=False, reason=verdict["reason"])

    guess = nlp.classify(payload.transcript)
    return ValidateOut(
        is_complaint=True, category=guess["category"], priority=guess["priority"]
    )


@router.post("", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    payload: ComplaintCreate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    account=Depends(get_current_user),
):
    if account.role != "student":
        raise HTTPException(403, "Complaints are registered by students.")
    if payload.category not in CATEGORIES:
        raise HTTPException(400, f"Category must be one of: {', '.join(CATEGORIES)}")

    text = payload.transcript.strip()

    # Reject anything that is not actually a complaint. Checked here as well
    # as in the browser, because the browser check can be bypassed.
    verdict = nlp.validate(text)
    if not verdict["is_complaint"]:
        raise HTTPException(422, verdict["reason"])

    # The NLP layer decides the real department and urgency; what the student
    # picked in the UI is only a fallback when nothing matches.
    guess = nlp.classify(text, fallback_category=payload.category)

    complaint = Complaint(
        student_id=account.id,
        complaint=text,
        notes=payload.notes.strip(),
        category=guess["category"],
        priority=guess["priority"],
        status="Pending",
    )
    complaint.attachments = [
        ComplaintAttachment(
            file_name=e.name, file_path=e.url, file_type=e.mime, file_size=e.size
        )
        for e in payload.evidence
    ]
    complaint.history = [
        ComplaintStatusHistory(
            status="Registered", note="", changed_by=account.student_name
        )
    ]

    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    # Sent after the response, so a slow mail server never delays submission.
    background.add_task(
        _safe_email,
        email_service.send_complaint_registered,
        account.email, complaint.reference, nlp.summarise(text, complaint.category),
        complaint.category,
    )

    return _to_out(complaint)


@router.get("", response_model=list[ComplaintListOut])
def list_complaints(
    db: Session = Depends(get_db),
    account=Depends(get_current_user),
    status_filter: str | None = Query(None, alias="status"),
    category: str | None = None,
    q: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    stmt = (
        select(Complaint)
        .options(selectinload(Complaint.student), selectinload(Complaint.attachments))
        .order_by(Complaint.complaint_date.desc())
    )

    if account.role != "admin":
        stmt = stmt.where(Complaint.student_id == account.id)
    if status_filter and status_filter != "All":
        stmt = stmt.where(Complaint.status == status_filter)
    if category and category != "All":
        stmt = stmt.where(Complaint.category == category)
    if q:
        stmt = stmt.where(func.lower(Complaint.complaint).like(f"%{q.lower()}%"))

    rows = db.scalars(stmt.limit(limit).offset(offset)).all()

    return [
        ComplaintListOut(
            reference=c.reference,
            title=nlp.summarise(c.complaint, c.category),
            category=c.category,
            priority=c.priority,
            status=c.status,
            created_at=c.complaint_date,
            student_name=c.student.student_name,
            evidence_count=len(c.attachments),
        )
        for c in rows
    ]


@router.get("/stats", response_model=StatsOut)
def complaint_stats(db: Session = Depends(get_db), account=Depends(get_current_user)):
    stmt = select(Complaint.status, func.count()).group_by(Complaint.status)
    if account.role != "admin":
        stmt = stmt.where(Complaint.student_id == account.id)

    counts = dict(db.execute(stmt).all())
    pending = counts.get("Pending", 0)
    in_progress = counts.get("In Progress", 0)

    return StatsOut(
        total=sum(counts.values()),
        pending=pending,
        in_progress=in_progress,
        resolved=counts.get("Resolved", 0),
        active=pending + in_progress,
    )


@router.get("/breakdown", response_model=list[CategoryCount])
def category_breakdown(db: Session = Depends(get_db), _=Depends(require_admin)):
    rows = db.execute(
        select(Complaint.category, func.count())
        .group_by(Complaint.category)
        .order_by(func.count().desc())
    ).all()
    return [CategoryCount(name=name, count=count) for name, count in rows]


@router.get("/{reference}", response_model=ComplaintOut)
def get_complaint(
    reference: str, db: Session = Depends(get_db), account=Depends(get_current_user)
):
    return _to_out(_fetch(db, reference, account))


@router.patch("/{reference}/status", response_model=ComplaintOut)
async def update_status(
    reference: str,
    payload: StatusUpdateIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    if payload.status not in STATUSES:
        raise HTTPException(400, f"Status must be one of: {', '.join(STATUSES)}")

    complaint = _fetch(db, reference, admin)
    if complaint.status == payload.status:
        return _to_out(complaint)

    complaint.status = payload.status
    # Whoever acts on a complaint takes ownership of it.
    complaint.admin_id = admin.id
    complaint.resolved_date = (
        datetime.now(timezone.utc) if payload.status == "Resolved" else None
    )
    complaint.history.append(
        ComplaintStatusHistory(
            status=payload.status, note=payload.note.strip(), changed_by=admin.admin_name
        )
    )

    db.commit()
    db.refresh(complaint)

    background.add_task(
        _safe_email,
        email_service.send_status_change,
        complaint.student.email, complaint.reference,
        nlp.summarise(complaint.complaint, complaint.category), complaint.status,
    )

    return _to_out(complaint)


async def _safe_email(fn, *args) -> None:
    """Email failures must never surface as a failed complaint submission."""
    try:
        await fn(*args)
    except Exception as exc:
        print(f"[email] could not send: {exc}")
