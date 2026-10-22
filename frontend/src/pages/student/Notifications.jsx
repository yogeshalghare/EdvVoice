import { Link } from 'react-router-dom'
import { BellOff, Bell } from 'lucide-react'
import { Card, EmptyState, PageHeading, Button } from '../../components/Ui'
import { AsyncBoundary } from '../../components/States'
import { useAsync } from '../../lib/useAsync'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'

export default function Notifications() {
  // The list endpoint has no timeline on it, so pull the detail of the most
  // recent complaints and flatten their events into one feed.
  const { data, error, loading, reload } = useAsync(async () => {
    const list = await api.listComplaints({ limit: 15 })
    const details = await Promise.all(list.map((c) => api.getComplaint(c.reference)))
    return details
      .flatMap((c) => c.timeline.map((t) => ({ ...t, reference: c.reference, title: c.title })))
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [])

  const events = data || []

  return (
    <>
      <PageHeading title="Notifications" subtitle="Status changes on your complaints show up here." />

      <AsyncBoundary loading={loading} error={error} reload={reload}>
        <Card>
          {events.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title="No updates yet"
              body="Once a department picks up one of your complaints, you'll see the update here and by email."
              action={<Button as={Link} to="/app/new">Register a complaint</Button>}
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {events.map((e, i) => (
                <li key={i}>
                  <Link to={`/app/complaints/${e.reference}`} className="flex gap-4 px-5 py-4 transition hover:bg-canvas">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-50 text-purple-500">
                      <Bell className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{e.label}</p>
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
