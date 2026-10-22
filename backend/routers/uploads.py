"""Evidence uploads.

The browser sends files here first and gets back Cloudinary URLs, then posts
those URLs with the complaint. Two steps rather than one so a student can
watch each file upload and remove one without losing the whole form.
"""

from fastapi import APIRouter, Depends, File, UploadFile

from deps import get_current_user
from schemas import EvidenceIn
from services import storage

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("", response_model=list[EvidenceIn])
async def upload_evidence(
    files: list[UploadFile] = File(...),
    _=Depends(get_current_user),
):
    uploaded = []
    for file in files:
        contents = await file.read()
        uploaded.append(EvidenceIn(**storage.upload(file, contents)))
    return uploaded
