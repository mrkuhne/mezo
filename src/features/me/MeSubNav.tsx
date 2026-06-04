import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'

const SUBNAV: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/me', label: 'Profil', end: true },
  { to: '/me/goals', label: 'Cél' },
  { to: '/me/sleep', label: 'Alvás' },
  { to: '/me/people', label: 'Emberek' },
  { to: '/me/knowledge', label: 'Tudás' },
]

export function MeSubNav() {
  return (
    <nav className="subnav" aria-label="Me alnavigáció">
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
