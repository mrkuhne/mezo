// Mezo · TestViewSwitch — the Én „Test" tab head (mezo-lhqw7): Súly | Alvás are two views of
// ONE tab. The pages keep their own routes; the switch replaces history so the two views
// never stack. The page's own action (＋ Súly naplózása / ＋ Log) rides in the same row.
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'

const VIEWS = [
  { key: 'suly', label: 'Súly', to: '/me/weight' },
  { key: 'alvas', label: 'Alvás', to: '/me/sleep' },
] as const

export function TestViewSwitch({ view, children }: { view: 'suly' | 'alvas'; children?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="ent-head">
      <div className="ent-seg" role="group" aria-label="Test nézet">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" aria-pressed={view === v.key}
            className={cn('ent-seg-btn', view === v.key && 'is-on')}
            onClick={() => { if (view !== v.key) navigate(v.to, { replace: true }) }}>
            {v.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  )
}
