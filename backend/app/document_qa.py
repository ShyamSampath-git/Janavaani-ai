import os
import re

import httpx
from fastapi import HTTPException


MAX_CHUNK_CHARS = 1800
CHUNK_OVERLAP = 250
TOP_K_CHUNKS = 4

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/"
    f"models/{GEMINI_MODEL}:generateContent"
)


def clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_document(text: str) -> list[str]:
    text = clean_text(text)

    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + MAX_CHUNK_CHARS, len(text))
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end == len(text):
            break

        start = max(end - CHUNK_OVERLAP, start + 1)

    return chunks


def tokenize(text: str) -> set[str]:
    return set(
        re.findall(
            r"\w+",
            text.lower(),
            flags=re.UNICODE,
        )
    )


def find_relevant_chunks(
    document_text: str,
    question: str,
    top_k: int = TOP_K_CHUNKS,
) -> list[str]:
    chunks = chunk_document(document_text)

    if not chunks:
        return []

    question_words = tokenize(question)

    if not question_words:
        return chunks[:top_k]

    scored = []

    for chunk in chunks:
        chunk_words = tokenize(chunk)
        score = len(question_words & chunk_words)

        scored.append((score, chunk))

    scored.sort(
        key=lambda item: item[0],
        reverse=True,
    )

    relevant = [
        chunk
        for score, chunk in scored
        if score > 0
    ]

    if not relevant:
        return chunks[:top_k]

    return relevant[:top_k]


def build_context(
    document_text: str,
    question: str,
) -> str:
    chunks = find_relevant_chunks(
        document_text,
        question,
    )

    return "\n\n---\n\n".join(chunks)


def _gemini_api_key() -> str:
    key = os.getenv("GEMINI_API_KEY")

    if not key:
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is not configured.",
        )

    return key


def clean_answer(answer: str) -> str:
    answer = answer.strip()

    answer = re.sub(
        r"\*\*(.*?)\*\*",
        r"\1",
        answer,
    )

    answer = re.sub(
        r"^\s*[\*\-]\s+",
        "• ",
        answer,
        flags=re.MULTILINE,
    )

    return answer.strip()


async def answer_question(
    document_text: str,
    question: str,
    language: str = "en",
) -> dict:
    if not document_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Document text is empty.",
        )

    if not question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty.",
        )

    context = build_context(
        document_text,
        question,
    )

    if not context:
        raise HTTPException(
            status_code=400,
            detail="Could not find usable text in the document.",
        )

    response_language = (
        "Telugu"
        if language.lower().startswith("te")
        else "English"
    )

    prompt = f"""
You are JANAVAANI AI, a citizen-friendly assistant that explains
government and public-service documents.

Your task is to answer the user's question using ONLY the document
context provided below.

IMPORTANT RULES:

1. Use only information found in the document context.

2. Never use outside knowledge, assumptions, or invented details.

3. Answer the exact question asked.

4. Give a complete answer, not a vague answer.

For example, instead of:
"This is conducted by the government."

Prefer:
"This scheme is conducted by the Department of Higher Education,
Government of Andhra Pradesh."

But only include those details when they are present in the document.

5. Preserve important facts exactly, especially:
- dates
- amounts
- percentages
- department names
- scheme names
- eligibility conditions
- required documents

6. If the user asks for one specific fact, answer that fact directly.
Do not add unrelated information.

7. If the question asks for multiple things, answer each requested
item clearly.

8. If the requested information is not present in the document,
say clearly that it could not be found in the uploaded document.

9. Do not output Markdown formatting.
Do not use **bold**, headings with #, or Markdown asterisks.

10. If a list is necessary, use simple bullet points beginning with •.

11. Use clear language that an ordinary citizen can understand.

12. Answer in {response_language}.

13. Keep the answer concise unless the question requires explanation.

DOCUMENT CONTEXT:

{context}

USER QUESTION:

{question}

Answer only the user's question.
""".strip()

    headers = {
        "x-goog-api-key": _gemini_api_key(),
        "Content-Type": "application/json",
    }

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt,
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 500,
        },
    }

    try:
        async with httpx.AsyncClient(
            timeout=60.0
        ) as client:
            response = await client.post(
                GEMINI_URL,
                headers=headers,
                json=payload,
            )

    except httpx.RequestError:
        raise HTTPException(
            status_code=502,
            detail="Could not reach Gemini.",
        ) from None

    try:
        data = response.json()

    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an unreadable response.",
        ) from None

    if response.status_code >= 400:
        error = data.get("error", {})
        message = error.get("message")

        raise HTTPException(
            status_code=502,
            detail=message or "Gemini request failed.",
        )

    try:
        answer = (
            data["candidates"][0]
            ["content"]["parts"][0]["text"]
        )

    except (KeyError, IndexError, TypeError):
        raise HTTPException(
            status_code=502,
            detail="Gemini did not return an answer.",
        ) from None

    answer = clean_answer(answer)

    return {
        "answer": answer,
        "language": language,
        "evidence": context,
    }