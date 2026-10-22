import { Link } from 'react-router-dom'
import { Card, PageHeading, Avatar, Button } from '../../components/Ui'
import { AsyncBoundary } from '../../components/States'
import { useAuth } from '../../lib/auth'
import { useAsync } from '../../lib/useAsync'
import { api } from '../../lib/api'

export default function Profile() {
  const { user } = useAuth()
  const { data: counts, error, loading, reload } = useAsync(() => api.stats(), [])

  return (
    <>
      <PageHeading title="Profile" subtitle="Your account details and complaint history at a glance." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Avatar name={user?.name} className="h-14 w-14 text-base" />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-ink">{user?.name}</p>
              <p className="truncate text-sm text-ink-mute">{user?.email}</p>
            </div>
          </div>

          <dl className="mt-7 space-y-4 border-t border-hairline pt-6 text-sm">
            <Row label="Role" value="Student" />
            <Row label="Institution" value="GHRCE, Nagpur" />
          </dl>

          <Button as={Link} to="/forgot-password" variant="outline" className="mt-7 w-full">
            Change password
          </Button>
        </Card>

        <Card className="p-6">
          <h2 className="mb-5 text-base font-semibold text-ink">Your complaint history</h2>
          <AsyncBoundary loading={loading} error={error} reload={reload} card={false}>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Raised" value={counts?.total ?? 0} />
              <Stat label="Active" value={counts?.active ?? 0} tone="text-orange-500" />
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

const Stat = ({ label, value, tone = 'text-ink' }) => (
  <div className="rounded-xl bg-canvas px-4 py-5 text-center">
    <p className={`text-2xl font-bold tabular-nums ${tone}`}>{String(value).padStart(2, '0')}</p>
    <p className="mt-1 text-xs text-ink-mute">{label}</p>
  </div>
)
