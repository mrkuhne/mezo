import type { CSSProperties, ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Wave } from './Wave'
import { clamp, cx } from './util'

export interface VialItem { label?: ReactNode; value?: ReactNode; pct: number; color?: string; icon?: Icon3DName; mark?: ReactNode; note?: ReactNode; onClick?: () => void
  /** A vial that is a toggle: `aria-pressed` on its button. */
  pressed?: boolean
  /** A dashed waterline across the tube at this % (a target, last week's level). */
  wl?: number
  /** Planned, not poured yet: a plain white tube, quiet value. */
  ghost?: boolean
  /** Rest / deload: a hatched tube. */
  hatch?: boolean
  /** Spilling: two drops beside the rim. */
  over?: boolean
  /** The current one: ringed in its colour, bold label. */
  now?: boolean
  /** The selected one: ringed in ink. */
  sel?: boolean
  /** A custom node standing in the tube instead of `icon` (a muscle chip). */
  node?: ReactNode
  /** The accessible name of a clickable vial (default: its text). */
  ariaLabel?: string }

function Vial({ it, height, tube }: { it: VialItem; height?: number; tube?: boolean }) {
  const c = it.color ?? 'var(--dom)'
  // a tube keeps a sliver of liquid for any real amount and stays dry at zero (prototype `tube`)
  const pct = tube && it.pct > 0 ? clamp(it.pct, 3) : clamp(it.pct)
  // the small mark at the top turns white once the liquid stands behind it (bible §5)
  const covered = (1 - pct / 100) * (height ?? 168) <= 22
  const inner = (
    <>
      <span className="fo-tube" style={height ? { height } : undefined}>
        {it.mark != null && <em className={covered ? 'on' : undefined}>{it.mark}</em>}
        {(!tube || pct > 0) && (
          <span className="l" style={{ '--p': `${pct}%` } as CSSProperties}>
            <Wave color={`color-mix(in srgb,${c} 70%,#fff)`} />
          </span>
        )}
        {it.wl != null && <i className="wl" style={{ bottom: `${clamp(it.wl, 0, 97)}%` }} />}
        {it.node != null
          ? <span className="fo-tube-nd">{it.node}</span>
          : it.icon && <span className={pct >= 30 ? 'fo-tube-ic fo-on-liquid' : 'fo-tube-ic'}><Icon3D name={it.icon} size={tube ? 28 : 34} /></span>}
      </span>
      {it.over && <i className="ov" />}
      {it.value != null && <b>{it.value}</b>}
      {(it.label != null || it.note) && <small>{it.label}{it.note && <i>{it.note}</i>}</small>}
    </>
  )
  const style = { '--c': c } as CSSProperties
  const cls = cx('fo-vial', it.now && 'now', it.ghost && 'ghost', it.hatch && 'hatch', it.sel && 'sel', it.over && 'over')
  return it.onClick
    ? <button type="button" className={cls} style={style} onClick={it.onClick} aria-pressed={it.pressed} aria-label={it.ariaLabel}>{inner}</button>
    : <div className={cls} style={style}>{inner}</div>
}

/** 2–6 test tubes side by side. `size`: sm = inside a hero or card, xs = six across. */
export function Vials(p: { items: VialItem[]; height?: number; size?: 'md' | 'sm' | 'xs'; className?: string }) {
  return (
    <div className={cx('fo-vials', p.size === 'sm' && 'sm', p.size === 'xs' && 'sm xs', p.className)} style={{ gridTemplateColumns: `repeat(${p.items.length},1fr)` }}>
      {p.items.map((it, i) => <Vial key={i} it={it} height={p.height} />)}
    </div>
  )
}

/** The compact tubes of a card (weeks, days, muscles; prototype `tubes`): 112px tall by default, any number across, a dry tube
 *  at zero. Takes every `VialItem` option (waterline, ghost, hatch, over, now, sel, node). `size`: sm / wk = smaller captions
 *  (wk = seven across); `gap` in px. */
export function Tubes(p: { items: VialItem[]; height?: number; size?: 'md' | 'sm' | 'wk'; gap?: number; className?: string; 'aria-label'?: string }) {
  return (
    <div className={cx('fo-vials fo-tubes', p.size === 'sm' && 'ts', p.size === 'wk' && 'wk', p.className)} role={p['aria-label'] ? 'group' : undefined} aria-label={p['aria-label']}
      style={{ gridTemplateColumns: `repeat(${p.items.length},minmax(0,1fr))`, ...(p.gap != null ? { gap: p.gap } : {}) }}>
      {p.items.map((it, i) => <Vial key={i} it={it} height={p.height ?? 112} tube />)}
    </div>
  )
}
