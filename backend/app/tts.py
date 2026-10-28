import os

from fastapi import HTTPException
from gnani.tts import AudioConfig, GnaniTTSClient


def _api_key() -> str:
    key = os.getenv("GNANI_API_KEY")

    if not key:
        raise HTTPException(
            status_code=503,
            detail="Text-to-speech is not configured on the server.",
        )

    return key


def generate_speech(
    text: str,
    language: str = "en",
) -> bytes:
    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty.",
        )

    if len(text) > 5000:
        raise HTTPException(
            status_code=400,
            detail="Text is too long for speech generation.",
        )

    language_code = (
        "te-IN"
        if language.lower().startswith("te")
        else "en-IN"
    )

    try:
        client = GnaniTTSClient(
            api_key=_api_key(),
        )

        audio = client.synthesize(
            text.strip(),
            voice="Kaveri",
            model="timbre-v2.5",
            language=language_code,
            speed=1.0,
            audio_config=AudioConfig(
                container="mp3",
                sample_rate=48000,
                bitrate="128k",
            ),
        )

        return audio

    except HTTPException:
        raise

    except Exception as exc:
        print("Timbre error:", exc)

        raise HTTPException(
            status_code=502,
            detail="Could not generate speech with Gnani Timbre.",
        ) from exc