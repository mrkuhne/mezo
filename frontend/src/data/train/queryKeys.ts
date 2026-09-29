// ============================================================
// Mezo · train query-key constants with no other module dependency — a shared leaf so
// `trainHooks.ts`, `readinessHooks.ts` and `skipHooks.ts` can each read the keys they need to
// invalidate WITHOUT importing each other (Kihagyás S1, mezo-q4xt2.1): `trainHooks.ts`'s own
// `useTrain()` calls `usePlannedSkips()` (`skipHooks.ts`), which in turn invalidates
// `WORKOUT_TODAY_QUERY_KEY` + `READINESS_TODAY_QUERY_KEY` on a write — importing those straight
// off `trainHooks.ts`/`readinessHooks.ts` would close a real `trainHooks → skipHooks → trainHooks`
// cycle. `trainHooks.ts` and `readinessHooks.ts` re-export their own key from here, so every
// existing `import { WORKOUT_TODAY_QUERY_KEY } from '@/data/train/trainHooks'` (etc.) keeps
// compiling unchanged.
// ============================================================

/** Query-key PREFIX for `workoutToday` (the Train/Today plan endpoint, `trainApi.workoutToday`)
 *  — exported so a successful `lighten_tomorrow` apply (`adviceHooks.ts`) can invalidate every
 *  cached day's plan (the plain today context and any pinned-day session,
 *  `['train','workoutToday', workoutDay]`) via react-query's default prefix matching, the same
 *  `['train','workoutToday']` prefix `trainHooks.ts`'s own mutations already invalidate on write. */
export const WORKOUT_TODAY_QUERY_KEY = ['train', 'workoutToday'] as const

/** Query-key for the Check-in 2.0 training-readiness read (`readinessHooks.ts`'s
 *  `useTodayReadiness`) — a GYM planned-skip write can change today's plan the same way a
 *  readiness choice does, so `skipHooks.ts` invalidates it too. */
export const READINESS_TODAY_QUERY_KEY = ['train', 'readiness', 'today'] as const
