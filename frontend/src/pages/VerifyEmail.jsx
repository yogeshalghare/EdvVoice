import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MailCheck, ArrowLeft } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import { Button, Notice } from '../components/Ui'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

const CODE_LENGTH = 6

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const email = params.get('email') || ''
  const navigate = useNavigate()
  const { confirmCode } = useAuth()

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function submit(e) {
    e?.preventDefault()
    if (code.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from your email.`)
      return
    }
    setBusy(true)
    setError('')
    try {
      // A confirmed code signs the student in, so there is no second trip
      // through the login form.
      const user = await confirmCode(email, code)
      navigate(user.role === 'admin' ? '/admin' : '/app')
    } catch (err) {
      setError(err.message)
      setCode('')
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError('')
    setNotice('')
    try {
      await api.resendOtp(email)
      setNotice('A new code is on its way.')
      setCooldown(60)
    } catch (err) {
      setError(err.message)
      setCooldown(60)
    }
  }

  if (!email) {
    return (
      <AuthShell>
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink">Nothing to confirm</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Open this page from the sign-up screen so we know which account to confirm.
          </p>
          <Button as={Link} to="/register" className="mt-8 w-full py-3.5">Go to sign up</Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-purple-50 text-purple-500">
          <MailCheck className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-ink">Enter your code</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          We emailed a {CODE_LENGTH}-digit code to{' '}
          <span className="font-semibold text-ink">{email}</span>. It expires in 10 minutes.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-5">
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="info">{notice}</Notice>}

        <label htmlFor="code" className="sr-only">Confirmation code</label>
        <input
          ref={inputRef}
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          // Brings up the number pad on a phone and lets the OS autofill the
          // code straight from the email notification.
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          className="field text-center text-3xl font-semibold tracking-[0.5em]"
        />

        <Button type="submit" disabled={busy || code.length !== CODE_LENGTH} className="w-full py-3.5">
          {busy ? 'Checking…' : 'Confirm and continue'}
        </Button>
      </form>

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0}
        className="mt-5 w-full py-2 text-sm font-semibold text-purple-500 hover:text-purple-600 disabled:text-ink-mute"
      >
        {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send me a new code'}
      </button>

      <Link to="/" className="mt-2 flex items-center justify-center gap-2 py-2 text-sm font-medium text-ink-soft hover:text-purple-500">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </AuthShell>
  )
}
