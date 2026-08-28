import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'

// Design 2.0 decision B (mezo-d20.1.1): five first-class tabs — Nap · Edzés · Fuel ·
// Mezo · Én. The center quick-log button moved to the floating QuickLogFab; the Insights
// section is promoted to the Mezo tab. Icons are the clay set (active = colored clay,
// inactive = muted via CSS filter — the prototype's .mtab recipe).
interface Tab { id: string; label: string; icon: ClayIconName }
const TABS: Tab[] = [
  { id: 'nap', label: 'Nap', icon: 'i-nap' },
  { id: 'train', label: 'Edzés', icon: 'i-edzes' },
  { id: 'fuel', label: 'Fuel', icon: 'i-fuel' },
  { id: 'mezo', label: 'Mezo', icon: 'i-mezo' },
  { id: 'me', label: 'Én', icon: 'i-emberek' },
]

export function TabBar() {
  return (
    <nav className="tab-bar">
      {TABS.map(t => (
        <NavLink key={t.id} to={`/${t.id}`} className={({ isActive }) => cn('tab-item', isActive && 'active')}>
          <span className="tab-ico"><ClayIcon name={t.icon} size={27} /></span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
