import { TriangleAlert, RefreshCw } from 'lucide-react'
import { Button, Card } from './Ui'

/** Shown while a screen's first fetch is in flight. */
export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-20 text-sm text-ink-mute">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-200 border-t-purple-500" />
      {label}
    </div>
  )
}

/** Shown when a fetch fails — always with a way to try again. */
export function ErrorState({ message, onRetry }) {
  const offline = message?.includes('Failed to fetch')

  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-orange-500">
        <TriangleAlert className="h-6 w-6" strokeWidth={1.8} />
      </div>
      <h3 className="text-base font-semibold text-ink">
        {offline ? "Can't reach the server" : 'Something went wrong'}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-mute">
        {offline
          ? 'The backend is not running. Start it in a second terminal: cd backend, then uvicorn main:app --reload --port 8000'
          : message}
      </p>
      {onRetry && (
        <Button variant="outline" className="mt-6" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      )}
    </div>
  )
}

/** Wraps a screen's fetch states so pages don't repeat the same branching. */
export function AsyncBoundary({ loading, error, reload, children, card = true }) {
  if (!loading && !error) return children

  const inner = loading ? <Loading /> : <ErrorState message={error} onRetry={reload} />
  return card ? <Card>{inner}</Card> : inner
}
