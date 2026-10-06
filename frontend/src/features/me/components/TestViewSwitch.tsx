// Mezo · TestViewSwitch — the Én „Test" tab head (mezo-lhqw7): Súly | Alvás are two views of
// ONE tab. The pages keep their own routes; the switch replaces history so the two views
// never stack. The page's own action (＋ Súly naplózása / ＋ Log) rides in the same row.
// Switching remounts the page (another route), which would drop keyboard focus to <body>: the
// switch marks its own navigation (`state.fromSwitch`) and the new page's pressed segment takes
// the focus back on mount — only then, never on a plain arrival.
import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'

const VIEWS = [
  { key: 'suly', label: 'Súly', to: '/me/weight' },
  { key: 'alvas', label: 'Alvás', to: '/me/sleep' },
] as const

export function TestViewSwitch({ view, children }: { view: 'suly' | 'alvas'; children?: ReactNode }) {
  const navigate = useNavigate()
  const fromSwitch = (useLocation().state as { fromSwitch?: boolean } | null)?.fromSwitch === true
  const pressedRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (fromSwitch) pressedRef.current?.focus() }, [fromSwitch])
  return (
    <div className="ent-head">
      <div className="ent-seg" role="group" aria-label="Test nézet">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" aria-pressed={view === v.key} ref={view === v.key ? pressedRef : undefined}
            className={cn('ent-seg-btn', view === v.key && 'is-on')}
            onClick={() => { if (view !== v.key) navigate(v.to, { replace: true, state: { fromSwitch: true } }) }}>
            {v.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  )
}
