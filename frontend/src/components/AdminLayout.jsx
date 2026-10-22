import { useState } from 'react'
import { Outlet, useNavigate, Link } from 'react-router-dom'
import { LayoutGrid, ClipboardList, Bell, User, LogOut, Menu, Search } from 'lucide-react'
import Sidebar from './Sidebar'
import { Logo } from './Ui'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { api } from '../lib/api'

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: counts } = useAsync(() => api.stats(), [])
  const pending = counts?.pending ?? 0

  const items = [
    { to: '/admin', label: 'Dashboard', icon: LayoutGrid, end: true },
    { to: '/admin/complaints', label: 'All Complaints', icon: ClipboardList },
    { to: '/admin/notifications', label: 'Notifications', icon: Bell, badge: pending },
    { to: '/admin/profile', label: 'Profile', icon: User },
  ]

  const header = (
    <div className="space-y-6">
      <Logo tone="onDark" />
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-sm font-semibold text-white">
          {(user?.name || 'A').charAt(0)}
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight text-white">{user?.name || 'Admin User'}</p>
          <p className="text-[11px] leading-tight text-white/60">{user?.title || 'Student Cell Head'}</p>
        </div>
      </div>
    </div>
  )

  const footer = (
    <button
      onClick={() => { signOut(); navigate('/') }}
      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white"
    >
      <LogOut className="h-[18px] w-[18px]" strokeWidth={1.9} /> Logout
    </button>
  )

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar skin="purple" header={header} items={items} footer={footer} open={open} onClose={() => setOpen(false)} />

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-hairline bg-white/90 px-5 backdrop-blur lg:px-10">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink-soft hover:bg-canvas lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/admin" className="text-lg font-bold text-purple-500">EdvVoice Portal</Link>
          <div className="relative ml-auto hidden sm:block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            <input
              type="search"
              placeholder="Quick search"
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/complaints?q=${encodeURIComponent(e.currentTarget.value)}`)}
              className="w-64 rounded-xl border border-hairline bg-canvas py-2.5 pl-10 pr-4 text-sm
                         placeholder:text-ink-mute focus:border-purple-300 focus:outline-none"
            />
          </div>
        </header>

        <main className="px-5 py-8 lg:px-10 lg:py-10"><Outlet /></main>
      </div>
    </div>
  )
}
