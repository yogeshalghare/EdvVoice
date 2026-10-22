"""Registration, sign in, and the password reset flow.

Students register themselves. Admin accounts are created by create_admin.py,
since staff access should not be self-service.
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import get_current_user
from models import Admin, EmailVerificationToken, PasswordResetToken, Student
from schemas import (
    ForgotPasswordIn,
    LoginIn,
    RegisterIn,
    ResetPasswordIn,
    TokenOut,
    UserOut,
    VerifyOtpIn,
)
from security import create_access_token, hash_password, verify_password
from services import email as email_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

RESET_TTL = timedelta(minutes=30)
VERIFY_TTL = timedelta(hours=24)


def _as_user(account) -> UserOut:
    return UserOut(id=account.id, name=account.name, email=account.email, role=account.role)


def _issue(account) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(account.id, account.role),
        user=_as_user(account),
    )


def _find_account(db: Session, email: str):
    """Look in both tables — which one holds the row is the role."""
    student = db.scalar(select(Student).where(Student.email == email))
    if student:
        return student
    return db.scalar(select(Admin).where(Admin.email == email))


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = payload.email.lower()

    if _find_account(db, email):
        raise HTTPException(409, "An account with that email already exists. Sign in instead.")

    student = Student(
        student_name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        # Verified immediately when the check is switched off, so the column
        # never holds a value the app is not acting on.
        email_verified=not settings.require_email_verification,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    if settings.require_email_verification:
        code = _issue_otp(db, student)
        background.add_task(
            _safe_send_otp, student.email, student.student_name, code
        )
        # 202, not 201: the account exists but is not usable yet. No token
        # is returned — signing them in regardless would make verification
        # decorative. Returned as a response rather than raised as an
        # HTTPException, because this is a success, and the client needs a
        # body it can branch on rather than an error shape.
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={
                "verification_required": True,
                "email": student.email,
                "message": "Account created. Enter the code we emailed you.",
            },
        )

    return _issue(student)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    """Sign in, saying which of the two things went wrong.

    A deliberate trade. Returning one message for both cases would hide
    which addresses are registered, but it also tells someone who simply
    mistyped their email that their password is wrong, which reads as a
    broken app. College addresses follow a published pattern, so there is
    little left to hide, and the clearer error is worth more here.

    On a public product the generic message would be the right default, and
    this split should be paired with rate limiting on repeated failures.
    """
    account = _find_account(db, payload.email.lower())

    if account is None:
        raise HTTPException(
            404, "No account found with that email. Register first."
        )

    if not verify_password(payload.password, account.password_hash):
        raise HTTPException(401, "Incorrect password. Try again.")

    # Admins are created by the startup bootstrap, never self-registered,
    # so there is nothing to confirm for them.
    if (
        settings.require_email_verification
        and account.role == "student"
        and not account.email_verified
    ):
        raise HTTPException(
            403, "Confirm your email first. Check your inbox for the code."
        )

    return _issue(account)


@router.get("/me", response_model=UserOut)
def me(account=Depends(get_current_user)):
    return _as_user(account)


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Email a reset link, but only to an address that has an account.

    An unknown address gets a 404 telling the student to register, which
    matches the login endpoint and avoids someone waiting for a mail that
    was never going to arrive.

    The send itself still runs in the background and its failures are
    logged rather than returned. That part is not cosmetic: the Resend free
    tier refuses every address except the verified one, so a failed send is
    the normal case here, and surfacing it would turn "your link is coming"
    into a 500 for the one person who actually has an account.
    """
    email = payload.email.lower()
    account = _find_account(db, email)

    if account is None:
        raise HTTPException(
            404, "No account found with that email. Register first."
        )

    token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            token=token,
            user_type=account.role,
            user_id=account.id,
            expires_at=datetime.now(timezone.utc) + RESET_TTL,
        )
    )
    db.commit()

    background.add_task(
        _safe_send_reset,
        account.email,
        f"{settings.app_url}/reset-password?token={token}",
    )
    return {"message": "A reset link is on its way to your email."}


async def _safe_send_reset(to: str, link: str) -> None:
    """A failed reset email must never change what the caller sees."""
    try:
        await email_service.send_password_reset(to, link)
    except Exception as exc:
        print(f"[email] reset link to {to} could not be sent: {exc}")


def _valid_token(db: Session, token: str) -> PasswordResetToken:
    row = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token == token))
    expired = (
        row is None
        or row.used_at is not None
        or row.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)
    )
    if expired:
        raise HTTPException(400, "This reset link has expired or was already used.")
    return row


@router.get("/reset-password/verify")
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    _valid_token(db, token)
    return {"valid": True}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    row = _valid_token(db, payload.token)

    table = Admin if row.user_type == "admin" else Student
    account = db.get(table, row.user_id)
    if account is None:
        raise HTTPException(400, "This reset link is no longer valid.")

    account.password_hash = hash_password(payload.password)
    row.used_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Password updated."}


# --------------------------------------------------------------- email verification
#
# A six-digit code, not a link. On a phone a link opens the mail app's own
# browser, which is a different session from the one the student registered
# in, so they confirm and then have to come back and sign in. A code keeps
# the whole thing on one screen.
#
# Six digits is only a million combinations, so the attempt cap below is not
# optional — it is what makes the code as hard to guess as the link it
# replaced.

OTP_TTL = timedelta(minutes=10)
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN = timedelta(seconds=60)


def _generate_otp() -> str:
    """A six-digit code from a cryptographic source.

    secrets, not random: random is seeded predictably and is not meant for
    anything an attacker would want to guess.
    """
    return f"{secrets.randbelow(1_000_000):06d}"


def _issue_otp(db: Session, student: Student) -> str:
    """Create a code, store only its hash, retire any earlier unused one."""
    now = datetime.now(timezone.utc)
    for old in db.scalars(
        select(EmailVerificationToken).where(
            EmailVerificationToken.student_id == student.student_id,
            EmailVerificationToken.used_at.is_(None),
        )
    ):
        old.used_at = now

    code = _generate_otp()
    db.add(
        EmailVerificationToken(
            token=hash_password(code),
            student_id=student.student_id,
            expires_at=now + OTP_TTL,
        )
    )
    db.commit()
    return code


def _active_otp(db: Session, student: Student) -> EmailVerificationToken | None:
    now = datetime.now(timezone.utc)
    row = db.scalars(
        select(EmailVerificationToken)
        .where(
            EmailVerificationToken.student_id == student.student_id,
            EmailVerificationToken.used_at.is_(None),
        )
        .order_by(EmailVerificationToken.token_id.desc())
    ).first()
    if row is None or row.expires_at.replace(tzinfo=timezone.utc) < now:
        return None
    return row


async def _safe_send_otp(to: str, name: str, code: str) -> None:
    """A failed send must not break the response the student already got."""
    try:
        await email_service.send_email_otp(to, name, code)
    except Exception as exc:
        print(f"[email] code for {to} could not be sent: {exc}")


@router.post("/verify-otp", response_model=TokenOut)
def verify_otp(payload: VerifyOtpIn, db: Session = Depends(get_db)):
    """Check the code and, on success, sign the student in.

    Signing them in here is deliberate: they have just proved they control
    the address, which is exactly what a login establishes. Sending them
    back to the login form would make them type the password again for no
    additional assurance.
    """
    student = db.scalar(select(Student).where(Student.email == payload.email.lower()))
    if student is None:
        raise HTTPException(404, "No account found with that email.")

    if student.email_verified:
        raise HTTPException(400, "This email is already confirmed. Sign in instead.")

    row = _active_otp(db, student)
    if row is None:
        raise HTTPException(400, "That code has expired. Ask for a new one.")

    if row.attempts >= OTP_MAX_ATTEMPTS:
        row.used_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(429, "Too many wrong attempts. Ask for a new code.")

    if not verify_password(payload.code.strip(), row.token):
        row.attempts += 1
        db.commit()
        left = OTP_MAX_ATTEMPTS - row.attempts
        if left <= 0:
            raise HTTPException(429, "Too many wrong attempts. Ask for a new code.")
        raise HTTPException(
            400, f"That code is not right. {left} attempt{'s' if left != 1 else ''} left."
        )

    student.email_verified = True
    row.used_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(student)
    return _issue(student)


@router.post("/resend-otp")
async def resend_otp(
    payload: ForgotPasswordIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Send a fresh code.

    Answers the same way whether the address is unknown, already confirmed
    or genuinely pending, so this cannot be used to tell those apart.
    """
    student = db.scalar(select(Student).where(Student.email == payload.email.lower()))
    done = {"message": "If that account needs confirming, a new code is on its way."}

    if student is None or student.email_verified:
        return done

    # Without a cooldown this endpoint is a way to send someone a lot of mail.
    current = _active_otp(db, student)
    if current is not None:
        issued_at = current.expires_at.replace(tzinfo=timezone.utc) - OTP_TTL
        if datetime.now(timezone.utc) - issued_at < OTP_RESEND_COOLDOWN:
            raise HTTPException(429, "A code was just sent. Wait a minute and try again.")

    code = _issue_otp(db, student)
    background.add_task(_safe_send_otp, student.email, student.student_name, code)
    return done
