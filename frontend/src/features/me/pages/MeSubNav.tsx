import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'

const SUBNAV: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/me', label: 'Profil', end: true },
  { to: '/me/growth', label: 'Growth' },
  { to: '/me/goals', label: 'Cél' },
  { to: '/me/weight', label: 'Súly' },
  { to: '/me/sleep', label: 'Alvás' },
  { to: '/me/people', label: 'Emberek' },
  { to: '/me/knowledge', label: 'Tudás' },
]

export function MeSubNav() {
  return (
    <nav className="np-pills" aria-label="Me alnavigáció" style={{ '--pill-accent': 'var(--lav)', '--pill-accent-strong': 'var(--lav-deep)' } as React.CSSProperties}>
      {SUBNAV.map(({ to, label, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('np-pill np-press', isActive && 'on')}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
