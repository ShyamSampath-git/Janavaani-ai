"""Extract text from PDFs and images with OCR fallback."""

import io
import os
from pathlib import Path

import fitz
from PIL import Image


MIN_TEXT_LENGTH = 30
OCR_DPI = 200
OCR_LANGUAGES = "eng+tel"

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
}


def get_tessdata_path() -> str:
    custom_path = os.getenv("TESSDATA_PREFIX")

    if custom_path and Path(custom_path).is_dir():
        return custom_path

    windows_path = Path(
        r"C:\Program Files\Tesseract-OCR\tessdata"
    )

    if windows_path.is_dir():
        return str(windows_path)

    linux_paths = [
        Path("/usr/share/tesseract-ocr/5/tessdata"),
        Path("/usr/share/tesseract-ocr/4.00/tessdata"),
        Path("/usr/share/tesseract-ocr/tessdata"),
    ]

    for path in linux_paths:
        if path.is_dir():
            return str(path)

    raise ValueError(
        "Tesseract language data could not be found."
    )


def has_enough_text(text: str) -> bool:
    cleaned = " ".join(text.split())
    return len(cleaned) >= MIN_TEXT_LENGTH


def extract_page_with_ocr(page: fitz.Page) -> str:
    try:
        text_page = page.get_textpage_ocr(
            language=OCR_LANGUAGES,
            dpi=OCR_DPI,
            full=True,
            tessdata=get_tessdata_path(),
        )

        return page.get_text(
            "text",
            textpage=text_page,
        ).strip()

    except Exception as exc:
        print("OCR error:", exc)
        return ""


def extract_pdf_text(
    data: bytes,
    filename: str,
) -> dict:
    try:
        document = fitz.open(
            stream=data,
            filetype="pdf",
        )

    except Exception as exc:
        raise ValueError(
            "Could not read this file as a PDF."
        ) from exc

    pages = []
    ocr_pages = 0

    with document:
        page_count = document.page_count

        for page in document:
            normal_text = page.get_text("text").strip()

            if has_enough_text(normal_text):
                pages.append(normal_text)
                continue

            ocr_text = extract_page_with_ocr(page)

            if ocr_text:
                pages.append(ocr_text)
                ocr_pages += 1

            elif normal_text:
                pages.append(normal_text)

    text = "\n\n".join(
        part for part in pages if part
    ).strip()

    if not text:
        message = (
            "No readable text could be extracted from this PDF."
        )

    elif ocr_pages == 0:
        message = (
            "Extracted selectable text from the PDF."
        )

    elif ocr_pages == page_count:
        message = (
            "Extracted text from the scanned PDF using OCR."
        )

    else:
        message = (
            f"Extracted document text with OCR used on "
            f"{ocr_pages} of {page_count} pages."
        )

    return {
        "filename": filename,
        "page_count": page_count,
        "text": text,
        "message": message,
        "ocr_pages": ocr_pages,
        "document_type": "pdf",
    }


def extract_image_text(
    data: bytes,
    filename: str,
) -> dict:
    try:
        image = Image.open(io.BytesIO(data))

        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        image_bytes = io.BytesIO()

        image.save(
            image_bytes,
            format="PNG",
        )

        image_bytes.seek(0)

    except Exception as exc:
        raise ValueError(
            "Could not read this image."
        ) from exc

    try:
        document = fitz.open()

        page = document.new_page(
            width=image.width,
            height=image.height,
        )

        page.insert_image(
            page.rect,
            stream=image_bytes.getvalue(),
        )

        text = extract_page_with_ocr(page)

        document.close()

    except Exception as exc:
        raise ValueError(
            "Could not process this image with OCR."
        ) from exc

    if text:
        message = (
            "Extracted text from the image using OCR."
        )
    else:
        message = (
            "No readable text could be found in this image."
        )

    return {
        "filename": filename,
        "page_count": 1,
        "text": text,
        "message": message,
        "ocr_pages": 1 if text else 0,
        "document_type": "image",
    }


def extract_document_text(
    data: bytes,
    filename: str,
    content_type: str,
) -> dict:
    lower_name = filename.lower()

    if (
        content_type in (
            "application/pdf",
            "application/x-pdf",
        )
        or lower_name.endswith(".pdf")
    ):
        return extract_pdf_text(
            data,
            filename,
        )

    if (
        content_type in ALLOWED_IMAGE_TYPES
        or lower_name.endswith(
            (".jpg", ".jpeg", ".png")
        )
    ):
        return extract_image_text(
            data,
            filename,
        )

    raise ValueError(
        "Please upload a PDF, JPG, JPEG, or PNG file."
    )