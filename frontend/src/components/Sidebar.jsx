import { NavLink } from 'react-router-dom'

/**
 * Two visual skins for the same navigation shell: students get the light
 * sidebar from the mockups, admins get the purple one. The colour is the
 * fastest way to tell which side of the portal you are on.
 */
export default function Sidebar({ skin = 'light', header, items, footer, open, onClose }) {
  const dark = skin === 'purple'

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-ink/40 lg:hidden ${open ? '' : 'hidden'}`}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col
                    ${dark ? 'bg-purple-500' : 'border-r border-hairline bg-white'}
                    ${open ? 'translate-x-0' : '-translate-x-full'}
                    transition-transform lg:translate-x-0`}
      >
        <div className="px-6 pb-6 pt-7">{header}</div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4">
          {items.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition
                 ${dark
                   ? isActive
                     ? 'bg-white/15 text-white'
                     : 'text-white/75 hover:bg-white/10 hover:text-white'
                   : isActive
                     ? 'bg-purple-50 text-purple-600'
                     : 'text-ink-soft hover:bg-canvas hover:text-ink'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2.2 : 1.9} />
                  <span className="tracking-wide">{label}</span>
                  {badge > 0 && (
                    <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full
                                     bg-orange-500 px-1.5 text-[11px] font-bold text-white">
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 px-4 pb-6 pt-4">{footer}</div>
      </aside>
    </>
  )
}
