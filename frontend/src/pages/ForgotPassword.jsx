import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, MailCheck } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import { Button, Notice } from '../components/Ui'
import { api } from '../lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function send(e) {
    e?.preventDefault()
    if (!email.trim()) { setError('Enter the email address on your account.'); return }

    setBusy(true)
    setError('')
    try {
      await api.requestPasswordReset(email.trim())
      setSent(true)
      setCooldown(30)
    } catch (err) {
      setError(
        err.message.includes('Failed to fetch')
          ? 'The backend is not running. Start it in a second terminal: cd backend, then uvicorn main:app --reload --port 8000'
          : err.message
      )
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-purple-50 text-purple-500">
            <MailCheck className="h-7 w-7" strokeWidth={1.8} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-ink">Check your inbox</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            A reset link is on its way to <span className="font-semibold text-ink">{email}</span>.
            It works once and expires in 30 minutes.
          </p>
        </div>

        {error && <div className="mt-6"><Notice tone="error">{error}</Notice></div>}

        <div className="mt-8 space-y-3">
          <Button variant="outline" className="w-full py-3.5" disabled={busy || cooldown > 0} onClick={send}>
            {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send the link again'}
          </Button>
          <Link
            to="/"
            className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-ink-soft hover:text-purple-500"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>

        <p className="mt-10 text-center text-xs leading-relaxed text-ink-mute">
          Nothing arrived? Check your spam folder, or make sure you used your college email address.
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-purple-500">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>

      <h2 className="text-3xl font-bold tracking-tight text-ink">Reset your password</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Enter the email on your account and we'll send you a link to set a new password.
      </p>

      <form onSubmit={send} className="mt-8 space-y-5">
        {error && <Notice tone="error">{error}</Notice>}

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-ink">Email address</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-mute" strokeWidth={1.8} />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ghrce.edu.in"
              autoComplete="email"
              className="field field-icon"
            />
          </div>
        </div>

        <Button type="submit" disabled={busy} className="w-full py-3.5">
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthShell>
  )
}
