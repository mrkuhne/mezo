import { Box, Caps, Lk } from '@/shared/ui/folyadek'
import type { TodayComeback } from '@/data/train/recoveryApi'
import { deepMuscle } from '@/features/train/components/folyadek'

/** The hero's state line during the ramp (prototype `thero()`): „Visszatérő edzés · k/N". */
export function comebackPillLabel(cb: Pick<TodayComeback, 'index' | 'total'>): string {
  return `Visszatérő edzés · ${cb.index}/${cb.total}`
}

/** What is lightened today: the first ramp session also takes ~10% off the weight, the second keeps it. */
export function comebackLine(cb: Pick<TodayComeback, 'index'>): string {
  return cb.index <= 1
    ? 'Könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly'
    : 'Könnyített: harmadával kevesebb sorozat, a súly nem nő'
}

/**
 * The comeback note on the gym hero (Kímélő mód S2, mezo-q4xt2.2; Folyadék mezo-n4wf5.3 — prototype
 * vilagos/edzes.js `thero()` cb branch): the sprout box with what is lightened, the exercise list with
 * today's SERVED set counts as empty capsules (the backend already reduced them — never a client-side
 * recount; the original count is not shown), then the quiet „Kikapcsolom a könnyítést" and — while the
 * return can still be taken back (the day it ended) — „Mégsem vagyok jól".
 */
export function ComebackPill({ comeback, exercises, busy, onWaive, onUndo }: {
  comeback: TodayComeback
  exercises: readonly { id: string; name: string; sets: number; muscle?: string }[]
  busy?: boolean
  onWaive(): void
  /** Omit ⇒ no „Mégsem vagyok jól" (the return can no longer be undone). */
  onUndo?: () => void
}) {
  return (
    <>
      <Box icon="t-sprout" title={comebackLine(comeback)} className="em-cbnote" />
      {exercises.length > 0 && (
        <div className="em-cbsets">
          {exercises.map((e) => (
            <div key={e.id}>
              <span>{e.name}</span>
              <span><Caps n={e.sets} done={0} color={e.muscle ? deepMuscle(e.muscle) : undefined} /> <b>{e.sets}</b> szett</span>
            </div>
          ))}
        </div>
      )}
      <div className="em-in em-cbacts">
        <Lk disabled={busy} onClick={onWaive}>Kikapcsolom a könnyítést</Lk>
        {onUndo && <Lk disabled={busy} onClick={onUndo}>Mégsem vagyok jól</Lk>}
      </div>
    </>
  )
}
