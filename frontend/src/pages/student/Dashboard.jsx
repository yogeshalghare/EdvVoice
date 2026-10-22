import { Link } from 'react-router-dom'
import { CircleDashed, CircleCheck, Mic, ChevronRight, Inbox } from 'lucide-react'
import { Card, StatusBadge, EmptyState, Button } from '../../components/Ui'
import { AsyncBoundary } from '../../components/States'
import { useAuth } from '../../lib/auth'
import { useAsync } from '../../lib/useAsync'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'

export default function Dashboard() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([api.stats(), api.listComplaints({ limit: 5 })]),
    []
  )

  const [counts, recent] = data || [null, []]

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Hello, {user?.name?.split(' ')[0] || 'Student'}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">Here's where your grievances stand.</p>
      </header>

      <AsyncBoundary loading={loading} error={error} reload={reload}>
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <StatCard icon={CircleDashed} tone="orange" label="Active complaints"
                      hint="Under review or in progress" value={counts?.active ?? 0} />
            <StatCard icon={CircleCheck} tone="purple" label="Resolved complaints"
                      hint="Closed by the department" value={counts?.resolved ?? 0} />

            <Link
              to="/app/new"
              className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-orange-500 p-6
                         text-center shadow-glow transition hover:bg-orange-600"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-black/15 text-white">
                <Mic className="h-6 w-6" strokeWidth={2} />
              </span>
              <span className="text-lg font-bold text-white">Register a complaint</span>
              <span className="text-sm text-white/85">Speak it or type it — both work.</span>
            </Link>
          </div>

          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-ink">Recent complaints</h2>
              {recent.length > 0 && (
                <Link to="/app/complaints" className="text-sm font-semibold text-purple-500 hover:text-purple-600">
                  View all
                </Link>
              )}
            </div>

            <Card>
              {recent.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No complaints yet"
                  body="When you register a grievance it appears here with its tracking ID, so you can follow it from raised to resolved."
                  action={<Button as={Link} to="/app/new"><Mic className="h-4 w-4" /> Register your first complaint</Button>}
                />
              ) : (
                <ul className="divide-y divide-hairline">
                  {recent.map((c) => (
                    <li key={c.reference}>
                      <Link to={`/app/complaints/${c.reference}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-canvas">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-canvas text-xs font-bold text-purple-500">
                          {c.category.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-ink">{c.title}</p>
                          <p className="mt-0.5 text-xs text-ink-mute">ID: {c.reference} · {formatDate(c.created_at)}</p>
                        </div>
                        <StatusBadge status={c.status} />
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-mute" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </>
      </AsyncBoundary>
    </>
  )
}

function StatCard({ icon: Icon, label, hint, value, tone }) {
  const tones = {
    orange: { chip: 'bg-orange-50 text-orange-500', number: 'text-orange-500' },
    purple: { chip: 'bg-purple-50 text-purple-500', number: 'text-purple-500' },
  }[tone]

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-full ${tones.chip}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <h3 className="text-lg font-semibold text-ink">{label}</h3>
      </div>
      <p className="mt-3 text-sm text-ink-mute">{hint}</p>
      <p className={`mt-5 text-4xl font-bold tabular-nums ${tones.number}`}>
        {String(value).padStart(2, '0')}
      </p>
    </Card>
  )
}
