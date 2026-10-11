// Edzés · the set grid of the exercise on top (mezo-n4wf5.4; prototype vilagos/edzes.js `setRow`, `.vs-sets`, `.vs-side`,
// `.vs-adj`). Presentational: the page owns the draft of the cursor row and every handler. CSS: `.ex-sets`, `.ex-adj`.
import type { CSSProperties, ReactNode } from 'react'
import { Bub } from '@/shared/ui/folyadek'
import { cx } from '@/shared/ui/folyadek/util'
import type { SetSide } from '../../logic/workoutState'
import { SidePicker, VERDICT_COLOR, VERDICT_ICON, VERDICT_WORD, type SetVerdict } from './session'

const Check = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

/** A logged set: its numbers and, at the end, the verdict mark (the record mark wins). Tapping the mark opens the edit sheet. */
export interface DoneSetRow { kind: 'done'; kg: ReactNode; reps: ReactNode; rir: ReactNode; verdict: SetVerdict
  /** Still being saved: the mark is dim and not tappable. */
  busy?: boolean
  onEdit?: () => void }
/** A set still to come: the target, quiet. */
export interface PendingSetRow { kind: 'pending'; kg: ReactNode; reps: ReactNode; rir: ReactNode }
/** THE cursor: the one editable row of this exercise. The texts are the page's draft; `weightless` = no weight field
 *  (plyo); `disabled` = logging is blocked (the workout did not start). */
export interface CursorSetRow { kind: 'cursor'; kg: string; reps: string; rir: string; weightless?: boolean; disabled?: boolean
  onKg: (v: string) => void; onKgBlur?: () => void; onReps: (v: string) => void; onRir: (v: string) => void; onSubmit: () => void }
export type SetGridRow = DoneSetRow | PendingSetRow | CursorSetRow

/**
 * The grid: # · kg · ism · RIR · mark. Rows are numbered from 1 in the order given. Under it, when asked for: the side
 * picker (isolation) and the „…kg-hoz igazítva" caption. `name` scopes the accessible names („Fekvenyomás, 2. szett, súly").
 */
export function SetGrid(p: { name: string; color: string; rows: SetGridRow[]; rirMax?: number
  side?: { value: SetSide | null; onChange: (s: SetSide | null) => void }
  /** The adjust caption under the grid („70 kg-hoz igazítva · ajánlás 72,5 × 10"). */
  adjust?: ReactNode; className?: string }) {
  const hasCursor = p.rows.some((r) => r.kind === 'cursor')
  return (
    <>
      <div className={cx('ex-sets', p.className)} style={{ '--c': p.color } as CSSProperties} role="group" aria-label={`${p.name} · szettek`}>
        <span className="h" aria-hidden="true">#</span><span className="h" aria-hidden="true">kg</span><span className="h" aria-hidden="true">ism</span><span className="h" aria-hidden="true">RIR</span><span aria-hidden="true" />
        {p.rows.map((r, j) => {
          const n = `${j + 1}. szett`
          if (r.kind === 'done') {
            return (
              <div key={j} className="r" role="group" aria-label={`${n} · kész`}>
                <span className="n f">{j + 1}</span><span className="v d">{r.kg}</span><span className="v d">{r.reps}</span><span className="v d">{r.rir}</span>
                <button type="button" className={cx('vd', r.busy && 'busy')} disabled={r.busy || !r.onEdit} aria-busy={r.busy || undefined}
                  aria-label={`${n} szerkesztése · ${r.busy ? 'mentés folyamatban' : VERDICT_WORD[r.verdict]}`} onClick={r.onEdit}>
                  <Bub icon={VERDICT_ICON[r.verdict]} size={36} color={VERDICT_COLOR[r.verdict]} />
                </button>
              </div>
            )
          }
          if (r.kind === 'cursor') {
            return (
              <form key={j} className="r" aria-label={`${n} · most`} onSubmit={(e) => { e.preventDefault(); if (!r.disabled) r.onSubmit() }}>
                <span className="n h">{j + 1}</span>
                <input className="vin" type="text" inputMode="decimal" aria-label={`${p.name}, ${n}, súly`} disabled={r.weightless}
                  value={r.weightless ? '—' : r.kg} onChange={(e) => r.onKg(e.target.value)} onBlur={r.onKgBlur} />
                <input className="vin" type="text" inputMode="numeric" aria-label={`${p.name}, ${n}, ismétlés`} value={r.reps} onChange={(e) => r.onReps(e.target.value)} />
                <input className="vin" type="text" inputMode="numeric" aria-label={`${p.name}, ${n}, RIR${p.rirMax != null ? ` (0–${p.rirMax})` : ''}`} value={r.rir} onChange={(e) => r.onRir(e.target.value)} />
                <button type="submit" className="tk" disabled={r.disabled} aria-label={`${n} mentése`}><Check /></button>
              </form>
            )
          }
          return (
            <div key={j} className="r" role="group" aria-label={`${n} · terv`}>
              <span className="n">{j + 1}</span><span className="v u">{r.kg}</span><span className="v u">{r.reps}</span><span className="v u">{r.rir}</span><span />
            </div>
          )
        })}
      </div>
      {p.side && hasCursor && <SidePicker value={p.side.value} onChange={p.side.onChange} />}
      {p.adjust != null && p.adjust !== '' && hasCursor && <p className="ex-adj">{p.adjust}</p>}
    </>
  )
}
