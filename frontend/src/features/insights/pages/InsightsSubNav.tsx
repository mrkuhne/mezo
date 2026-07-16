import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { visibleInsightsTabs } from '@/features/insights/pages/tabs'

export function InsightsSubNav() {
  return (
    <nav
      className="np-pills"
      aria-label="Insights alnavigáció"
      style={{ '--pill-accent': 'var(--lav)', '--pill-accent-strong': 'var(--lav-deep)' } as React.CSSProperties}
    >
      {visibleInsightsTabs().map(({ to, label, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('np-pill np-press', isActive && 'on')}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
