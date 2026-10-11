// Edzés · the pieces of the in-workout page that are not the set grid or the dock (mezo-n4wf5.4; prototype
// vilagos/edzes.js `.vs-pv`, `.vs-tools`, `.vs-tg`, `.vs-xl`, `.vs-dchip`, `.vs-leg`, `.vs-side`, `.vs-mtoast`, `.vs-ret`).
// CSS: `.ex-pv`, `.ex-tools`, `.ex-tg`, `.ex-xl`, `.ex-dchip`, `.ex-leg`, `.ex-side`, `.ex-mtw`, `.ex-mtoast`, `.ex-ret`
// in folyadek-edzes-kozos.css.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Bub, Pill } from '@/shared/ui/folyadek'
import { cx } from '@/shared/ui/folyadek/util'
import type { SetSide } from '../../logic/workoutState'

export interface ProgressVessel { id: string; /** Accessible name: „Húzódzkodás · 2 / 4 szett". */ label: string; done: number; planned: number; color: string; off?: boolean }

/** The row of small vessels on top of the session: one per exercise, as wide as its share of the sets, filled with its
 *  done share. The one on top (`activeId`) wears the ring; a tap brings that exercise on top. */
export function ProgressVessels(p: { items: ProgressVessel[]; activeId: string | null; onPick: (id: string) => void; className?: string }) {
  return (
    <div className={cx('ex-pv', p.className)} role="group" aria-label="Gyakorlatok">
      {p.items.map((x, i) => (
        <button key={x.id} type="button" aria-label={x.label} aria-current={x.id === p.activeId ? 'true' : undefined}
          className={cx(x.id === p.activeId && 'on', x.planned > 0 && x.done >= x.planned && 'full', x.off && 'off')}
          style={{ '--c': x.color, flex: Math.max(1, x.planned) } as CSSProperties} onClick={() => p.onPick(x.id)}>
          <span><i style={{ '--pw': `${x.planned > 0 ? Math.min(100, (x.done / x.planned) * 100) : 0}%` } as CSSProperties} /></span>
          <small>{i + 1}. · {x.done}/{x.planned}</small>
        </button>
      ))}
    </div>
  )
}

/** The hero's tool row (Rekordok · Technika). */
export function ToolRow({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('ex-tools', className)}>{children}</div>
}

/** One tool: a small bubble and its word. */
export function ToolBtn({ icon, className, type = 'button', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: Icon3DName }) {
  return <button type={type} className={cx('ex-tool', className)} {...rest}><Bub icon={icon} size={26} />{children}</button>
}

/** Cells of small label + value: ONE cell is a state line in the hero (kihagyva · lecserélve · első alkalom); two stand
 *  side by side on the records sheet (Múlt hét / Mai cél). */
export function Cells({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('ex-tg', className)}>{children}</div>
}

/** One cell. `target` = the one that is today's goal (ringed); `children` = what hangs under the value (a `DeltaChip`). */
export function Cell(p: { label: ReactNode; value: ReactNode; target?: boolean; children?: ReactNode }) {
  return <span className={p.target ? 't' : undefined}><small>{p.label}</small><b>{p.value}</b>{p.children}</span>
}

/** A quiet line under the hero's head: where the exercise came from, its note (tappable), a reason. */
export function InfoLine({ icon, onClick, className, children, ...rest }: { icon: Icon3DName; onClick?: () => void; className?: string; children: ReactNode; 'aria-label'?: string }) {
  const inner = <><Bub icon={icon} size={22} /><span>{children}</span></>
  return onClick
    ? <button type="button" className={cx('ex-xl', className)} onClick={onClick} {...rest}>{inner}</button>
    : <p className={cx('ex-xl', className)} {...rest}>{inner}</p>
}

/** The step against last week in one chip: up (more), down (taken back), hold. */
export function DeltaChip(p: { tone: 'up' | 'down' | 'hold'; children: ReactNode }) {
  return <span className={cx('ex-dchip', p.tone !== 'hold' && p.tone)} title="A múlt héthez képest">{p.children}</span>
}

export type SetVerdict = 'tick' | 'record' | 'up' | 'down'
export const VERDICT_WORD: Record<SetVerdict, string> = { tick: 'célsávban', record: 'rekord', up: 'cél fölött', down: 'cél alatt' }
export const VERDICT_ICON: Record<SetVerdict, Icon3DName> = { tick: 't-tick', record: 't-record', up: 't-up', down: 't-down' }
export const VERDICT_COLOR: Record<SetVerdict, string> = { tick: 'var(--fo-ok)', record: 'var(--fo-gold)', up: 'var(--fo-ok)', down: 'var(--fo-warn)' }

/** What the mark at the end of a done set says. */
export function VerdictLegend({ className }: { className?: string }) {
  return (
    <div className={cx('ex-leg', className)}>
      {(Object.keys(VERDICT_WORD) as SetVerdict[]).map((k) => <span key={k}><Bub icon={VERDICT_ICON[k]} size={24} color={VERDICT_COLOR[k]} />{VERDICT_WORD[k]}</span>)}
    </div>
  )
}

const SIDES: [SetSide, string][] = [['L', 'Bal'], ['B', 'Mindkettő'], ['R', 'Jobb']]

/** Which side the set was done on (isolation exercises). Tapping the pressed one clears it. */
export function SidePicker(p: { value: SetSide | null; onChange: (side: SetSide | null) => void; disabled?: boolean; className?: string }) {
  return (
    <div className={cx('ex-side', p.className)} role="group" aria-label="Oldal">
      <small>Oldal</small>
      {SIDES.map(([k, l]) => <Pill key={k} on={p.value === k} disabled={p.disabled} onClick={() => p.onChange(p.value === k ? null : k)}>{l}</Pill>)}
    </div>
  )
}

/** The record toast in the light look. Mount it as the FIRST child of the page (it is sticky and takes no room). */
export function RecordToast(p: { eyebrow: ReactNode; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="ex-mtw">
      <div className="ex-mtoast" role="status">
        <Bub icon="t-record" size={46} color="var(--fo-gold)" />
        <div><small>{p.eyebrow}</small><strong>{p.value}</strong>{p.note != null && p.note !== '' && <span>{p.note}</span>}</div>
      </div>
    </div>
  )
}

/** The way back into a running workout, floating on every other page: a liquid disc with the done-set count. The layer
 *  that shows it (`app/FloatingReturnLayer`) places it; this is only the button. */
export function ReturnFab({ doneSets, className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { doneSets: number }) {
  return (
    <button type={type} className={cx('ex-ret', className)} aria-label="Vissza az edzéshez" {...rest}>
      <Icon3D name="t-dumbbell" size={30} />
      {doneSets > 0 && <b aria-hidden="true">{doneSets}</b>}
    </button>
  )
}
