// ============================================================
// Mezo · sessionFocus (mezo-n4wf5.4, Folyadék F4) — the view model of the approved in-workout layout:
// ONE exercise is the hero, the others are rows. Pure reads of the Session; nothing here changes the
// session model, a mutation or the API.
//
// The live model stays as it is: every exercise has its OWN cursor (`nextSetIdx`) and any exercise
// can be logged. What is new is only which exercise is on top:
//   · „Most" = the first exercise in order that still has an open set (`nowExerciseId`);
//   · the hero shows the FOCUSED exercise (view state held by the page) or, without one, „Most";
//   · the focus moves with `nextFocus`: a row tap focuses, logging pins the focus to that exercise
//     (so its debrief stays on screen), closing that debrief clears it (the hero moves on).
// ============================================================
import { effectiveSetCount, pendingSetCount, type Session } from '@/features/train/logic/workoutState'

const done = (s: Session, id: string) => s.logged[id]?.length ?? 0
const isSkipped = (s: Session, id: string) => s.skipped.includes(id)

/** „Most": the first non-skipped exercise in order with an open set; null when none is left. */
export function nowExerciseId(s: Session): string | null {
  for (const id of s.order) {
    if (!isSkipped(s, id) && done(s, id) < effectiveSetCount(s, id)) return id
  }
  return null
}

/** The exercise the hero shows: the focused one while it is still in the session, else „Most",
 *  else (everything resolved) the last exercise. Assumes a non-empty session, like the page's guard. */
export function heroExerciseId(s: Session, focusedId: string | null): string {
  if (focusedId != null && s.order.includes(focusedId)) return focusedId
  return nowExerciseId(s) ?? s.order[s.order.length - 1]
}

export type FocusEvent =
  /** a row (or a top vessel) was tapped */
  | { type: 'tap'; id: string }
  /** a set was logged on this exercise */
  | { type: 'logged'; id: string }
  /** this exercise's debrief sheet closed (saved or dismissed) */
  | { type: 'debriefClosed'; id: string }
  | { type: 'skipped'; id: string }
  | { type: 'unskipped'; id: string }
  /** an exercise was swapped in or added — `id` is the NEW exercise */
  | { type: 'changed'; id: string }

/** The next focused id after an event. `null` = follow „Most". */
export function nextFocus(focusedId: string | null, ev: FocusEvent): string | null {
  switch (ev.type) {
    case 'tap':
    case 'logged':
    case 'unskipped':
    case 'changed':
      return ev.id
    case 'debriefClosed':
    case 'skipped':
      return focusedId === ev.id ? null : focusedId
  }
}

export type RowTag = 'now' | 'done' | 'skipped' | null

/** The state pill of an exercise's row. A swapped-out exercise (it kept its logged sets, the rest
 *  went to its replacement) says so in its own line and carries no pill. */
export function rowTag(s: Session, id: string, opts: { swappedOut?: boolean } = {}): RowTag {
  if (isSkipped(s, id)) return 'skipped'
  if (opts.swappedOut) return null
  if (nowExerciseId(s) === id) return 'now'
  return done(s, id) >= effectiveSetCount(s, id) ? 'done' : null
}

export type FinishState = 'skip' | 'partial' | 'full'

/** The finish button's three faces (unchanged rule): nothing logged at all → skip the workout;
 *  open sets left on a non-skipped exercise → partial; none left → full. */
export function finishState(s: Session): FinishState {
  const logged = Object.values(s.logged).reduce((a, sets) => a + sets.length, 0)
  if (logged === 0) return 'skip'
  return pendingSetCount(s) === 0 ? 'full' : 'partial'
}

/** The dock's „n / m szett": both counted over the non-skipped exercises, so the copy agrees with
 *  the finish button. */
export function dockNumbers(s: Session): { done: number; planned: number } {
  let d = 0
  let p = 0
  for (const id of s.order) {
    if (isSkipped(s, id)) continue
    d += done(s, id)
    p += effectiveSetCount(s, id)
  }
  return { done: d, planned: p }
}

/** The small vessels on top, one per exercise in order. `off` = skipped today. */
export function progressVessels(s: Session): Array<{ id: string; done: number; planned: number; off: boolean }> {
  return s.order.map((id) => ({ id, done: done(s, id), planned: effectiveSetCount(s, id), off: isSkipped(s, id) }))
}
