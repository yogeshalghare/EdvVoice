"""EdvVoice backend.

Voice-Based Complaint Registration & Grievance Management System
Group 3 — Department of Information Technology, GHRCE Nagpur.

Local:  uvicorn main:app --reload --port 8000
Docs:   http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from config import settings
from database import DATABASE_URL, Base, SessionLocal, engine, ensure_columns
from routers import auth, complaints, uploads
from services import nlp
from security import hash_password

# Importing models registers every table on Base before create_all runs.
import models  # noqa: F401
from models import Admin, Student


def _bootstrap_admin() -> None:
    """Create the first staff account from environment variables.

    Render's free tier gives no shell, so create_admin.py cannot be run
    against the deployed database. Setting ADMIN_EMAIL and ADMIN_PASSWORD
    makes that first account on startup instead.

    Remove both variables once the account exists — leaving a password in
    the environment is not something to keep around.
    """
    email = settings.admin_email.strip().lower()
    password = settings.admin_password

    if not email or not password:
        return
    if len(password) < 8:
        print("[bootstrap] ADMIN_PASSWORD is under 8 characters — skipping.")
        return

    with SessionLocal() as db:
        if db.scalar(select(Admin).where(Admin.email == email)):
            return  # already there, nothing to do
        if db.scalar(select(Student).where(Student.email == email)):
            print(f"[bootstrap] {email} is already a student account — skipping.")
            return

        db.add(
            Admin(
                admin_name=email.split("@")[0].replace(".", " ").title(),
                email=email,
                password_hash=hash_password(password),
            )
        )
        db.commit()
        print(f"[bootstrap] Admin created for {email}. Remove ADMIN_PASSWORD now.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fine while the schema is still settling. Switch to Alembic migrations
    # once it stops changing, so you stop losing data on every change.
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    _bootstrap_admin()
    yield


app = FastAPI(
    title="EdvVoice API",
    description="Voice-based complaint registration and grievance management.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(complaints.router)
app.include_router(uploads.router)


@app.get("/api/health", tags=["health"])
def health():
    """Check the services are wired up — open this in a browser after deploy."""
    return {
        "ok": True,
        "database": DATABASE_URL.split("://")[0],
        "resend": bool(settings.resend_api_key),
        "cloudinary": settings.cloudinary_configured,
        # True when the trained classifier loaded; False means the app is
        # running on keyword rules. Check this after a deploy.
        "ml_classifier": nlp.model_is_active(),
        "origins": settings.allowed_origins,
    }
