import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, CircleCheck, TriangleAlert, LoaderCircle } from 'lucide-react'
import VoiceRecorder from '../../components/VoiceRecorder'
import EvidenceUploader from '../../components/EvidenceUploader'
import { Button, Card, Notice, PageHeading } from '../../components/Ui'
import { api } from '../../lib/api'

const CATEGORIES = ['Academic', 'Hostel', 'Infrastructure', 'Dining', 'IT Support']

export default function NewComplaint() {
  const navigate = useNavigate()

  const [category, setCategory] = useState('Academic')
  const [transcript, setTranscript] = useState('')
  const [notes, setNotes] = useState('')
  const [evidence, setEvidence] = useState([])
  const [audio, setAudio] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')

  // Live check: is this actually a complaint?
  const [check, setCheck] = useState(null)
  const [checking, setChecking] = useState(false)
  const timer = useRef(null)

  /**
   * Validate as the student writes, not on submit.
   *
   * Finding out a recording was unusable *after* pressing submit is the
   * frustrating version. Debounced so it isn't a request per keystroke.
   */
  useEffect(() => {
    clearTimeout(timer.current)
    const text = transcript.trim()

    if (text.length < 10) { setCheck(null); return }

    timer.current = setTimeout(async () => {
      setChecking(true)
      try {
        const result = await api.validateComplaint(text)
        setCheck(result)
        // Follow the system's own reading of the complaint.
        if (result.is_complaint && result.category) setCategory(result.category)
      } catch {
        setCheck(null)  // offline or signed out — submit will surface it
      } finally {
        setChecking(false)
      }
    }, 700)

    return () => clearTimeout(timer.current)
  }, [transcript])

  async function submit() {
    const text = transcript.trim()
    if (!text) {
      setError('Record your complaint or type it in the review box before submitting.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setBusy(true)
    setError('')
    try {
      let attachments = evidence

      // Keep the original speech on file alongside the text.
      if (audio) {
        setBusyLabel('Attaching your recording…')
        try {
          const uploaded = await api.uploadAudio(audio)
          attachments = [...uploaded, ...evidence]
        } catch {
          // Cloudinary being unavailable must not block the complaint.
        }
      }

      setBusyLabel('Submitting…')
      const complaint = await api.createComplaint({
        category,
        transcript: text,
        notes,
        evidence: attachments,
      })
      navigate(`/app/complaints/${complaint.reference}`, { state: { justCreated: true } })
    } catch (err) {
      setError(err.message)
      setBusy(false)
      setBusyLabel('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const blocked = check && !check.is_complaint

  return (
    <>
      <PageHeading
        title="Register a complaint"
        subtitle="Describe the issue in your own words. Your speech is transcribed as you talk, and the department is worked out from what you say."
      />

      {error && <div className="mb-6"><Notice tone="error">{error}</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <VoiceRecorder
            transcript={transcript}
            onTranscript={setTranscript}
            onAudio={setAudio}
          />

          <Card className="p-6">
            <h3 className="text-base font-semibold text-ink">Evidence</h3>
            <p className="mb-4 mt-1 text-sm text-ink-soft">
              Attach a photo of the broken fixture, the wrong marksheet, the spoiled food — whatever proves the point.
            </p>
            <EvidenceUploader files={evidence} onChange={setEvidence} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <span className="rounded-full bg-purple-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-600">
              Step 1: Category
            </span>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition
                              ${category === c
                                ? 'border-purple-400 bg-purple-50 text-purple-600'
                                : 'border-hairline bg-white text-ink-soft hover:border-purple-200'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-mute">
              Not sure? Pick the closest one — the system re-checks it against what you said and corrects it if needed.
            </p>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-purple-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-600">
                Step 2: Review
              </span>
              {checking && (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-mute">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Checking
                </span>
              )}
            </div>

            <label htmlFor="transcript" className="sr-only">Complaint text</label>
            <textarea
              id="transcript"
              rows={7}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your words appear here as you speak. Edit anything the microphone got wrong, or just type instead."
              className="field resize-none leading-relaxed"
            />

            {blocked && (
              <div className="mt-3 flex gap-2.5 rounded-xl bg-orange-50 px-4 py-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" strokeWidth={2} />
                <p className="text-xs leading-relaxed text-orange-800">{check.reason}</p>
              </div>
            )}

            {check?.is_complaint && (
              <div className="mt-3 flex gap-2.5 rounded-xl bg-purple-50 px-4 py-3">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" strokeWidth={2} />
                <p className="text-xs leading-relaxed text-purple-800">
                  Reads as a {check.category} complaint
                  {check.priority !== 'Normal' && <>, priority <strong>{check.priority}</strong></>}.
                </p>
              </div>
            )}

            <label htmlFor="notes" className="mb-2 mt-5 block text-sm font-semibold text-ink">
              Anything else that helps <span className="font-normal text-ink-mute">(optional)</span>
            </label>
            <input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Room number, time of day, who you already spoke to"
              className="field"
            />
          </Card>

          <div className="flex flex-col items-end gap-2">
            <Button onClick={submit} disabled={busy || blocked}>
              <Send className="h-4 w-4" /> {busy ? busyLabel || 'Submitting…' : 'Submit complaint'}
            </Button>
            {blocked && (
              <p className="text-xs text-ink-mute">Add more detail above to continue.</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
