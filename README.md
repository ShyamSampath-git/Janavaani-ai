# JANAVAANI AI

JANAVAANI AI is a multilingual, voice-first helper for Indian citizens. It will explain government notices, scholarship rejection letters, and other public-service documents in plain language.

This is the **Gnani AI Internship Challenge 2026** project. You can upload a PDF and extract selectable text, and record short speech for Gnani Prisma transcription. OCR, authentication, and a database are not wired up yet.

## Tech stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Python FastAPI
- Document text: PyMuPDF
- Speech-to-text: Gnani Prisma REST (`POST https://api.vachana.ai/stt/v3`)
- Planned later: Gnani Timbre v3.0 (text-to-speech), OCR, a document-grounded LLM

## Local setup

You need **Node.js** (npm) and **Python 3.11+**. Commands below are for PowerShell.

### Backend

```powershell
cd "C:\Users\shyam\OneDrive\Desktop\internship proj\backend"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Run those commands from the `backend` folder. The virtual environment lives there, not in the project root.

The API runs at `http://127.0.0.1:8000`.

- Health: `http://127.0.0.1:8000/health` → `{"status":"ok"}`
- Docs: `http://127.0.0.1:8000/docs`
- `GET /` is empty on purpose (404). Use `/health` or `/docs`.

If PowerShell blocks `Activate.ps1`, keep using `.\.venv\Scripts\python.exe -m ...` as shown above.

### Frontend

Open a second terminal:

```powershell
cd "C:\Users\shyam\OneDrive\Desktop\internship proj\frontend"
copy .env.example .env
npm.cmd install
npm.cmd run dev
```

Use `npm.cmd` if PowerShell says `npm.ps1` cannot be loaded because scripts are disabled.

The app runs at `http://localhost:5173`.

### Try Prisma speech-to-text

1. Put your Gnani key in `backend/.env` as `GNANI_API_KEY=...` (not in the frontend).
2. Restart the backend after changing `.env`.
3. Open `http://localhost:5173`, choose Telugu or English, click **Start recording**, speak, then **Stop recording**.
4. The browser records with MediaRecorder, converts the clip to 16 kHz WAV (a Prisma-supported format), and posts it to `POST /api/transcribe`.
5. The backend forwards the file to Prisma with the `X-API-Key-ID` header. You should see Telugu or English text in the app.

Keep clips under 60 seconds. If transcription fails, check the microphone permission and that the backend can reach `https://api.vachana.ai`.

### Try PDF extraction

1. Start backend and frontend.
2. Open the app and choose a PDF with selectable text (not a scanned image-only PDF).
3. Click **Extract text**. You should see the filename, page count, and extracted text.

Scanned PDFs will return a message that OCR is not enabled yet.

### Production-style frontend build

```powershell
cd frontend
npm.cmd run build
```

## Notes

- Copy `.env.example` to `.env` in each folder. Do not put real API keys in git.
- Gnani Prisma, Gnani Timbre, OCR, login, and a database will be added in later steps.
