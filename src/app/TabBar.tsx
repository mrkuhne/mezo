import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from '@/components/ui/Icon'

interface Tab { id: string; label: string; icon: IconName }
const TABS: Tab[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'train', label: 'Train', icon: 'train' },
  { id: 'fuel', label: 'Fuel', icon: 'fuel' },
  { id: 'insights', label: 'Insights', icon: 'insights' },
  { id: 'me', label: 'Me', icon: 'me' },
]

export function TabBar() {
  return (
    <nav className="tab-bar">
      {TABS.map(t => (
        <NavLink key={t.id} to={`/${t.id}`} className={({ isActive }) => cn('tab-item', isActive && 'active')}>
          <span className="tab-dot" />
          <Icon name={t.icon} size={22} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
