import { useState } from 'react'
import { Outlet, useNavigate, Link } from 'react-router-dom'
import {
  LayoutGrid, FileText, Bell, User, Plus, LifeBuoy, LogOut, Menu, Settings, HelpCircle,
} from 'lucide-react'
import Sidebar from './Sidebar'
import { Avatar } from './Ui'
import { useAuth } from '../lib/auth'

export default function StudentLayout() {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const items = [
    { to: '/app', label: 'Dashboard', icon: LayoutGrid, end: true },
    { to: '/app/complaints', label: 'My Complaints', icon: FileText },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
    { to: '/app/profile', label: 'Profile', icon: User },
  ]

  const header = (
    <Link to="/app" className="flex items-center gap-3">
      <img src="/logo-mark.png" alt="" className="h-11 w-11 shrink-0" />
      <div>
        <p className="text-lg font-bold leading-tight text-purple-500">EdvVoice Portal</p>
        <p className="text-[11px] leading-tight text-ink-mute">University Grievance System</p>
      </div>
    </Link>
  )

  const footer = (
    <>
      <Link
        to="/app/new"
        onClick={() => setOpen(false)}
        className="mb-4 flex items-center justify-center gap-2 rounded-full bg-orange-500 px-4 py-3
                   text-sm font-semibold text-white shadow-glow transition hover:bg-orange-600"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> New complaint
      </Link>
      <Link
        to="/app/help"
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-ink-soft hover:bg-canvas"
      >
        <LifeBuoy className="h-[18px] w-[18px]" strokeWidth={1.9} /> Help centre
      </Link>
      <button
        onClick={() => { signOut(); navigate('/') }}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-ink-soft hover:bg-canvas"
      >
        <LogOut className="h-[18px] w-[18px]" strokeWidth={1.9} /> Sign out
      </button>
    </>
  )

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar skin="light" header={header} items={items} footer={footer} open={open} onClose={() => setOpen(false)} />

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-hairline bg-canvas/90 px-5 backdrop-blur lg:px-10">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink-soft hover:bg-white lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/app/help" className="rounded-lg p-2 text-ink-mute hover:bg-white hover:text-purple-500" aria-label="Help">
              <HelpCircle className="h-5 w-5" strokeWidth={1.8} />
            </Link>
            <Link to="/app/profile" className="rounded-lg p-2 text-ink-mute hover:bg-white hover:text-purple-500" aria-label="Settings">
              <Settings className="h-5 w-5" strokeWidth={1.8} />
            </Link>
            <Link to="/app/profile"><Avatar name={user?.name} /></Link>
          </div>
        </header>

        <main className="px-5 py-8 lg:px-10 lg:py-10"><Outlet /></main>
      </div>
    </div>
  )
}
