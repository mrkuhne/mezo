import type { CSSProperties, ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Wave } from './Wave'
import { clamp } from './util'

export interface VialItem { label: string; value: ReactNode; pct: number; color?: string; icon?: Icon3DName; mark?: ReactNode; note?: string; onClick?: () => void }

function Vial({ it, height }: { it: VialItem; height?: number }) {
  const c = it.color ?? 'var(--dom)'
  const pct = clamp(it.pct)
  const inner = (
    <>
      <span className="fo-tube" style={height ? { height } : undefined}>
        {it.mark != null && <em>{it.mark}</em>}
        <span className="l" style={{ '--p': `${pct}%` } as CSSProperties}>
          <Wave color={`color-mix(in srgb,${c} 70%,#fff)`} />
        </span>
        {it.icon && <span className={pct >= 30 ? 'fo-tube-ic fo-on-liquid' : 'fo-tube-ic'}><Icon3D name={it.icon} size={34} /></span>}
      </span>
      <b>{it.value}</b>
      <small>{it.label}{it.note && <i>{it.note}</i>}</small>
    </>
  )
  const style = { '--c': c } as CSSProperties
  return it.onClick
    ? <button type="button" className="fo-vial" style={style} onClick={it.onClick}>{inner}</button>
    : <div className="fo-vial" style={style}>{inner}</div>
}

/** 2–5 test tubes side by side. */
export function Vials(p: { items: VialItem[]; height?: number }) {
  return (
    <div className="fo-vials" style={{ gridTemplateColumns: `repeat(${p.items.length},1fr)` }}>
      {p.items.map((it, i) => <Vial key={i} it={it} height={p.height} />)}
    </div>
  )
}
