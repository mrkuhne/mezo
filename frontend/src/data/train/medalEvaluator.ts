import type { Medal, MedalType } from '@/data/train/medalTypes'

/** One logged set of an exercise, held in the mock history for baseline comparison. */
type HistorySet = { weight: number; reps: number }

/**
 * The caller-supplied part of an evaluation request — data `trainHooks`' mock branch
 * cannot derive on its own from a bare `SetLogRequest`: which exercise (by display name,
 * mock mode has no catalog identity), its last-known set (the mock baseline seed, sourced
 * from the mock plan's `lastWeek` — see `resetMockMedalHistory` below), and the date it's
 * being logged for.
 */
export type MockMedalContext = {
  exerciseName: string
  lastWeek: HistorySet | null
  date: string
}

/** Everything one candidate set needs: the caller's MockMedalContext plus the set's own
 * logged/prescribed values (mirrors SetLogRequest's weight/reps/target fields). */
export type MedalEvaluationRequest = MockMedalContext & {
  weightKg: number
  reps: number
  targetWeightKg?: number | null
  targetReps?: number | null
  setIndex?: number | null
}

// Module-level running history per exercise name — the mock's stand-in for "every
// comparable set of this identity logged strictly before now" (spec §6). Mock mode has
// no persisted set history (trainHooks.ts's exerciseRecords query always returns []), so
// each exercise's history is lazily seeded from the mock plan's `lastWeek` on first use —
// "your previous best-known set" — rather than starting empty (which would make every
// mock medal a baseline that never fires).
const history = new Map<string, HistorySet[]>()

/** Reset between tests — the mock history is module state and leaks across test files/cases otherwise. */
export function resetMockMedalHistory(): void {
  history.clear()
}

function priors(name: string, lastWeek: HistorySet | null): HistorySet[] {
  if (!history.has(name)) history.set(name, lastWeek ? [{ ...lastWeek }] : [])
  return history.get(name)!
}

/** Epley e1RM: weight × (30 + reps) / 30 — mirrors the backend MedalEvaluator.epley. */
function epley(weightKg: number, reps: number): number {
  return (weightKg * (30 + reps)) / 30
}

/** HALF_UP to 1 decimal — mirrors the backend's BigDecimal.setScale(1, HALF_UP) on e1RM. */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function medal(
  type: MedalType,
  tier: 'RECORD' | 'TARGET',
  req: MedalEvaluationRequest,
  value: number,
  unit: 'KG' | 'REPS',
  previousValue: number | null,
): Medal {
  return {
    type,
    tier,
    exerciseName: req.exerciseName,
    date: req.date,
    setIndex: req.setIndex ?? null,
    value,
    unit,
    weightKg: req.weightKg,
    reps: req.reps,
    previousValue,
    // The mock history only tracks {weight, reps} per prior set (no date), so unlike the
    // backend it cannot report *when* the beaten value was set — always null here.
    previousDate: null,
  }
}

/**
 * Mock mirror of the backend's `MedalEvaluator.forSet` (spec 2026-07-30-medal-collection-design.md
 * §6), ported to TypeScript so mock-mode set logging really produces medals. Given one
 * candidate set, decides which medals it earns against the running per-exercise history,
 * then pushes the candidate onto that history so the next set for this exercise sees it
 * as a prior. Deliberate duplication of the backend's rule table (§13) — the two engines
 * are kept honest by mirroring test cases, not by sharing code.
 *
 * Invariants (identical to the backend): strict `>` (a tie earns nothing); a candidate
 * with no comparable prior earns no RECORD medal; `REPS_AT_WEIGHT` needs a prior set at
 * exactly this weight; `TARGET_HIT` is history-independent and its `previousValue`/
 * `previousDate` are always null.
 *
 * `SESSION_VOLUME` is NOT evaluated here — it's a finish-time, session-scoped concern
 * (this session's total volume vs. the best prior session), and the mock finish mutation
 * is a no-op with no session aggregation to compare against.
 */
export function evaluateMockSetMedals(req: MedalEvaluationRequest): Medal[] {
  const ps = priors(req.exerciseName, req.lastWeek)
  const medals: Medal[] = []

  const bestWeight = ps.length ? Math.max(...ps.map((p) => p.weight)) : null
  if (bestWeight != null && req.weightKg > bestWeight) {
    medals.push(medal('WEIGHT', 'RECORD', req, req.weightKg, 'KG', bestWeight))
  }

  const repsAtThisWeight = ps.filter((p) => p.weight === req.weightKg).map((p) => p.reps)
  const bestRepsAtWeight = repsAtThisWeight.length ? Math.max(...repsAtThisWeight) : null
  if (bestRepsAtWeight != null && req.reps > bestRepsAtWeight) {
    medals.push(medal('REPS_AT_WEIGHT', 'RECORD', req, req.reps, 'REPS', bestRepsAtWeight))
  }

  const e1rm = epley(req.weightKg, req.reps)
  const priorE1rms = ps.map((p) => epley(p.weight, p.reps))
  const bestE1rm = priorE1rms.length ? Math.max(...priorE1rms) : null
  if (bestE1rm != null && e1rm > bestE1rm) {
    medals.push(medal('E1RM', 'RECORD', req, round1(e1rm), 'KG', round1(bestE1rm)))
  }

  if (
    req.targetWeightKg != null && req.targetReps != null
    && req.weightKg >= req.targetWeightKg && req.reps >= req.targetReps
  ) {
    medals.push(medal('TARGET_HIT', 'TARGET', req, req.reps, 'REPS', null))
  }

  ps.push({ weight: req.weightKg, reps: req.reps })
  return medals
}
