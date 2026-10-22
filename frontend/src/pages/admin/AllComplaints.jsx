import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Inbox, Paperclip } from 'lucide-react'
import { Card, StatusBadge, CategoryChip, EmptyState, Avatar, PageHeading } from '../../components/Ui'
import { AsyncBoundary } from '../../components/States'
import { Priority } from './AdminDashboard'
import { useAsync } from '../../lib/useAsync'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'

const STATUSES = ['All', 'Pending', 'In Progress', 'Resolved', 'Rejected']
const CATEGORIES = ['All', 'Academic', 'Hostel', 'Infrastructure', 'Dining', 'IT Support']
const PER_PAGE = 8

export default function AllComplaints() {
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [status, setStatus] = useState('All')
  const [category, setCategory] = useState('All')
  const [page, setPage] = useState(1)

  const { data, error, loading, reload } = useAsync(
    () => api.listComplaints({ status, category, q: query, limit: 200 }),
    [status, category, query]
  )

  const rows = data || []
  const filtering = status !== 'All' || category !== 'All' || query.trim() !== ''
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const current = Math.min(page, pages)
  const visible = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  const change = (setter) => (value) => { setter(value); setPage(1) }

  return (
    <>
      <PageHeading title="All complaints" subtitle="Every grievance across departments, newest first." />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input
            value={query}
            onChange={(e) => change(setQuery)(e.target.value)}
            placeholder="Search ID or issue"
            className="field field-icon py-2.5"
          />
        </div>
        <select value={status} onChange={(e) => change(setStatus)(e.target.value)}
                className="field w-auto py-2.5" aria-label="Filter by status">
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={category} onChange={(e) => change(setCategory)(e.target.value)}
                className="field w-auto py-2.5" aria-label="Filter by category">
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <AsyncBoundary loading={loading} error={error} reload={reload}>
        <Card>
          {rows.length === 0 ? (
            filtering ? (
              <EmptyState icon={Search} title="No matches"
                          body="Loosen the filters or clear the search box to see the full queue." />
            ) : (
              <EmptyState
                icon={Inbox}
                title="No complaints registered yet"
                body="As soon as a student submits a grievance it appears in this queue, with its transcript and any evidence attached."
              />
            )
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="border-b border-hairline text-xs font-semibold text-ink-mute">
                    <tr>
                      {['Complaint ID', 'Student', 'Issue', 'Category', 'Priority', 'Date', 'Status'].map((h) => (
                        <th key={h} className="px-6 py-3.5 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {visible.map((c) => (
                      <tr key={c.reference} className="transition hover:bg-canvas">
                        <td className="px-6 py-4 font-medium">
                          <Link to={`/admin/complaints/${c.reference}`} className="text-ink hover:text-purple-500">
                            {c.reference}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={c.student_name} className="h-7 w-7 text-[10px]" />
                            <span className="text-ink-soft">{c.student_name}</span>
                          </div>
                        </td>
                        <td className="max-w-[230px] px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-ink-soft">{c.title}</span>
                            {c.evidence_count > 0 && (
                              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-mute"
                                    title={`${c.evidence_count} attachments`}>
                                <Paperclip className="h-3 w-3" />{c.evidence_count}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4"><CategoryChip>{c.category}</CategoryChip></td>
                        <td className="px-6 py-4"><Priority value={c.priority} /></td>
                        <td className="whitespace-nowrap px-6 py-4 text-ink-mute">{formatDate(c.created_at)}</td>
                        <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm text-ink-mute">
                <span>
                  Showing {(current - 1) * PER_PAGE + 1}–{Math.min(current * PER_PAGE, rows.length)} of {rows.length}
                </span>
                {pages > 1 && (
                  <div className="flex gap-1">
                    {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-9 w-9 rounded-lg text-sm font-semibold transition
                                    ${p === current ? 'bg-purple-500 text-white' : 'text-ink-soft hover:bg-canvas'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </AsyncBoundary>
    </>
  )
}
