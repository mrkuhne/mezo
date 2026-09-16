// ============================================================
// Mezo · sportStars — the sport-session star math (mezo-88iwa.9, T8 Task 5).
//
// Ported from the prototype (docs/design_2.0/prototypes/companion-titanium/
// sport-state.js:171-176 — sportStars): "time against what this sport
// usually asks of you carries most of it; how hard it felt carries the
// rest — so a short brutal session is not written off." Same halves math as
// the gym ceremony (`starsFor`, cerScore.ts) — imported, not duplicated.
// ============================================================
import { starsFor } from './cerScore'

export interface SportScore {
  /** timeShare*0.7 + effortShare*0.3, each share clamped to 0..1 first. */
  ratio: number
  /** starsFor(ratio), in halves. */
  stars: number
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * Stars for a sport session. `targetMinutes` is the sport's own usual duration
 * (prototype `sport.target`); a non-positive target contributes no time share
 * rather than dividing by zero or 0/0-ing into NaN.
 */
export function sportStars(minutes: number, targetMinutes: number, rpe: number): SportScore {
  const timeShare = targetMinutes > 0 ? clamp01(minutes / targetMinutes) : 0
  const effortShare = clamp01(rpe / 10)
  const ratio = timeShare * 0.7 + effortShare * 0.3
  return { ratio, stars: starsFor(ratio) }
}
