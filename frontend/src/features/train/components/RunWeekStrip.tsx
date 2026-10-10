// ============================================================
// Mezo · RunWeekStrip — the weeks of a running block as tubes (the Futás hero's graphic).
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `futas()` hero `tubes(…, {h:70, cls:'wk'})`):
// one tube per week — a past week holds what was logged of it, the current week is ringed and
// stands at its logged share under the „full week" waterline, a future week is a dry ghost tube
// with the same waterline. Presentational: `done` / `planned` are per week (index 0 = week 1),
// counted by the page from the block structure and the run log.
// ============================================================
import { Tubes, type VialItem } from '@/shared/ui/folyadek'

/** A full tube stops just under the rim (prototype `94`). */
const FULL = 94

export function RunWeekStrip({ weeks, currentWeek, done = [], planned = [] }: {
  weeks: number
  currentWeek: number
  /** Logged sessions per week. */
  done?: number[]
  /** Prescribed sessions per week. */
  planned?: number[]
}) {
  const items: VialItem[] = Array.from({ length: Math.max(0, weeks) }, (_, i) => {
    const n = i + 1
    const d = done[i] ?? 0
    const p = planned[i] ?? 0
    const share = p > 0 ? Math.min(1, d / p) : 0
    if (n > currentWeek) return { label: `${n}.`, pct: 0, wl: FULL, ghost: true, value: '' }
    const now = n === currentWeek
    return {
      label: `${n}.`,
      pct: share * FULL,
      wl: now && share < 1 ? FULL : undefined,
      now,
      value: p > 0 ? `${d}/${p}` : '–',
    }
  })
  return (
    <div className="es-hg" data-weeks={weeks}>
      <Tubes items={items} height={70} size="wk" gap={5}
        aria-label={`A blokk hetei: ${currentWeek}. hét a ${weeks}-ból`} />
    </div>
  )
}
