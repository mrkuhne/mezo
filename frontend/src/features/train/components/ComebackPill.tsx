import { Icon3D } from '@/shared/ui/clay'
import type { TodayComeback } from '@/data/train/recoveryApi'

/** The hero's status pill during the ramp (prototype `thero()` `.stpill.cbk`): „VISSZATÉRŐ EDZÉS · k/N". */
export function comebackPillLabel(cb: Pick<TodayComeback, 'index' | 'total'>): string {
  return `VISSZATÉRŐ EDZÉS · ${cb.index}/${cb.total}`
}

/** What is lightened today: the first ramp session also takes ~10% off the weight, the second keeps it. */
export function comebackLine(cb: Pick<TodayComeback, 'index'>): string {
  return cb.index <= 1
    ? 'Könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly'
    : 'Könnyített: harmadával kevesebb sorozat, a súly nem nő'
}

/**
 * The comeback note on the gym hero (Kímélő mód S2, mezo-q4xt2.2 — prototype elo/edzes.html
 * `cbBlock()`): t-sprout + what is lightened, the exercise list with today's SERVED set counts
 * (the backend already reduced them — never a client-side recount), then the quiet
 * „Kikapcsolom a könnyítést" and — while the return can still be taken back (the day it ended) —
 * „Mégsem vagyok jól". Flat, inside the frameless hero.
 */
export function ComebackPill({ comeback, exercises, busy, onWaive, onUndo }: {
  comeback: TodayComeback
  exercises: readonly { id: string; name: string; sets: number }[]
  busy?: boolean
  onWaive(): void
  /** Omit ⇒ no „Mégsem vagyok jól" (the return can no longer be undone). */
  onUndo?: () => void
}) {
  return (
    <>
      <div className="trm-cbnote">
        <div className="trm-cbnote-hd">
          <Icon3D name="t-sprout" size={28} />
          <span>{comebackLine(comeback)}</span>
        </div>
        {exercises.length > 0 && (
          <div className="trm-cbsets">
            {exercises.map((e) => (
              <div key={e.id}><span>{e.name}</span><b>{e.sets} szett</b></div>
            ))}
          </div>
        )}
      </div>
      <div className="trm-cbacts">
        <button type="button" className="trm-kmlink" disabled={busy} onClick={onWaive}>Kikapcsolom a könnyítést</button>
        {onUndo && <button type="button" className="trm-kmlink" disabled={busy} onClick={onUndo}>Mégsem vagyok jól</button>}
      </div>
    </>
  )
}
