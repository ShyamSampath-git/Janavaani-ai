"""JANAVAANI AI FastAPI entrypoint.

Run locally from the backend folder:

    .\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --port 8000
"""

from io import BytesIO
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.document_qa import answer_question
from app.pdf_extract import extract_document_text
from app.transcribe import transcribe_with_prisma
from app.tts import generate_speech


load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
}

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/x-pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
}


class AskRequest(BaseModel):
    document_text: str
    question: str
    language: str = "en"


class SpeakRequest(BaseModel):
    text: str
    language: str = "en"


app = FastAPI(
    title="JANAVAANI AI",
    description=(
        "Voice-first assistant for understanding "
        "public-service documents."
    ),
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "supported_documents": [
            "PDF",
            "JPG",
            "JPEG",
            "PNG",
        ],
    }


@app.post("/documents/extract")
async def extract_document(file: UploadFile = File(...)):
    filename = file.filename or "upload"
    content_type = (file.content_type or "").lower()

    extension = Path(filename).suffix.lower()

    if (
        extension not in ALLOWED_EXTENSIONS
        and content_type not in ALLOWED_CONTENT_TYPES
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload a PDF, JPG, JPEG, or PNG file."
            ),
        )

    data = await file.read()

    if not data:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    if len(data) > MAX_DOCUMENT_BYTES:
        raise HTTPException(
            status_code=400,
            detail="File is larger than 10 MB.",
        )

    try:
        return extract_document_text(
            data,
            filename,
            content_type,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language_code: str = Form("te-IN"),
):
    audio_bytes = await file.read()

    filename = file.filename or "recording.wav"
    content_type = file.content_type or "audio/wav"

    return await transcribe_with_prisma(
        audio_bytes,
        filename,
        content_type,
        language_code,
    )


@app.post("/api/ask")
async def ask_document(request: AskRequest):
    return await answer_question(
        request.document_text,
        request.question,
        request.language,
    )


@app.post("/api/speak")
def speak_answer(request: SpeakRequest):
    audio = generate_speech(
        request.text,
        request.language,
    )

    return StreamingResponse(
        BytesIO(audio),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition":
                'inline; filename="janavaani_answer.mp3"'
        },
    )