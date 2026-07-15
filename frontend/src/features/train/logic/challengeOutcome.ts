// ============================================================
// Mezo · challengeOutcome — FE preview of the backend
// ChallengeOutcomeEvaluator (same rules over session-local sets).
// Authoritative outcomes come from the server AFTER finish; this
// only pre-renders the summary screen before the finish POST.
// ============================================================
import type { Challenge } from '@/data/types'
import type { LoggedSet } from '@/features/train/logic/workoutState'

export type ChallengePreviewOutcome = 'hit' | 'miss' | 'inconclusive'

export function evaluateChallenge(c: Challenge, logged: LoggedSet[]): ChallengePreviewOutcome {
  if (logged.length === 0) return 'inconclusive'
  switch (c.type) {
    case 'PR':
      return logged.some(
        (s) => c.targetWeightKg != null && c.targetReps != null && s.weight >= c.targetWeightKg && s.reps >= c.targetReps,
      ) ? 'hit' : 'miss'
    case 'Depth': {
      const last = logged[logged.length - 1]
      return c.targetRir != null && last.rir <= c.targetRir ? 'hit' : 'miss'
    }
    case 'Volume':
      return c.targetSets != null && logged.length >= c.targetSets ? 'hit' : 'miss'
    default:
      return 'inconclusive'
  }
}
