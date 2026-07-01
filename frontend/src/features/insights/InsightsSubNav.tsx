import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { INSIGHTS_TABS } from '@/features/insights/tabs'

export function InsightsSubNav() {
  return (
    <nav
      className="subnav"
      aria-label="Insights alnavigáció"
      style={{ position: 'sticky', top: 0, background: 'var(--canvas)', zIndex: 5, paddingTop: 8 }}
    >
      {INSIGHTS_TABS.map(({ to, label, end }) => (
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
