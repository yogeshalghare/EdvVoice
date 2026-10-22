"""Shared FastAPI dependencies: the database session and the current account.

Students and admins live in separate tables, which is the schema's way of
expressing the role. The JWT carries which table to look in, so the rest of
the code can just read `account.role`.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from models import Admin, Student
from security import decode_access_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Student | Admin:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue.")

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Sign in again.")

    table = Admin if payload.get("role") == "admin" else Student
    account = db.get(table, int(payload["sub"]))

    if account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "That account no longer exists.")
    return account


def require_admin(account=Depends(get_current_user)):
    if account.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This area is for staff accounts.")
    return account
