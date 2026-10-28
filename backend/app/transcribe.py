"""Forward short audio clips to Gnani Prisma STT (REST).

Documented at https://docs.gnani.ai/api/STT/speech-to-text

POST https://api.vachana.ai/stt/v3
Header: X-API-Key-ID
Form fields: audio_file, language_code
"""

import os

import httpx
from fastapi import HTTPException

GNANI_STT_URL = "https://api.vachana.ai/stt/v3"
ALLOWED_LANGUAGES = {"en-IN", "te-IN"}
MAX_AUDIO_BYTES = 8 * 1024 * 1024


def _api_key() -> str:
    key = os.getenv("GNANI_API_KEY") or os.getenv("GNANI_PRISMA_API_KEY")
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Speech-to-text is not configured on the server.",
        )
    return key


async def transcribe_with_prisma(
    audio_bytes: bytes,
    filename: str,
    content_type: str,
    language_code: str,
) -> dict:
    if language_code not in ALLOWED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail="Language must be en-IN or te-IN.",
        )
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="The audio recording is empty.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="Audio file is too large.")

    headers = {"X-API-Key-ID": _api_key()}
    files = {
        "audio_file": (
            filename,
            audio_bytes,
            content_type or "audio/wav",
        )
    }
    form = {"language_code": language_code}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                GNANI_STT_URL,
                headers=headers,
                files=files,
                data=form,
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=502,
            detail="Could not reach the speech-to-text service.",
        ) from None

    try:
        payload = response.json()
    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="Speech-to-text service returned an unreadable response.",
        ) from None

    if response.status_code >= 400 or not payload.get("success"):
        error = payload.get("error") if isinstance(payload, dict) else None
        message = None
        if isinstance(error, dict):
            message = error.get("message")
        raise HTTPException(
            status_code=502,
            detail=message or "Speech-to-text did not complete.",
        )

    return {
        "transcript": payload.get("transcript") or "",
        "language_code": language_code,
    }
