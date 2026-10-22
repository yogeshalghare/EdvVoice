import { Mic, ShieldCheck, Activity } from 'lucide-react'
import { Logo } from './Ui'

const points = [
  { icon: Mic, title: 'Voice-enabled reporting', body: 'Report your issue by simply speaking.' },
  { icon: ShieldCheck, title: 'Secure complaint registration', body: 'Submit grievances through a structured and secure system.' },
  { icon: Activity, title: 'Complaint tracking', body: 'Stay updated on the progress and resolution of your complaint.' },
]

/** The split screen used by every signed-out page: brand on the left, the task on the right. */
export default function AuthShell({ children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="brand-gradient relative hidden flex-col justify-between p-12 text-white lg:flex xl:p-16">
        <Logo tone="onDark" />

        <div className="max-w-md">
          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight">Speak. Report. Resolve.</h1>
          <p className="mt-5 text-lg leading-relaxed text-white/85">
            A simpler, smarter way to register and track student grievances.
          </p>

          <ul className="mt-14 space-y-8">
            {points.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/80">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/70">EdvVoice Portal — Department of Information Technology, GHRCE Nagpur.</p>
      </section>

      <section className="flex flex-col justify-center bg-white px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-10 flex justify-center lg:hidden">
            <img src="/logo-full.png" alt="EdvVoice" className="h-12 w-auto" />
          </div>
          {children}
        </div>
      </section>
    </div>
  )
}
