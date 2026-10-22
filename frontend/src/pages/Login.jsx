import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, ArrowRight } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import PasswordField from '../components/PasswordField'
import { Button, Notice } from '../components/Ui'
import { useAuth } from '../lib/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // An unconfirmed account is a fixable state, not a dead end — offer the
  // resend rather than leaving the student stuck on the error.
  const [unverified, setUnverified] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    setBusy(true)
    setError('')
    setUnverified(false)
    try {
      const user = await signIn(email.trim(), password)
      navigate(user.role === 'admin' ? '/admin' : '/app')
    } catch (err) {
      setError(err.message)
      if (err.message.toLowerCase().includes('confirm your email')) setUnverified(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-ink">Welcome back</h2>
        <p className="mt-2 text-sm text-ink-soft">Sign in to access your grievance portal.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-9 space-y-5">
        {error && <Notice tone="error">{error}</Notice>}

        {unverified && (
          <button
            type="button"
            onClick={() => navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`)}
            className="w-full rounded-xl bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-600
                       transition hover:bg-purple-100"
          >
            Enter my confirmation code
          </button>
        )}

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-ink">Email address</label>
          <div className="relative">
            <User className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-mute" strokeWidth={1.8} />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ghrce.edu.in"
              autoComplete="username"
              className="field field-icon"
            />
          </div>
        </div>

        <PasswordField
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2.5 text-sm text-ink-soft">
            <input type="checkbox" className="h-4 w-4 rounded border-hairline text-purple-500 focus:ring-purple-400" />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm font-semibold text-purple-500 hover:text-purple-600">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" disabled={busy} className="w-full py-3.5">
          {busy ? 'Signing in…' : <>Sign in <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></>}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-soft">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-purple-500 hover:text-purple-600">Register here</Link>
      </p>

      <p className="mt-10 text-center text-xs text-ink-mute">
        Staff accounts sign in here too — you'll land on the admin dashboard.
      </p>
    </AuthShell>
  )
}
