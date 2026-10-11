// Edzés · a küldetés pieces of the in-workout flow (mezo-n4wf5.4; prototype vilagos/edzes.js `qcap`, `.vs-qt`, `.vs-ql`,
// `.vs-why`). CSS: `.ex-qc`, `.ex-qb`, `.ex-qt`, `.ex-ql`, `.ex-why` in folyadek-edzes-kozos.css.
import type { CSSProperties, ReactNode } from 'react'
import type { Icon3DName } from '@/shared/ui/clay'
import { Bub, Chev } from '@/shared/ui/folyadek'
import { clamp, cx } from '@/shared/ui/folyadek/util'

const Check = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

/** A quest as a capsule: taken (`on`) = filled as high as the quest is certain (`confidence` 0–1). A quest the app is
 *  still learning about (`confidence` null) has NO level: a dashed, empty capsule that only carries the tick.
 *  `full` = an outcome capsule (the ceremony): filled to the top when it came through. */
export function QuestCapsule(p: { on: boolean; confidence?: number | null; full?: boolean; className?: string }) {
  const learning = !p.full && p.confidence == null
  const pct = p.full ? 100 : clamp((p.confidence ?? 0) * 100)
  return (
    <span className={cx('ex-qc', p.on && 'on', learning && 'nl', p.className)} style={{ '--p': `${pct}%` } as CSSProperties} aria-hidden="true">
      <i /><Check />
    </span>
  )
}

/** The capsule as the „vállalom" switch of a quest row (the kit owns the 44px target). */
export function QuestTick(p: { on: boolean; confidence?: number | null; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="ex-qb" aria-pressed={p.on} aria-label={p.label} disabled={p.disabled} onClick={p.onClick}>
      <QuestCapsule on={p.on} confidence={p.confidence} />
    </button>
  )
}

/** The quest's (or a record's) kind: a small bubble and the name, inline in a row's sub line. */
export function QuestType(p: { icon: Icon3DName; color?: string; children: ReactNode }) {
  return <span className="ex-qt"><Bub icon={p.icon} size={22} color={p.color} />{p.children}</span>
}

/** A taken (or released) quest on the exercise it belongs to: one tappable line that opens the quest's sheet. */
export function QuestLine(p: { label: ReactNode; target: ReactNode; released?: boolean; onClick?: () => void; 'aria-label': string }) {
  return (
    <button type="button" className={cx('ex-ql', p.released && 'rel')} aria-label={p['aria-label']} onClick={p.onClick}>
      <Bub icon="t-quest" size={28} color="var(--fo-gold)" />
      <span>{p.released ? <>elengedve · <s>{p.target}</s></> : <>{p.label} · {p.target}</>}</span>
      <Chev />
    </button>
  )
}

/** The „Miért?" panel that opens under a quest row: the reason, then what it would win. */
export function QuestWhy(p: { why: ReactNode; glory?: ReactNode }) {
  return (
    <div className="ex-why">
      <p>{p.why}</p>
      {p.glory != null && p.glory !== '' && <b><Bub icon="t-star" size={22} color="var(--fo-gold)" />{p.glory}</b>}
    </div>
  )
}
