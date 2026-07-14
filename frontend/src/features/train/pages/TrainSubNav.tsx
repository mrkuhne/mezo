import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { TRAIN_TABS } from '@/features/train/pages/tabs'

export function TrainSubNav() {
  return (
    <nav className="np-pills" aria-label="Train alnavigáció">
      {TRAIN_TABS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn('np-pill np-press', isActive && 'on')}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
