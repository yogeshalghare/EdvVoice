import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck, CircleAlert, ArrowLeft } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import PasswordField from '../components/PasswordField'
import { Button, Notice } from '../components/Ui'
import { api } from '../lib/api'

const rules = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One letter and one number', test: (p) => /[a-zA-Z]/.test(p) && /\d/.test(p) },
]

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()

  const [state, setState] = useState('checking') // checking | ready | invalid | done
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) { setState('invalid'); return }
    api.verifyResetToken(token)
      .then(() => setState('ready'))
      .catch(() => setState('invalid'))
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!rules.every((r) => r.test(password))) { setError('Your password does not meet the requirements yet.'); return }
    if (password !== confirm) { setError('Both passwords need to match.'); return }

    setBusy(true)
    setError('')
    try {
      await api.submitNewPassword(token, password)
      setState('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (state === 'checking') {
    return <AuthShell><p className="text-center text-sm text-ink-mute">Checking your link…</p></AuthShell>
  }

  if (state === 'invalid') {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 text-orange-500">
            <CircleAlert className="h-7 w-7" strokeWidth={1.8} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-ink">This link has expired</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Reset links work once and last 30 minutes. Request a fresh one and it will arrive in a moment.
          </p>
          <Button as={Link} to="/forgot-password" className="mt-8 w-full py-3.5">Request a new link</Button>
          <Link to="/" className="mt-3 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-ink-soft hover:text-purple-500">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (state === 'done') {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-purple-50 text-purple-500">
            <ShieldCheck className="h-7 w-7" strokeWidth={1.8} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-ink">Password updated</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Sign in with your new password. The old one no longer works.
          </p>
          <Button onClick={() => navigate('/')} className="mt-8 w-full py-3.5">Go to sign in</Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h2 className="text-3xl font-bold tracking-tight text-ink">Set a new password</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Choose something you haven't used on this portal before.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && <Notice tone="error">{error}</Notice>}

        <PasswordField id="password" label="New password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter a new password" autoComplete="new-password" />

        <ul className="space-y-2">
          {rules.map((r) => {
            const ok = r.test(password)
            return (
              <li key={r.label} className={`flex items-center gap-2.5 text-xs font-medium ${ok ? 'text-purple-600' : 'text-ink-mute'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-purple-500' : 'bg-gray-300'}`} />
                {r.label}
              </li>
            )
          })}
        </ul>

        <PasswordField id="confirm" label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat the new password" autoComplete="new-password" />

        <Button type="submit" disabled={busy} className="w-full py-3.5">
          {busy ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  )
}
