import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { type Icon3DName } from '@/shared/ui/clay'
import { Btn, Lk, Acts } from './Btn'
import { Bub } from './Bub'
import { clamp, cx, type PassProps } from './util'

/** − value +. With `label` it is a whole list row (label + sub on the left, the control on the right); without, the bare control.
 *  `min` / `max` disable the ends; `auto` shows the value as a quiet word (e.g. „auto"). `name` is what the buttons are called
 *  for screen readers (default: the label). */
export function Stepper({ label, sub, value, onDec, onInc, min, max, n, auto, name, decDisabled, incDisabled, className, ...rest }: PassProps & {
  label?: ReactNode; sub?: ReactNode; value: ReactNode; onDec: () => void; onInc: () => void
  /** The numeric value behind `value`, for the `min` / `max` bounds. */
  n?: number; min?: number; max?: number; auto?: boolean; name?: string; decDisabled?: boolean; incDisabled?: boolean; className?: string
}) {
  const who = name ?? (typeof label === 'string' ? label : '')
  const lo = decDisabled || (n != null && min != null && n <= min)
  const hi = incDisabled || (n != null && max != null && n >= max)
  const ctl = (
    <span className={cx('fo-stp', label == null && className)} role="group" aria-label={who || undefined} {...(label == null ? rest : {})}>
      <button type="button" aria-label={`${who} csökkentése`.trim()} disabled={lo} onClick={onDec}>−</button>
      <b className={auto ? 'auto' : undefined} aria-live="polite">{value}</b>
      <button type="button" aria-label={`${who} növelése`.trim()} disabled={hi} onClick={onInc}>+</button>
    </span>
  )
  if (label == null) return ctl
  return (
    <div className={cx('fo-row', className)} {...rest}>
      <span className="g"><strong>{label}</strong>{sub != null && <small>{sub}</small>}</span>
      {ctl}
    </div>
  )
}

/** A range as a liquid level with its „n / 10" value beside it. The touch area is 44px tall; the track is the drawn vessel. */
export function Slider({ value, min = 1, max = 10, step = 1, onChange, unit, className, ...rest }: PassProps & {
  value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void
  /** What stands after the value (default „/ max"). */
  unit?: ReactNode; className?: string
}) {
  const pct = max > min ? clamp(((value - min) / (max - min)) * 100) : 0
  return (
    <div className={cx('fo-rng', className)}>
      <input type="range" min={min} max={max} step={step} value={value} style={{ '--p': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))} {...rest} />
      <b><span>{value}</span> {unit ?? `/ ${max}`}</b>
    </div>
  )
}

export interface PairItem { icon: Icon3DName; label: ReactNode; small?: ReactNode; onClick?: () => void; to?: string; ariaLabel?: string }

/** Two big tiles side by side: bubble icon, a small caption, the label. A tile with `to` is a link. */
export function Pair(p: { items: PairItem[]; className?: string }) {
  return (
    <div className={cx('fo-pair', p.className)}>
      {p.items.map((it, i) => {
        const inner = <><Bub icon={it.icon} size={44} />{it.small != null && <small>{it.small}</small>}{it.label}</>
        return it.to != null
          ? <Link key={i} to={it.to} onClick={it.onClick} aria-label={it.ariaLabel}>{inner}</Link>
          : <button key={i} type="button" onClick={it.onClick} aria-label={it.ariaLabel}>{inner}</button>
      })}
    </div>
  )
}

/** The foot of a sheet: the primary button takes the row, „Mégse" is the link beside it (prototype `two`). */
export function SheetActs(p: { label: ReactNode; onSave?: () => void; onCancel: () => void; cancelLabel?: ReactNode; disabled?: boolean; submit?: boolean; className?: string }) {
  return (
    <Acts className={p.className}>
      <Btn grow type={p.submit ? 'submit' : 'button'} onClick={p.onSave} disabled={p.disabled}>{p.label}</Btn>
      <Lk onClick={p.onCancel}>{p.cancelLabel ?? 'Mégse'}</Lk>
    </Acts>
  )
}
