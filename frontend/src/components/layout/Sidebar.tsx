import { NavLink } from 'react-router-dom'
import { APP_NAME, NAV_ITEMS } from '../../lib/constants'

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-800 text-white flex flex-col">
      <div className="px-5 py-6 border-b border-slate-700">
        <h1 className="text-lg font-bold tracking-tight">{APP_NAME}</h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-slate-700 text-xs text-slate-500">
        v0.1.0
      </div>
    </aside>
  )
}
