import { useEffect, useRef, useState } from 'react'

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const MAX_SECONDS = 60

function pickRecorderMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]

  return (
    types.find((type) => window.MediaRecorder?.isTypeSupported(type)) || ''
  )
}

function resample(channelData, fromRate, toRate) {
  if (fromRate === toRate) {
    return channelData
  }

  const ratio = fromRate / toRate
  const length = Math.round(channelData.length / ratio)
  const output = new Float32Array(length)

  for (let i = 0; i < length; i += 1) {
    const position = i * ratio
    const index = Math.floor(position)
    const next = Math.min(index + 1, channelData.length - 1)
    const weight = position - index

    output[i] =
      channelData[index] * (1 - weight) +
      channelData[next] * weight
  }

  return output
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  function writeString(offset, value) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44

  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]))

    view.setInt16(
      offset,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    )

    offset += 2
  }

  return new Blob([buffer], {
    type: 'audio/wav',
  })
}

async function blobToWav(blob) {
  const audioContext = new AudioContext()

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const input = audioBuffer.getChannelData(0)

    const samples = resample(
      input,
      audioBuffer.sampleRate,
      16000,
    )

    return encodeWav(samples, 16000)
  } finally {
    await audioContext.close()
  }
}

function VoiceRecorder({ onTranscript }) {
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [transcript, setTranscript] = useState('')
  const [language, setLanguage] = useState('te-IN')
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }

      if (
        recorderRef.current &&
        recorderRef.current.state !== 'inactive'
      ) {
        recorderRef.current.stop()
      }
    }
  }, [])

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  async function startRecording() {
    setError('')
    setTranscript('')
    setSeconds(0)

    if (
      !navigator.mediaDevices?.getUserMedia ||
      !window.MediaRecorder
    ) {
      setStatus('error')
      setError('Audio recording is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      const mimeType = pickRecorderMimeType()

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        clearTimer()

        const raw = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })

        await sendRecording(raw)
      }

      recorderRef.current = recorder
      recorder.start()

      setStatus('recording')

      timerRef.current = setInterval(() => {
        setSeconds((value) => {
          if (value + 1 >= MAX_SECONDS) {
            stopRecording()
            return MAX_SECONDS
          }

          return value + 1
        })
      }, 1000)
    } catch (err) {
      setStatus('error')
      setError(
        err.message || 'Microphone permission was denied.',
      )
    }
  }

  function stopRecording() {
    clearTimer()

    const recorder = recorderRef.current

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }

  async function sendRecording(blob) {
    setStatus('loading')

    try {
      const wav = await blobToWav(blob)

      const formData = new FormData()

      formData.append('file', wav, 'recording.wav')
      formData.append('language_code', language)

      const response = await fetch(`${API_BASE}/api/transcribe`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.detail || 'Could not understand the recording.',
        )
      }

      const text = data.transcript || ''

      setTranscript(text)
      setStatus('success')

      if (text && onTranscript) {
        onTranscript(text, language)
      }
    } catch (err) {
      setStatus('error')
      setError(
        err.message || 'Could not transcribe this recording.',
      )
    }
  }

  const isRecording = status === 'recording'
  const isLoading = status === 'loading'

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Ask with your voice
          </p>

          <p className="mt-0.5 text-xs text-slate-500">
            Speak naturally for up to {MAX_SECONDS} seconds
          </p>
        </div>

        <select
          value={language}
          disabled={isRecording || isLoading}
          onChange={(event) => setLanguage(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-600"
        >
          <option value="te-IN">తెలుగు</option>
          <option value="en-IN">English</option>
        </select>
      </div>

      <div className="mt-4 flex flex-col items-center rounded-xl border border-slate-200 bg-white px-4 py-5">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl text-white shadow-sm transition ${
            isRecording
              ? 'animate-pulse bg-red-600 hover:bg-red-700'
              : 'bg-emerald-700 hover:bg-emerald-800'
          } disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label={
            isRecording ? 'Stop recording' : 'Start recording'
          }
        >
          {isRecording ? '■' : '🎙'}
        </button>

        <p className="mt-3 text-sm font-semibold text-slate-800">
          {isRecording
            ? `Listening... ${seconds}s`
            : isLoading
              ? 'Understanding your voice...'
              : status === 'success'
                ? 'Voice understood'
                : status === 'error'
                  ? 'Could not process voice'
                  : 'Tap to speak'}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {isRecording
            ? 'Tap the button again when you finish'
            : isLoading
              ? 'Gnani Prisma is transcribing your speech'
              : 'Your transcript will appear below'}
        </p>

        {isLoading ? (
          <div className="mt-4 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-600" />
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700">
            {error}
          </p>
        </div>
      ) : null}

      {status === 'success' && transcript ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-[10px] text-white">
              ✓
            </span>

            <p className="text-xs font-semibold text-emerald-900">
              Voice transcript
            </p>
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-700">
            {transcript}
          </p>

          <p className="mt-2 text-[11px] text-emerald-700">
            Added to your question automatically
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default VoiceRecorder