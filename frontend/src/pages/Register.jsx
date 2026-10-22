import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, ArrowRight, ArrowLeft } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import PasswordField from '../components/PasswordField'
import { Button, Notice } from '../components/Ui'
import { useAuth } from '../lib/auth'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Fill in your name, email and a password to continue.')
      return
    }
    if (form.password.length < 8) { setError('Use at least 8 characters for your password.'); return }
    if (form.password !== form.confirm) { setError('Both passwords need to match.'); return }

    setBusy(true)
    setError('')
    try {
      const result = await signUp({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })

      if (result?.verification_required) {
        const to = result.email || form.email.trim()
        navigate(`/verify-email?email=${encodeURIComponent(to)}`)
        return
      }
      navigate(result.role === 'admin' ? '/admin' : '/app')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-purple-500">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>

      <h2 className="text-3xl font-bold tracking-tight text-ink">Create your account</h2>
      <p className="mt-2 text-sm text-ink-soft">Register once, then raise grievances by voice whenever you need to.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && <Notice tone="error">{error}</Notice>}

        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-semibold text-ink">Full name</label>
          <div className="relative">
            <User className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-mute" strokeWidth={1.8} />
            <input id="name" value={form.name} onChange={set('name')} placeholder="Your name" className="field field-icon" />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-ink">College email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-mute" strokeWidth={1.8} />
            <input id="email" type="email" value={form.email} onChange={set('email')} placeholder="you@ghrce.edu.in" className="field field-icon" />
          </div>
        </div>

        <PasswordField id="password" label="Password" value={form.password} onChange={set('password')} placeholder="At least 8 characters" autoComplete="new-password" />
        <PasswordField id="confirm" label="Confirm password" value={form.confirm} onChange={set('confirm')} placeholder="Repeat your password" autoComplete="new-password" />

        <Button type="submit" disabled={busy} className="w-full py-3.5">
          {busy ? 'Creating…' : <>Create account <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></>}
        </Button>
      </form>
    </AuthShell>
  )
}
