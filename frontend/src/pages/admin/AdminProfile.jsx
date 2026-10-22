import { Card, PageHeading, Avatar } from '../../components/Ui'
import { AsyncBoundary } from '../../components/States'
import { useAuth } from '../../lib/auth'
import { useAsync } from '../../lib/useAsync'
import { api } from '../../lib/api'

export default function AdminProfile() {
  const { user } = useAuth()
  const { data: counts, error, loading, reload } = useAsync(() => api.stats(), [])

  return (
    <>
      <PageHeading title="Profile" subtitle="Your staff account and the current state of the queue." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Avatar name={user?.name} className="h-14 w-14 text-base" />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-ink">{user?.name}</p>
              <p className="truncate text-sm text-ink-mute">Student Cell</p>
            </div>
          </div>
          <dl className="mt-7 space-y-4 border-t border-hairline pt-6 text-sm">
            <Row label="Email" value={user?.email} />
            <Row label="Access" value="All departments" />
            <Row label="Institution" value="GHRCE, Nagpur" />
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="mb-5 text-base font-semibold text-ink">Queue right now</h2>
          <AsyncBoundary loading={loading} error={error} reload={reload} card={false}>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Pending" value={counts?.pending ?? 0} tone="text-orange-500" />
              <Stat label="In progress" value={counts?.in_progress ?? 0} tone="text-amber-500" />
              <Stat label="Resolved" value={counts?.resolved ?? 0} tone="text-purple-500" />
            </div>
          </AsyncBoundary>
        </Card>
      </div>
    </>
  )
}

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-ink-mute">{label}</dt>
    <dd className="truncate font-medium text-ink">{value}</dd>
  </div>
)

const Stat = ({ label, value, tone }) => (
  <div className="rounded-xl bg-canvas px-4 py-5 text-center">
    <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    <p className="mt-1 text-xs text-ink-mute">{label}</p>
  </div>
)
