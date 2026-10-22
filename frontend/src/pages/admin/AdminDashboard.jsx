import { Link } from 'react-router-dom'
import { ClipboardList, Hourglass, CircleCheck, Inbox, Filter, Download } from 'lucide-react'
import { Card, StatusBadge, CategoryChip, EmptyState, Button, Avatar } from '../../components/Ui'
import { AsyncBoundary } from '../../components/States'
import { useAsync } from '../../lib/useAsync'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'

export default function AdminDashboard() {
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([api.stats(), api.listComplaints({ limit: 6 }), api.breakdown()]),
    []
  )
  const [counts, recent, breakdown] = data || [null, [], []]

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Student cell dashboard</h1>
          <p className="mt-2 text-sm text-ink-soft">Manage and track student grievances across all departments.</p>
        </div>
        <div className="flex gap-3">
          <Button as={Link} to="/admin/complaints" variant="outline"><Filter className="h-4 w-4" /> Filter</Button>
          <Button variant="outline" disabled={!counts?.total} onClick={() => exportCsv()}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <AsyncBoundary loading={loading} error={error} reload={reload}>
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <StatCard icon={ClipboardList} tone="orange" label="Total pending" value={counts?.pending ?? 0} hint="Waiting to be picked up" />
            <StatCard icon={Hourglass} tone="amber" label="In progress" value={counts?.in_progress ?? 0} hint="Active investigations" />
            <StatCard icon={CircleCheck} tone="purple" label="Resolved" value={counts?.resolved ?? 0} hint="Closed complaints" />
          </div>

          <Card className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-6 py-5">
              <h2 className="text-xl font-bold tracking-tight text-ink">Recent complaints</h2>
              {recent.length > 0 && (
                <Link to="/admin/complaints" className="text-sm font-semibold text-purple-500 hover:text-purple-600">
                  See all {counts?.total}
                </Link>
              )}
            </div>

            {recent.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="The queue is clear"
                body="Complaints registered by students land here the moment they are submitted, sorted newest first."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-hairline text-xs font-semibold text-ink-mute">
                    <tr>
                      {['Complaint ID', 'Student', 'Issue', 'Category', 'Priority', 'Date', 'Status'].map((h) => (
                        <th key={h} className="px-6 py-3.5 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {recent.map((c) => (
                      <tr key={c.reference} className="transition hover:bg-canvas">
                        <td className="px-6 py-4 font-medium text-ink">
                          <Link to={`/admin/complaints/${c.reference}`} className="hover:text-purple-500">{c.reference}</Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={c.student_name} className="h-7 w-7 text-[10px]" />
                            <span className="text-ink-soft">{c.student_name}</span>
                          </div>
                        </td>
                        <td className="max-w-[240px] truncate px-6 py-4 text-ink-soft">{c.title}</td>
                        <td className="px-6 py-4"><CategoryChip>{c.category}</CategoryChip></td>
                        <td className="px-6 py-4"><Priority value={c.priority} /></td>
                        <td className="whitespace-nowrap px-6 py-4 text-ink-mute">{formatDate(c.created_at)}</td>
                        <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {breakdown.length > 0 && (
            <Card className="mt-6 p-6">
              <h2 className="mb-5 text-base font-semibold text-ink">Where complaints are coming from</h2>
              <ul className="space-y-3">
                {breakdown.map(({ name, count }) => (
                  <li key={name} className="flex items-center gap-4">
                    <span className="w-28 shrink-0 text-sm text-ink-soft">{name}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                      <span className="block h-full rounded-full bg-purple-500"
                            style={{ width: `${(count / breakdown[0].count) * 100}%` }} />
                    </span>
                    <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">{count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      </AsyncBoundary>
    </>
  )
}

export function Priority({ value }) {
  const tones = {
    Urgent: 'bg-red-50 text-red-600',
    High: 'bg-orange-50 text-orange-700',
    Normal: 'bg-canvas text-ink-soft',
    Low: 'bg-canvas text-ink-mute',
  }
  return <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${tones[value] || tones.Normal}`}>{value}</span>
}

function StatCard({ icon: Icon, label, value, hint, tone }) {
  const tones = {
    orange: 'bg-orange-50 text-orange-500',
    amber: 'bg-amber-50 text-amber-500',
    purple: 'bg-purple-50 text-purple-500',
  }[tone]

  return (
    <Card className="flex items-start justify-between p-6">
      <div>
        <p className="text-sm text-ink-soft">{label}</p>
        <p className="mt-2 text-4xl font-bold tabular-nums text-ink">{value}</p>
        <p className="mt-2 text-xs text-ink-mute">{hint}</p>
      </div>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones}`}>
        <Icon className="h-5 w-5" strokeWidth={1.9} />
      </span>
    </Card>
  )
}

async function exportCsv() {
  const rows = await api.listComplaints({ limit: 200 })
  const header = ['ID', 'Student', 'Issue', 'Category', 'Priority', 'Status', 'Raised']
  const body = rows.map((c) => [c.reference, c.student_name, c.title, c.category, c.priority, c.status, c.created_at])
  const csv = [header, ...body]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `edvvoice-complaints-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
