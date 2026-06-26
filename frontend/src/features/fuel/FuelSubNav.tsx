import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'

const SUBNAV: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/fuel', label: 'Mai', end: true },
  { to: '/fuel/plan', label: 'Terv' },
  { to: '/fuel/stack', label: 'Stack' },
  { to: '/fuel/recipes', label: 'Receptek' },
  { to: '/fuel/kamra', label: 'Kamra' },
  { to: '/fuel/gyogyszer', label: 'Gyógyszer' },
]

export function FuelSubNav() {
  return (
    <nav className="subnav" aria-label="Fuel alnavigáció">
      {SUBNAV.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn('subnav-item', isActive && 'active')}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
