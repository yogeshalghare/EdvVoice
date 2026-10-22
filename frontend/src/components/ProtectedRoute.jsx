import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Loading } from './States'

export default function ProtectedRoute({ role, children }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  // Wait for the stored token to be checked, otherwise a refresh on a
  // protected page bounces you to login before the check finishes.
  if (!ready) return <Loading label="Checking your session…" />

  if (!user) return <Navigate to="/" replace state={{ from: location }} />

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />
  }
  return children
}
