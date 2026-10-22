import { Link } from 'react-router-dom'
import { BellOff, Bell } from 'lucide-react'
import { Card, EmptyState, PageHeading } from '../../components/Ui'
import { AsyncBoundary } from '../../components/States'
import { useAsync } from '../../lib/useAsync'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'

export default function AdminNotifications() {
  const { data, error, loading, reload } = useAsync(async () => {
    const list = await api.listComplaints({ limit: 20 })
    const details = await Promise.all(list.map((c) => api.getComplaint(c.reference)))
    return details
      .flatMap((c) => c.timeline.map((t) => ({
        ...t, reference: c.reference, title: c.title, student: c.student_name,
      })))
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [])

  const events = data || []

  return (
    <>
      <PageHeading title="Notifications" subtitle="New complaints and status changes across every department." />

      <AsyncBoundary loading={loading} error={error} reload={reload}>
        <Card>
          {events.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title="Nothing to review"
              body="New submissions appear here immediately, so you can act on them without refreshing the queue."
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {events.map((e, i) => (
                <li key={i}>
                  <Link to={`/admin/complaints/${e.reference}`} className="flex gap-4 px-5 py-4 transition hover:bg-canvas">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-50 text-purple-500">
                      <Bell className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{e.label} — {e.student}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-mute">{e.title} · {e.reference}</p>
                      <p className="mt-1 text-xs text-ink-mute">{formatDateTime(e.at)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </AsyncBoundary>
    </>
  )
}
