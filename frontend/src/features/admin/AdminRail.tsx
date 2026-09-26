import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

// Left rail for the admin hub (mezo-d5iy.9) — ported from the prototype's RAIL array
// (docs/design_2.0/prototypes/src/admin-body.html). No TabBar precedent here: this is a
// desktop-only surface, one icon per section, active state via NavLink's isActive.
//
// Üveg (mezo-me75u.10, prototype `uveg-reteg-body.html` `admin()`): the rail is ONE lavender
// glass panel (no sheen — it is always visible, like the TabBar), the brand is the gradient
// „Mezo” wordmark with an ADMIN eyebrow, and every link wears a Titanium 3D icon. The mapping
// lives HERE (context-bound meanings, bible U1 rule 7 — not `CLAY_TO_3D`): the old clay glyphs
// (i-nap, i-minta, i-kristaly, …) mean other things elsewhere in the app.
interface RailItem { to: string; label: string; icon: Icon3DName; end?: boolean }
const RAIL: RailItem[] = [
  { to: '/admin', label: 'Pulzus', icon: 't-signal', end: true },
  { to: '/admin/users', label: 'Emberek', icon: 't-people' },
  { to: '/admin/features', label: 'Funkciók', icon: 't-grid' },
  { to: '/admin/cost', label: 'Költés', icon: 't-coin' },
  { to: '/admin/memory', label: 'Memória', icon: 't-layers' },
  { to: '/admin/accounts', label: 'Meghívók és fiókok', icon: 't-key' },
]
// The data browser is a drill-through TOOL, not a destination (mezo-l096): it moves out
// of the main list into the rail foot, under an "Eszközök" caption.
const TOOLS: RailItem[] = [{ to: '/admin/data', label: 'Nyers adatok', icon: 't-graph' }]

export function AdminRail() {
  return (
    <nav className="ad-rail glass is-still" aria-label="Admin navigáció">
      <div className="brand">
        <strong>Mezo</strong>
        <small>Admin</small>
      </div>
      {RAIL.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => cn('ad-rail-link', isActive && 'on')}
        >
          <Icon3D name={item.icon} size={26} />
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
            <Icon3D name={item.icon} size={26} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
