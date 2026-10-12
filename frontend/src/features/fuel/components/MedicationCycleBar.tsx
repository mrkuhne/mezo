// ============================================================
// Mezo · MedicationCycleBar (Gyógyszer — the cycle as a row of capsules) — Folyadék F5 (mezo-n4wf5.5).
// Prototype: docs/design_2.0/prototypes/vilagos/fuel.js `cyc(now, off)` + `.fu-cyc` → `.fk-cyc`.
//
// One capsule per cycle day; the three heights are the three PHASES (peak / stable / trough), never a measured or
// estimated level. The current day is ringed and fully coloured. `off` = the empty vessels (no medication, or no dose yet).
// The phase word comes from `phaseKey` (an enum → translated); an unknown key falls back to the stored label.
//
// Presentational only. Still a semantic list (`<ul>` / `<li aria-current>`): the page's tests and screen readers
// address the strip and its current cell.
// ============================================================
import { cn } from '@/shared/lib/cn'
import { useM } from '@/shared/i18n'
import type { MedicationCycleCell, MedicationCycleConfig } from '@/data/types'

/** The liquid height of each phase, in % (prototype `PHN`). */
const PHASE_HEIGHT: Record<string, number> = { peak: 96, stable: 62, trough: 30 }

/** The cells of a cycle CONFIG (no current day): the form's preview and the „no dose yet" face. */
export function cycleCells(config: MedicationCycleConfig): MedicationCycleCell[] {
  return Array.from({ length: Math.max(0, config.cycleLengthDays) }, (_, i) => {
    const day = i + 1
    const phase = config.phases.find(p => day >= p.fromDay && day <= p.toDay)
    return { day, phaseKey: phase?.key ?? '', label: phase?.label ?? '', current: false }
  })
}

/** The phase's word: the enum's translation, else what is stored. */
export function usePhaseWord(): (phaseKey: string, stored?: string) => string {
  const M = useM().fuelKieg.med
  return (phaseKey, stored) => (M.phase as Record<string, string>)[phaseKey] ?? stored ?? phaseKey
}

export function MedicationCycleBar({ week, off, dim }: {
  week: MedicationCycleCell[]
  /** empty vessels: nothing is poured yet */
  off?: boolean
  /** the quiet face (a preview, an empty state) */
  dim?: boolean
}) {
  const M = useM().fuelKieg.med
  const word = usePhaseWord()
  const now = off ? undefined : week.find(cell => cell.current)
  return (
    <ul role="list" className={cn('fk-cyc', dim && 'fk-off')}
      aria-label={now ? M.cycAriaNow(now.day, week.length, word(now.phaseKey, now.label)) : M.cycAria}>
      {week.map(cell => {
        const current = !off && cell.current
        return (
          <li key={cell.day} aria-current={current ? 'true' : undefined}
            aria-label={M.cellAria(cell.day, word(cell.phaseKey, cell.label))}
            className={cn(PHASE_HEIGHT[cell.phaseKey] != null && cell.phaseKey, current && 'now')}>
            <span className="t" aria-hidden="true"><i style={{ height: `${off ? 0 : PHASE_HEIGHT[cell.phaseKey] ?? 50}%` }} /></span>
            <b>{word(cell.phaseKey, cell.label)}</b>
            <small>{M.dayNum(cell.day)}</small>
          </li>
        )
      })}
    </ul>
  )
}
