import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { visibleInsightsTabs } from '@/features/insights/pages/tabs'

export function InsightsSubNav() {
  return (
    <nav
      className="subnav"
      aria-label="Insights alnavigáció"
      style={{ position: 'sticky', top: 0, background: 'var(--canvas)', zIndex: 5, paddingTop: 8 }}
    >
      {visibleInsightsTabs().map(({ to, label, end }) => (
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
