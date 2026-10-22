import { useEffect, useRef, useState } from 'react'
import { Mic, Square, RotateCcw, Play, Pause, LoaderCircle, FileText } from 'lucide-react'
import { api } from '../lib/api'

const MAX_SECONDS = 180

const LANGUAGE = 'en-IN'

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

/**
 * Records the complaint and transcribes it live in the browser.
 *
 * The Web Speech API gives an instant transcript with no server, which is
 * what makes this usable today. The audio itself is kept as a Blob so the
 * same recording can be sent to Whisper for a better transcript later.
 */
export default function VoiceRecorder({ transcript, onTranscript, onAudio }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [interim, setInterim] = useState('')
  const [audioUrl, setAudioUrl] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const [transcribing, setTranscribing] = useState(false)

  const recognitionRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const audioRef = useRef(null)
  const finalRef = useRef('')
  const interimRef = useRef('')
  const blobRef = useRef(null)
  // State is stale inside the recognition callbacks, which outlive the render
  // that created them, so the restart logic reads this instead.
  const wantedRef = useRef(false)
  const heardRef = useRef(false)

  useEffect(() => () => stopEverything(), [])

  function stopEverything() {
    wantedRef.current = false
    clearInterval(timerRef.current)
    try { recognitionRef.current?.stop() } catch { /* already stopped */ }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recorderRef.current?.stream?.getTracks().forEach((t) => t.stop())
  }

  /**
   * Transcribe the recording on the server.
   *
   * This is what makes voice work at all in Firefox, and on any Chrome
   * whose speech service cannot be reached. The student never has to know
   * which route produced their words.
   */
  async function transcribeOnServer(blob) {
    if (!blob || !blob.size) return
    setTranscribing(true)
    setError('')
    try {
      const { transcript: text } = await api.transcribeAudio(blob)
      if (text) {
        finalRef.current = `${text.trim()} `
        onTranscript(finalRef.current)
      }
    } catch (err) {
      setError(`${err.message} Your audio is saved — type the complaint in the review box.`)
    } finally {
      setTranscribing(false)
    }
  }

  /** Keep whatever has been heard so far, finalised or not. */
  function commitInterim() {
    const pending = interimRef.current.trim()
    if (!pending) return
    finalRef.current += `${pending} `
    interimRef.current = ''
    setInterim('')
    onTranscript(finalRef.current)
  }

  async function start() {
    setError('')
    finalRef.current = transcript ? `${transcript.trim()} ` : ''

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone access was blocked. Allow it in your browser settings, then try again.')
      return
    }

    chunksRef.current = []
    const recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      setAudioUrl(URL.createObjectURL(blob))
      onAudio?.(blob)
      blobRef.current = blob
      stream.getTracks().forEach((t) => t.stop())
      // The browser gets first go because it is instant. If it produced
      // nothing, the recording is all we have, so send it to the server.
      if (!finalRef.current.trim()) transcribeOnServer(blob)
    }
    recorder.start()
    recorderRef.current = recorder

    if (SpeechRecognition) {
      heardRef.current = false
      wantedRef.current = true
      startRecognition()
    } else {
      setError('This browser cannot transcribe live. The audio is still recorded — type the details in the review box.')
    }

    setSeconds(0)
    setRecording(true)
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) { stop(); return MAX_SECONDS }
        return s + 1
      })
    }, 1000)
  }

  /**
   * Chrome ends a recognition session on its own after a short silence, even
   * with continuous = true, and simply stops transcribing from then on. So
   * every session is restarted for as long as the student is still recording.
   */
  function startRecognition() {
    const recognition = new SpeechRecognition()
    recognition.lang = LANGUAGE
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let live = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript
        if (event.results[i].isFinal) finalRef.current += `${chunk.trim()} `
        else live += chunk
      }
      heardRef.current = true
      interimRef.current = live
      setInterim(live)
      onTranscript(finalRef.current)
    }

    recognition.onerror = (e) => {
      // Silence is not a failure — the restart below picks it back up.
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantedRef.current = false
        setError('Chrome blocked the microphone for transcription. Allow it from the icon in the address bar, then record again.')
        return
      }
      if (e.error === 'network') {
        wantedRef.current = false
        setError('Transcription needs an internet connection — Chrome sends the audio to Google. The audio is still recorded; type the details in the review box.')
        return
      }
      wantedRef.current = false
      setError(`Live transcription stopped (${e.error}). The audio is still recorded — type the details in the review box.`)
    }

    recognition.onend = () => {
      commitInterim()
      if (!wantedRef.current) return
      try {
        recognition.start()
      } catch {
        // Chrome refuses a restart that lands too soon; try once more.
        setTimeout(() => { if (wantedRef.current) { try { recognition.start() } catch { /* give up */ } } }, 250)
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch {
      setError('Live transcription could not start. The audio is still recorded — type the details in the review box.')
    }
  }

  function stop() {
    commitInterim()          // never throw away what was heard
    stopEverything()
    setRecording(false)
    setInterim('')
    // Nothing is said about the browser failing to transcribe: the server
    // is about to try, and a warning the student cannot act on is noise.
  }

  function reset() {
    stopEverything()
    setRecording(false)
    setError('')
    finalRef.current = ''
    interimRef.current = ''
    setInterim('')
    setSeconds(0)
    setAudioUrl(null)
    onTranscript('')
    onAudio?.(null)
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="rounded-2xl border border-hairline bg-white p-6 shadow-card sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-orange-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-700">
          Step 2: Describe the issue
        </span>
      </div>

      <div className="flex flex-col items-center py-4">
        <h3 className="text-xl font-semibold text-ink">
          {recording
            ? 'Listening…'
            : transcribing
              ? 'Writing it out…'
              : audioUrl ? 'Recording saved' : 'Tap to start recording'}
        </h3>

        <div className="relative my-7">
          {recording && <span className="absolute inset-0 animate-ping rounded-full bg-orange-400/40" />}
          <button
            type="button"
            onClick={recording ? stop : start}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            className={`relative grid h-24 w-24 place-items-center rounded-full text-white transition
                        ${recording ? 'bg-purple-500 hover:bg-purple-600' : 'bg-orange-500 shadow-glow hover:bg-orange-600'}`}
          >
            {recording ? <Square className="h-8 w-8" fill="currentColor" /> : <Mic className="h-9 w-9" strokeWidth={2} />}
          </button>
        </div>

        <Waveform active={recording} />

        <p className="mt-5 text-sm text-ink-mute">
          {recording
            ? `${mmss} — tap the square to finish`
            : 'Speak clearly into your microphone. Up to 3 minutes.'}
        </p>

        {interim && <p className="mt-4 max-w-lg text-center text-sm italic text-ink-mute">{interim}</p>}

        {transcribing && (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-purple-600">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Transcribing your recording — a few seconds.
          </p>
        )}

        {audioUrl && !recording && (
          <div className="mt-6 flex items-center gap-3">
            <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
            <button
              type="button"
              onClick={() => {
                if (playing) { audioRef.current.pause(); setPlaying(false) }
                else { audioRef.current.play(); setPlaying(true) }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-50 px-4 py-2.5 text-sm font-semibold text-purple-600 hover:bg-purple-100"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? 'Pause' : 'Play back'}
            </button>
            <button
              type="button"
              onClick={() => transcribeOnServer(blobRef.current)}
              disabled={transcribing}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-purple-600 hover:bg-purple-50 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> Transcribe again
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-canvas"
            >
              <RotateCcw className="h-4 w-4" /> Record again
            </button>
          </div>
        )}

        {error && <p className="mt-5 max-w-sm text-center text-sm text-orange-700">{error}</p>}
      </div>
    </div>
  )
}

function Waveform({ active }) {
  const bars = [14, 26, 40, 30, 46, 22, 34, 18, 38, 24, 12]
  return (
    <div className="flex h-12 items-end gap-1.5" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-full transition-all duration-300 ${active ? 'bg-orange-400' : 'bg-gray-200'}`}
          style={{
            height: active ? `${h}px` : '10px',
            animation: active ? `pulse 900ms ease-in-out ${i * 80}ms infinite alternate` : 'none',
          }}
        />
      ))}
      <style>{`@keyframes pulse { from { transform: scaleY(.45) } to { transform: scaleY(1) } }`}</style>
    </div>
  )
}
