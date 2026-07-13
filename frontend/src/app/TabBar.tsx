import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { QuickInputSheet } from '@/features/quickinput/sheets/QuickInputSheet'

interface Tab { id: string; label: string; icon: IconName }
const LEFT: Tab[] = [
  { id: 'today', label: 'Ma', icon: 'today' },
  { id: 'train', label: 'Edzés', icon: 'train' },
]
const RIGHT: Tab[] = [
  { id: 'fuel', label: 'Fuel', icon: 'fuel' },
  { id: 'me', label: 'Én', icon: 'me' },
]

function TabItem({ t }: { t: Tab }) {
  return (
    <NavLink to={`/${t.id}`} className={({ isActive }) => cn('tab-item', isActive && 'active')}>
      <span className="tab-dot" />
      <Icon name={t.icon} size={22} />
      <span>{t.label}</span>
    </NavLink>
  )
}

export function TabBar() {
  const [quickOpen, setQuickOpen] = useState(false)
  return (
    <>
      <nav className="tab-bar">
        {LEFT.map(t => <TabItem key={t.id} t={t} />)}
        <button type="button" className="tab-fab" aria-label="Gyors logolás" onClick={() => setQuickOpen(true)}>
          <Icon name="plus" size={26} />
        </button>
        {RIGHT.map(t => <TabItem key={t.id} t={t} />)}
      </nav>
      {quickOpen && <QuickInputSheet onClose={() => setQuickOpen(false)} />}
    </>
  )
}
