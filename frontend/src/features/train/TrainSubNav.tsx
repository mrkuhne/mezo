import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { TRAIN_TABS } from '@/features/train/tabs'

export function TrainSubNav() {
  return (
    <nav
      className="subnav"
      aria-label="Train alnavigáció"
      style={{ position: 'sticky', top: 0, background: 'var(--canvas)', zIndex: 5, paddingTop: 8 }}
    >
      {TRAIN_TABS.map(({ to, label, end }) => (
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
