import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Quote, Paperclip, History, Mail } from 'lucide-react'
import { Card, StatusBadge, CategoryChip, Button, Avatar, Notice } from '../../components/Ui'
import { AsyncBoundary } from '../../components/States'
import EvidenceViewer from '../../components/EvidenceViewer'
import { Priority } from './AdminDashboard'
import { useAsync } from '../../lib/useAsync'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'

const STATUSES = ['Pending', 'In Progress', 'Resolved', 'Rejected']

export default function AdminComplaintDetail() {
  const { id } = useParams()
  const { data, error, loading, reload } = useAsync(() => api.getComplaint(id), [id])

  const [complaint, setComplaint] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')

  const current = complaint || data

  async function setStatus(status) {
    setBusy(status)
    setActionError('')
    try {
      setComplaint(await api.updateStatus(current.reference, status, note.trim()))
      setNote('')
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <Link to="/admin/complaints" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-purple-500">
        <ArrowLeft className="h-4 w-4" /> All complaints
      </Link>

      <AsyncBoundary loading={loading} error={error} reload={reload}>
        {current && (
          <>
            <header className="mb-8">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={current.status} />
                <CategoryChip>{current.category}</CategoryChip>
                <Priority value={current.priority} />
                <span className="text-xs text-ink-mute">ID: {current.reference}</span>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">{current.title}</h1>
              <p className="mt-2 text-sm text-ink-mute">Raised {formatDateTime(current.created_at)}</p>
            </header>

            {actionError && <div className="mb-6"><Notice tone="error">{actionError}</Notice></div>}

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
                    <Quote className="h-4 w-4 text-purple-500" /> Transcript
                  </h2>
                  <p className="whitespace-pre-wrap leading-relaxed text-ink-soft">{current.transcript}</p>
                  {current.notes && (
                    <p className="mt-5 rounded-xl bg-canvas px-4 py-3 text-sm text-ink-soft">
                      <span className="font-semibold text-ink">Extra detail: </span>{current.notes}
                    </p>
                  )}
                </Card>

                <Card className="p-6">
                  <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-ink">
                    <Paperclip className="h-4 w-4 text-purple-500" /> Evidence
                  </h2>
                  <p className="mb-4 text-sm text-ink-soft">
                    Open any file to view it full size. The voice recording is attached too, so you can hear the original.
                  </p>
                  <EvidenceViewer evidence={current.evidence} />
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="mb-4 text-base font-semibold text-ink">Update status</h2>
                  <label htmlFor="note" className="mb-2 block text-sm text-ink-soft">
                    Note for the student <span className="text-ink-mute">(optional)</span>
                  </label>
                  <input
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Assigned to the hostel warden"
                    className="field mb-4"
                  />
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.filter((s) => s !== current.status).map((s) => (
                      <Button
                        key={s}
                        variant={s === 'Resolved' ? 'purple' : s === 'Rejected' ? 'danger' : 'outline'}
                        disabled={!!busy}
                        onClick={() => setStatus(s)}
                      >
                        {busy === s ? 'Saving…' : `Mark ${s.toLowerCase()}`}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-ink-mute">
                    The student is emailed automatically whenever the status changes.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="mb-4 text-base font-semibold text-ink">Raised by</h2>
                  <div className="flex items-center gap-3">
                    <Avatar name={current.student_name} className="h-11 w-11 text-sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{current.student_name}</p>
                      <p className="truncate text-sm text-ink-mute">{current.student_email}</p>
                    </div>
                  </div>
                  <Button
                    as="a"
                    href={`mailto:${current.student_email}?subject=Complaint ${current.reference}`}
                    variant="outline"
                    className="mt-5 w-full"
                  >
                    <Mail className="h-4 w-4" /> Email the student
                  </Button>
                </Card>

                <Card className="p-6">
                  <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-ink">
                    <History className="h-4 w-4 text-purple-500" /> Activity
                  </h2>
                  <ol className="space-y-5">
                    {current.timeline.map((step, i) => (
                      <li key={i} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-purple-500" />
                          {i < current.timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-hairline" />}
                        </div>
                        <div className="pb-1">
                          <p className="text-sm font-semibold text-ink">{step.label}</p>
                          <p className="mt-0.5 text-xs text-ink-mute">{formatDateTime(step.at)} · {step.by_name}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              </div>
            </div>
          </>
        )}
      </AsyncBoundary>
    </>
  )
}
