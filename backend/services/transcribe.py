"""Speech to text on the server, through Groq's hosted Whisper.

Why this exists alongside the browser's Web Speech API:

The browser route is instant and costs nothing, but it only works where the
browser supports it AND can reach its speech service. Firefox has never
implemented it, Safari is patchy, and a Chrome install whose speech service
is unreachable fails with an abort and no transcript at all — which is
exactly what happens on the development machine this was built on.

So the browser is tried first for live feedback, and this is the fallback
that decides whether a complaint can actually be filed by voice. It runs on
audio the student has already recorded, so nothing extra is captured.

Groq rather than running Whisper here: the free instance has 512MB of RAM
and shares a CPU. Even the smallest local Whisper would exhaust that and
take longer than a student will wait. A hosted call keeps the footprint at
one HTTP request.
"""

import httpx

from config import settings

ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions"
MODEL = "whisper-large-v3-turbo"

# Groq rejects anything larger, and three minutes of Opus is far below it.
MAX_BYTES = 24 * 1024 * 1024


def is_configured() -> bool:
    return bool(settings.groq_api_key)


class TranscriptionError(Exception):
    """Raised with a message meant for the student, not a stack trace."""


async def transcribe(audio: bytes, filename: str = "recording.webm") -> str:
    if not is_configured():
        raise TranscriptionError(
            "Server transcription is not set up. Type your complaint instead."
        )
    if not audio:
        raise TranscriptionError("The recording came through empty. Try again.")
    if len(audio) > MAX_BYTES:
        raise TranscriptionError("That recording is too long. Keep it under three minutes.")

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                ENDPOINT,
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                files={"file": (filename, audio, "application/octet-stream")},
                data={
                    "model": MODEL,
                    "response_format": "json",
                    # The project is single-language by design. Naming the
                    # language stops Whisper guessing, which it does badly on
                    # short clips and on Indian-accented English.
                    "language": "en",
                    # Nudges spelling of words the model would otherwise
                    # mangle in this setting.
                    "prompt": (
                        "A student complaint about a college in India. May mention "
                        "hostel, mess, warden, roti, dal, wifi, marksheet, "
                        "semester, department, lab, fan, water cooler."
                    ),
                },
            )
    except httpx.TimeoutException:
        raise TranscriptionError("Transcription took too long. Try a shorter recording.")
    except httpx.HTTPError:
        raise TranscriptionError("Could not reach the transcription service.")

    if response.status_code == 401:
        raise TranscriptionError("The transcription key was rejected.")
    if response.status_code == 429:
        raise TranscriptionError("Transcription is busy right now. Try again in a moment.")
    if response.status_code >= 400:
        raise TranscriptionError(f"Transcription failed ({response.status_code}).")

    text = (response.json().get("text") or "").strip()
    if not text:
        raise TranscriptionError("Nothing could be made out in that recording.")
    return text
