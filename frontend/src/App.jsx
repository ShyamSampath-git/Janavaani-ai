import { useEffect, useState } from 'react'
import VoiceRecorder from './VoiceRecorder.jsx'
import janavaaniLogo from './assets/logo.png'

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function App() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [showText, setShowText] = useState(false)

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [asking, setAsking] = useState(false)
  const [answerError, setAnswerError] = useState('')
  const [language, setLanguage] = useState('en')

  const [audioUrl, setAudioUrl] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [showEvidence, setShowEvidence] = useState(false)

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  function clearAudio() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl('')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setResult(null)
    setAnswer(null)
    setAnswerError('')
    setSpeechError('')
    setShowEvidence(false)
    setShowText(false)
    clearAudio()

    if (!file) {
      setError('Choose a PDF document first.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/documents/extract`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.detail || 'Could not read this PDF.',
        )
      }

      setResult(data)
    } catch (err) {
      setError(err.message || 'Could not reach the backend.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAsk(event) {
    event.preventDefault()

    setAnswerError('')
    setAnswer(null)
    setSpeechError('')
    setShowEvidence(false)
    clearAudio()

    if (!result?.text) {
      setAnswerError('Upload and process a PDF first.')
      return
    }

    if (!question.trim()) {
      setAnswerError('Enter a question about the document.')
      return
    }

    setAsking(true)

    try {
      const response = await fetch(`${API_BASE}/api/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_text: result.text,
          question: question.trim(),
          language,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.detail || 'Could not answer the question.',
        )
      }

      setAnswer(data)
    } catch (err) {
      setAnswerError(err.message || 'Could not reach the backend.')
    } finally {
      setAsking(false)
    }
  }

  async function handleSpeak() {
    if (!answer?.answer) return

    setSpeechError('')
    setSpeaking(true)
    clearAudio()

    try {
      const response = await fetch(`${API_BASE}/api/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: answer.answer,
          language: answer.language || language,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))

        throw new Error(
          data.detail || 'Could not generate speech.',
        )
      }

      const blob = await response.blob()
      setAudioUrl(URL.createObjectURL(blob))
    } catch (err) {
      setSpeechError(
        err.message || 'Could not generate speech.',
      )
    } finally {
      setSpeaking(false)
    }
  }

  function handleVoiceTranscript(text, voiceLanguage) {
    setQuestion(text)

    if (voiceLanguage.startsWith('te')) {
      setLanguage('te')
    } else {
      setLanguage('en')
    }
  }

  function resetDocument() {
    setFile(null)
    setResult(null)
    setQuestion('')
    setAnswer(null)
    setError('')
    setAnswerError('')
    setSpeechError('')
    setShowEvidence(false)
    setShowText(false)
    clearAudio()
  }

  return (
    <main className="min-h-screen bg-[#f8faf9] text-slate-800">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <div className="flex items-center">
            <img
              src={janavaaniLogo}
              alt="JANAVAANI AI"
              className="h-12 w-auto object-contain sm:h-14"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Voice enabled
            </div>

            <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  language === 'en'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                English
              </button>

              <button
                type="button"
                onClick={() => setLanguage('te')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  language === 'te'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                తెలుగు
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-100/40 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-5 py-14 text-center sm:px-8 sm:py-20">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            AI for accessible public information
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Government notices,
            <span className="text-emerald-700"> made easier to understand.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Upload a public-service document and ask questions using
            your voice or text. JANAVAANI explains the information
            clearly in English or Telugu.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              <span className="text-emerald-700">✓</span>
              Document-grounded
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              <span className="text-emerald-700">✓</span>
              English + తెలుగు
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              <span className="text-emerald-700">✓</span>
              Voice-first
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold text-emerald-700">
            THREE SIMPLE STEPS
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
            Upload. Ask. Understand.
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-bold text-emerald-700">
                  1
                </div>

                <div>
                  <h3 className="font-semibold text-slate-950">
                    Add your document
                  </h3>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Government notice or public-service PDF
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {!result ? (
                <form onSubmit={handleSubmit}>
                  <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center transition hover:border-emerald-500 hover:bg-emerald-50/60">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105">
                      📄
                    </div>

                    <p className="mt-4 text-sm font-semibold text-slate-800">
                      {file
                        ? file.name
                        : 'Choose a PDF or notice image'}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                    PDF, JPG or PNG · Up to 10 MB
                    </p>

                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                      onChange={(event) =>
                        setFile(event.target.files?.[0] ?? null)
                      }
                      className="hidden"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Reading document...
                      </>
                    ) : (
                      <>Process document →</>
                    )}
                  </button>
                </form>
              ) : (
                <div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-lg text-white">
                        ✓
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-emerald-950">
                          Document ready
                        </p>

                        <p className="mt-1 truncate text-sm text-emerald-800">
                          {result.filename}
                        </p>

                        <p className="mt-1 text-xs text-emerald-700">
                          {result.page_count} page
                          {result.page_count === 1 ? '' : 's'} processed
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowText((value) => !value)}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {showText
                        ? 'Hide document text'
                        : 'View document text'}
                    </button>

                    <button
                      type="button"
                      onClick={resetDocument}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                    >
                      Change PDF
                    </button>
                  </div>

                  {showText ? (
                    <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                      {result.text}
                    </pre>
                  ) : null}
                </div>
              )}

              {error ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-lg font-bold text-orange-600">
                  2
                </div>

                <div>
                  <h3 className="font-semibold text-slate-950">
                    Ask JANAVAANI
                  </h3>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Speak naturally or type your question
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <VoiceRecorder
                onTranscript={handleVoiceTranscript}
              />

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />

                <span className="text-xs font-medium text-slate-400">
                  OR TYPE YOUR QUESTION
                </span>

                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form
                onSubmit={handleAsk}
                className="flex flex-col gap-4"
              >
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={4}
                  placeholder={
                    result
                      ? 'What would you like to know about this document?'
                      : 'Process a document first...'
                  }
                  className="resize-none rounded-2xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                />

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    Answer in{' '}
                    <span className="font-semibold text-slate-600">
                      {language === 'te' ? 'తెలుగు' : 'English'}
                    </span>
                  </p>

                  <button
                    type="submit"
                    disabled={asking || !result}
                    className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {asking
                      ? 'Finding information...'
                      : 'Ask JANAVAANI →'}
                  </button>
                </div>
              </form>

              {answerError ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {answerError}
                </p>
              ) : null}
            </div>
          </section>
        </div>

        {answer ? (
          <section className="mt-7 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-emerald-100 bg-emerald-50/70 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-700 text-lg text-white">
                  ✦
                </div>

                <div>
                  <p className="font-semibold text-emerald-950">
                    JANAVAANI Answer
                  </p>

                  <p className="mt-0.5 text-xs text-emerald-700">
                    Generated from your uploaded document
                  </p>
                </div>
              </div>

              <span className="hidden rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 sm:block">
                Document-grounded
              </span>
            </div>

            <div className="p-6 sm:p-8">
              <p className="whitespace-pre-wrap text-base leading-8 text-slate-800 sm:text-lg">
                {answer.answer}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSpeak}
                  disabled={speaking}
                  className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
                >
                  {speaking ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Preparing voice...
                    </>
                  ) : (
                    <>🔊 Listen to answer</>
                  )}
                </button>

                {answer.evidence ? (
                  <button
                    type="button"
                    onClick={() =>
                      setShowEvidence((value) => !value)
                    }
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {showEvidence
                      ? 'Hide source'
                      : 'View source'}
                  </button>
                ) : null}
              </div>

              {speechError ? (
                <p className="mt-4 text-sm text-red-700">
                  {speechError}
                </p>
              ) : null}

              {audioUrl ? (
                <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-semibold text-slate-500">
                    JANAVAANI VOICE RESPONSE
                  </p>

                  <audio
                    className="w-full"
                    controls
                    autoPlay
                    src={audioUrl}
                  />
                </div>
              ) : null}

              {showEvidence && answer.evidence ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Source from your document
                    </p>

                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      VERIFIED CONTEXT
                    </span>
                  </div>

                  <p className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {answer.evidence}
                  </p>

                  <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                    JANAVAANI uses this retrieved section of the uploaded
                    document when generating its response.
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              ✓
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-900">
              Document-grounded
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Answers are based on information retrieved from your
              uploaded document.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              ◉
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-900">
              Voice-first
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Ask naturally using your voice and listen to the
              response.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              अ
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-900">
              Regional-language access
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Built to make important public information easier to
              access across languages.
            </p>
          </div>
        </section>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-7 text-center sm:flex-row sm:px-8 sm:text-left">
          <img
            src={janavaaniLogo}
            alt="JANAVAANI AI"
            className="h-9 w-auto object-contain"
          />

          <p className="text-xs text-slate-400">
            Built for the Gnani AI Great Indian AI Internship Challenge 2026
          </p>
        </div>
      </footer>
    </main>
  )
}

export default App