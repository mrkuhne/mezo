import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'

// Left rail for the admin hub (mezo-d5iy.9) — ported from the prototype's RAIL array
// (docs/design_2.0/prototypes/src/admin-body.html). No TabBar precedent here: this is a
// desktop-only surface, one clay icon per section, active state via NavLink's isActive.
interface RailItem { to: string; label: string; icon: ClayIconName; end?: boolean }
const RAIL: RailItem[] = [
  { to: '/admin', label: 'Pulzus', icon: 'i-nap', end: true },
  { to: '/admin/users', label: 'Emberek', icon: 'i-emberek' },
  { to: '/admin/features', label: 'Funkciók', icon: 'i-minta' },
  { to: '/admin/cost', label: 'Költés', icon: 'i-erme' },
  { to: '/admin/memory', label: 'Memória', icon: 'i-kristaly' },
  { to: '/admin/accounts', label: 'Meghívók és fiókok', icon: 'i-beallitas' },
]
// The data browser is a drill-through TOOL, not a destination (mezo-l096): it moves out
// of the main list into the rail foot, under an "Eszközök" caption.
const TOOLS: RailItem[] = [{ to: '/admin/data', label: 'Nyers adatok', icon: 'i-tudas' }]

export function AdminRail() {
  return (
    <nav className="ad-rail" aria-label="Admin navigáció">
      <div className="brand">
        <ClayIcon name="i-mezo" size={26} />
        <div>Mezo<small>admin</small></div>
      </div>
      {RAIL.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => cn('ad-rail-link', isActive && 'on')}
        >
          <ClayIcon name={item.icon} size={18} />
          <span>{item.label}</span>
        </NavLink>
      ))}
      <div className="ad-rail-tools">
        <span className="tools-cap">Eszközök</span>
        {TOOLS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn('ad-rail-link', isActive && 'on')}
          >
            <ClayIcon name={item.icon} size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
