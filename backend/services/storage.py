"""Evidence storage on Cloudinary.

Files are streamed straight through to Cloudinary — nothing is written to
this server's disk, so it works the same locally and on Render's free tier
where the filesystem is wiped on every deploy.
"""

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile

from config import settings

MAX_BYTES = 25 * 1024 * 1024
FOLDER = "edvvoice/evidence"

_configured = False


def _configure() -> None:
    global _configured
    if _configured:
        return
    if not settings.cloudinary_configured:
        raise HTTPException(
            500,
            "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY "
            "and CLOUDINARY_API_SECRET to backend/.env and restart.",
        )
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    _configured = True


def kind_of(mime: str) -> str:
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"
    raise HTTPException(400, "Attach photos, videos or audio only.")


def upload(file: UploadFile, contents: bytes) -> dict:
    """Push one file up and return the row we store against the complaint."""
    _configure()

    if len(contents) > MAX_BYTES:
        raise HTTPException(413, f"{file.filename} is over 25 MB.")

    kind = kind_of(file.content_type or "")
    # Cloudinary treats audio as 'video' — same pipeline, different container.
    resource_type = "image" if kind == "image" else "video"

    try:
        result = cloudinary.uploader.upload(
            contents,
            folder=FOLDER,
            resource_type=resource_type,
            use_filename=True,
            unique_filename=True,
        )
    except Exception as exc:  # cloudinary raises a wide range of error types
        raise HTTPException(502, f"Cloudinary rejected the upload: {exc}") from exc

    return {
        "kind": kind,
        "url": result["secure_url"],
        "public_id": result["public_id"],
        "name": file.filename or result["public_id"],
        "size": len(contents),
        "mime": file.content_type or "",
    }


def delete(public_id: str, kind: str) -> None:
    """Best effort cleanup — a failed delete should never break a request."""
    if not public_id:
        return
    try:
        _configure()
        cloudinary.uploader.destroy(
            public_id, resource_type="image" if kind == "image" else "video"
        )
    except Exception:
        pass
