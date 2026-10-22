import { Link, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Quote, Paperclip, History } from 'lucide-react'
import { Card, StatusBadge, CategoryChip, Notice } from '../../components/Ui'
import { AsyncBoundary } from '../../components/States'
import EvidenceViewer from '../../components/EvidenceViewer'
import { useAsync } from '../../lib/useAsync'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'

export default function ComplaintDetail() {
  const { id } = useParams()
  const location = useLocation()
  const { data: complaint, error, loading, reload } = useAsync(() => api.getComplaint(id), [id])

  return (
    <>
      <Link to="/app/complaints" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-purple-500">
        <ArrowLeft className="h-4 w-4" /> My complaints
      </Link>

      <AsyncBoundary loading={loading} error={error} reload={reload}>
        {complaint && (
          <>
            {location.state?.justCreated && (
              <div className="mb-6">
                <Notice tone="success">
                  Complaint registered and routed to {complaint.category}. Quote tracking ID {complaint.reference} when you follow up.
                </Notice>
              </div>
            )}

            <header className="mb-8">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={complaint.status} />
                <CategoryChip>{complaint.category}</CategoryChip>
                <CategoryChip>Priority: {complaint.priority}</CategoryChip>
                <span className="text-xs text-ink-mute">ID: {complaint.reference}</span>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">{complaint.title}</h1>
              <p className="mt-2 text-sm text-ink-mute">Raised {formatDateTime(complaint.created_at)}</p>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
                    <Quote className="h-4 w-4 text-purple-500" /> What you reported
                  </h2>
                  <p className="whitespace-pre-wrap leading-relaxed text-ink-soft">{complaint.transcript}</p>
                  {complaint.notes && (
                    <p className="mt-5 rounded-xl bg-canvas px-4 py-3 text-sm text-ink-soft">
                      <span className="font-semibold text-ink">Extra detail: </span>{complaint.notes}
                    </p>
                  )}
                </Card>

                <Card className="p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
                    <Paperclip className="h-4 w-4 text-purple-500" /> Evidence
                  </h2>
                  <EvidenceViewer evidence={complaint.evidence} />
                </Card>
              </div>

              <Card className="h-fit p-6">
                <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-ink">
                  <History className="h-4 w-4 text-purple-500" /> Progress
                </h2>
                <ol className="space-y-5">
                  {complaint.timeline.map((step, i) => (
                    <li key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-purple-500" />
                        {i < complaint.timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-hairline" />}
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
          </>
        )}
      </AsyncBoundary>
    </>
  )
}
