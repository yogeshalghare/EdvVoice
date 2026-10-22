import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Inbox, Mic, ChevronRight } from 'lucide-react'
import { Card, StatusBadge, EmptyState, Button, CategoryChip, PageHeading } from '../../components/Ui'
import { AsyncBoundary } from '../../components/States'
import { useAsync } from '../../lib/useAsync'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'

const FILTERS = ['All', 'Pending', 'In Progress', 'Resolved']

export default function MyComplaints() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')

  const { data, error, loading, reload } = useAsync(
    () => api.listComplaints({ status, q: query }),
    [status, query]
  )
  const rows = data || []
  const filtering = status !== 'All' || query.trim() !== ''

  return (
    <>
      <PageHeading title="My complaints" subtitle="Every grievance you've raised, with its current status." />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID or subject"
            className="field field-icon py-2.5"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-hairline bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition
                          ${status === f ? 'bg-purple-50 text-purple-600' : 'text-ink-mute hover:text-ink'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <AsyncBoundary loading={loading} error={error} reload={reload}>
        <Card>
          {rows.length === 0 ? (
            filtering ? (
              <EmptyState icon={Search} title="No matches"
                          body="Try a different search term, or switch the status filter back to All." />
            ) : (
              <EmptyState
                icon={Inbox}
                title="Nothing here yet"
                body="Complaints you register will be listed here with a tracking ID you can quote to the department."
                action={<Button as={Link} to="/app/new"><Mic className="h-4 w-4" /> Register a complaint</Button>}
              />
            )
          ) : (
            <ul className="divide-y divide-hairline">
              {rows.map((c) => (
                <li key={c.reference}>
                  <Link to={`/app/complaints/${c.reference}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-canvas">
                    <div className="min-w-[220px] flex-1">
                      <p className="font-semibold text-ink">{c.title}</p>
                      <p className="mt-0.5 text-xs text-ink-mute">ID: {c.reference} · {formatDate(c.created_at)}</p>
                    </div>
                    <CategoryChip>{c.category}</CategoryChip>
                    <StatusBadge status={c.status} />
                    <ChevronRight className="h-4 w-4 text-ink-mute" />
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
