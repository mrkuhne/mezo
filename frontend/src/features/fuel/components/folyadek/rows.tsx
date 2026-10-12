// Fuel · Folyadék rows and second-level pieces (mezo-n4wf5.5; bible F3.6). Prototype: fuel.js `irow`, `lineCard` / `cLine`,
// `kv`, `tip`, `lgd`, `numG`, `.fu-kms`, `split`.
import type { CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { Bub, Chev, Row, Stepper } from '@/shared/ui/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import { MacroTriple } from './macros'

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

/** A two-storey row (`irow`): icon · name (+ sub) · value on top, and a full-width second line under them (a level, a status
 *  pill, an amount) that still fits at 320 px. The kit `Row` with one more line — never a second row recipe. */
export function ItemRow({ icon, title, sub, value, children, onClick, ariaLabel }: {
  icon?: Icon3DName; title: ReactNode; sub?: ReactNode; value?: ReactNode; children?: ReactNode; onClick?: () => void; ariaLabel?: string
}) {
  return (
    <Row className="fx-it" icon={icon} title={title} sub={sub} value={value} onClick={onClick} chev={false} aria-label={ariaLabel}
      right={<span className={cx('fx-l2', !icon && 'flush')}>{children}</span>} />
  )
}

/** One editable line of a draft / a recipe (`lineCard`, `cLine`): name + tags + remove on top, the amount stepper (typed or
 *  stepped) and the kcal under it, the three macro cells, then whatever the caller adds (`Nutri`, a „nézd át" note, tuning).
 *  `kcal: null` = an unresolved line („—"). The caller owns every handler and the amount's text state. */
export function EditLine({ icon, name, tags, onRemove, amount, unit, onDec, onInc, decDisabled, incDisabled, kcal, macros, children }: {
  icon: Icon3DName; name: string; tags?: ReactNode; onRemove?: () => void
  /** The amount field: `value`, `onChange`, `onBlur`, `inputMode`… — handed to the kit `Stepper`'s input. */
  amount: InputHTMLAttributes<HTMLInputElement>; unit: ReactNode; onDec: () => void; onInc: () => void; decDisabled?: boolean; incDisabled?: boolean
  kcal: number | null; macros: { p: number | null; c: number | null; f: number | null } | null; children?: ReactNode
}) {
  const M = useM()
  const L = M.fuelKozos.line
  return (
    <div className="fx-ln">
      <div className="fx-lnt">
        <Bub icon={icon} size={36} />
        <span className="g"><strong>{name}</strong>{tags}</span>
        {onRemove && <button type="button" className="fx-x" onClick={onRemove} aria-label={L.remove(name)}>×</button>}
      </div>
      <div className="fx-lns">
        <span className="fx-amt">
          <Stepper name={name} onDec={onDec} onInc={onInc} decDisabled={decDisabled} incDisabled={incDisabled}
            input={{ inputMode: 'decimal', 'aria-label': L.amount(name), ...amount }} />
          <small>{unit}</small>
        </span>
        <span className="fx-lnk"><b>{kcal == null ? '—' : fmtGrouped(kcal)}</b><small>kcal</small></span>
      </div>
      <MacroTriple p={macros?.p ?? null} c={macros?.c ?? null} f={macros?.f ?? null} />
      {children}
    </div>
  )
}

/** Label–value tiles, two a row (`kv`). `spanLast`: an odd last tile takes the whole row. */
export function Kv({ items, spanLast, className }: { items: Array<[label: ReactNode, value: ReactNode]>; spanLast?: boolean; className?: string }) {
  return <div className={cx('fx-kv', spanLast && 'span-last', className)}>{items.map(([k, v], i) => <div key={i}><small>{k}</small><b>{v}</b></div>)}</div>
}

/** An unboxed hint (`tip`): a bubble icon, a bold line and the quiet sentence under it. (A tinted box is the kit `Box`.)
 *  Without a `title` the sentence stands alone beside the bubble, in ink (a stored reason, a one-line explanation). */
export function Tip({ icon, title, color, children }: { icon: Icon3DName; title?: ReactNode; color?: string; children?: ReactNode }) {
  const bare = title == null || title === ''
  return (
    <div className={cx('fx-tip', bare && 'bare')}>
      <Bub icon={icon} size={38} color={color} />
      <span>{!bare && <b>{title}</b>}{children != null && <small>{children}</small>}</span>
    </div>
  )
}

export type LgdKind = 'liq' | 'over' | 'hatch' | 'line' | 'dash' | 'gap' | 'dot' | 'band' | 'ring' | 'tr' | 'water'
  // the meal clock (`ora`): the other windows, the training arc, the night
  | 'oth' | 'trn' | 'ngt'
  // the week (`trendek`): a weekend day's ground, a gentle-mode day, the training dot
  | 'we' | 'rec' | 'trd'
/** The key under a Fuel chart (`lgd`): square swatches that repeat the chart's own marks (liquid, over the budget, a dashed
 *  target, an unlogged day, a band, a point…). The kit `Legend` (drops) stays for everything that is a level.
 *  `center` = under a graphic that stands in the middle (a hero, a dial). */
export function Lgd({ items, center, className }: { items: Array<[kind: LgdKind, label: ReactNode]>; center?: boolean; className?: string }) {
  return <div className={cx('fx-lg', center && 'center', className)}>{items.map(([k, l], i) => <span key={i}><i className={k} />{l}</span>)}</div>
}

/** The tinted result line (`.fx-tot`): what it is on the left (+ a quiet line under it), the big number on the right. */
export function Tot({ label, sub, value, unit, className, ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  label: ReactNode; sub?: ReactNode; value: ReactNode; unit?: ReactNode
}) {
  return (
    <div className={cx('fx-tot', className)} {...rest}>
      <span>{label}{sub != null && <small>{sub}</small>}</span>
      <b>{value}{unit != null && <small>{unit}</small>}</b>
    </div>
  )
}

/** A graphic on the left, the big numeral and two or three facts on the right (`numG`) — the inside of a detail hero. */
export function NumG({ graphic, value, unit, children }: { graphic: ReactNode; value: ReactNode; unit?: ReactNode; children?: ReactNode }) {
  return (
    <div className="fx-ng">
      <span className="gg">{graphic}</span>
      <div className="nn"><span className="fx-ng-n">{value}{unit != null && <small>{unit}</small>}</span>{children}</div>
    </div>
  )
}

/** The pill strip under the tabs (`.fu-kms`): gentle mode, a waiting diet suggestion, the „this is booked to another day"
 *  note. A link with a chevron when `to` is given, a button with a chevron with `onClick`, a plain rounded note otherwise. */
export function Strip({ icon, color, warn, onClick, to, ariaLabel, className, children }: {
  icon: Icon3DName; color?: string; warn?: boolean; onClick?: () => void; to?: string; ariaLabel?: string; className?: string; children: ReactNode
}) {
  const inner = <><Bub icon={icon} size={30} color={color ?? (warn ? 'var(--fo-warn)' : undefined)} /><span>{children}</span></>
  const cls = cx('fx-kms', warn && 'warn', className)
  if (to != null) return <Link to={to} className={cls} aria-label={ariaLabel}>{inner}<Chev /></Link>
  return onClick
    ? <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel}>{inner}<Chev /></button>
    : <div className={cls}>{inner}</div>
}

export interface SplitPart { label: ReactNode; pct: number; color: string; value?: ReactNode }
/** One vessel holding several liquids, with its key (`split`): the energy split of a meal, the make-up of a shelf. Parts with
 *  0 % are left out of the vessel and kept in the key. (The kit's `Split` is the two-part done / planned bar — another thing.) */
export function SplitBar({ parts, height = 22 }: { parts: SplitPart[]; height?: number }) {
  return (
    <>
      <div className="fx-split" style={{ height }} aria-hidden="true">
        {parts.map((p, i) => (p.pct > 0 ? <i key={i} style={{ flex: `${p.pct} 1 0`, '--c': p.color } as CSSProperties} /> : null))}
      </div>
      <div className="fx-leg">
        {parts.map((p, i) => <span key={i} style={{ '--c': p.color } as CSSProperties}><i />{p.label}<b>{p.value ?? `${p.pct}%`}</b></span>)}
      </div>
    </>
  )
}
