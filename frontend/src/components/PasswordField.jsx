import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function PasswordField({ label = 'Password', ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-ink" htmlFor={props.id}>{label}</label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-mute" strokeWidth={1.8} />
        <input {...props} type={visible ? 'text' : 'password'} className="field field-icon pr-12" />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-mute hover:text-purple-500"
        >
          {visible ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} />}
        </button>
      </div>
    </div>
  )
}
