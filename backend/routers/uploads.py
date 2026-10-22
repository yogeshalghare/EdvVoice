"""Evidence uploads.

The browser sends files here first and gets back Cloudinary URLs, then posts
those URLs with the complaint. Two steps rather than one so a student can
watch each file upload and remove one without losing the whole form.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from deps import get_current_user
from schemas import EvidenceIn
from services import storage, transcribe as transcribe_service

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


@router.post("/transcribe")
async def transcribe_recording(
    file: UploadFile = File(...),
    _=Depends(get_current_user),
):
    """Turn a voice recording into text.

    The browser transcribes as the student speaks where it can. Where it
    cannot — Firefox, or a Chrome whose speech service is unreachable — the
    recording is sent here instead, so the complaint can still be filed by
    voice rather than forcing the student to type it out.

    The audio is not stored by this route; it is passed through and
    discarded. The copy that gets kept is the one the complaint attaches.
    """
    audio = await file.read()
    try:
        text = await transcribe_service.transcribe(audio, file.filename or "recording.webm")
    except transcribe_service.TranscriptionError as exc:
        raise HTTPException(422, str(exc))
    return {"transcript": text}
