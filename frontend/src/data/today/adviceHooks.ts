import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { adviceApi } from '@/data/today/adviceApi'
import { SPORT_SLOT_SKIPS_QUERY_KEY, WORKOUT_TODAY_QUERY_KEY } from '@/data/train/trainHooks'
import type { AdviceActionKey } from '@/data/types'

/** Shared with `useCompanionFeed`'s query key prefix (`feedHooks.ts`) — invalidating this
 *  prefix catches every date's cached feed, not just today's. */
const COMPANION_FEED_KEY = ['companionFeed']

/**
 * Action key -> the EXTRA query keys a successful apply invalidates, beyond the always-invalidated
 * companion feed below (mezo-d58h.5 review fix). The card's own re-fetch is not enough on its
 * own: `skip_sport_slot` changes what the week agenda renders (`weekAgenda.ts`'s `skips` filter),
 * and nothing else was refetching `sportSlotSkips` — the applied card looked done while the
 * skipped session kept showing on the week agenda until an unrelated navigation happened to
 * refetch it. Each entry is a PREFIX: react-query's default (non-`exact`) `invalidateQueries`
 * matches every more-specific cached key underneath it (every week's own `sportSlotSkips` key,
 * via `SPORT_SLOT_SKIPS_QUERY_KEY`), so this map does not need to know which week is cached.
 *
 * One row per action that has FE-cached data beyond the card itself. `lighten_tomorrow` (S5,
 * Task 16) similarly affects a query outside the companion feed — the Train/Today plan
 * (`WORKOUT_TODAY_QUERY_KEY`, `trainApi.workoutToday`) reads the `workout_day_adjustment` row
 * this action writes, and nothing else was refetching it: without this entry the applied card
 * would show done while the plan kept showing yesterday's (pre-lighten) set counts until some
 * unrelated navigation happened to refetch. `shift_sleep_anchor` — the only action actually
 * reachable in round 1 (`AdviceActionCatalog.forCard` offers no other key yet) — mutates the
 * `sleep_goal` row directly, mirroring `useSleepGoalActions`'s own invalidation set
 * (`sleepHooks.ts`): `sleepGoal` itself plus `habitDay` (wake/bed habits re-center) and `fuelDay`
 * (meal slots cascade off the anchor); `sleepGoal` alone also cascades into every other surface
 * that reads it (circadian theme, Nap hub, needs rings, day face, stack/timeline hooks, the
 * notification schedule writer) once those hooks' own queries key off it. An action with nothing
 * else to invalidate simply has no entry (the companion-feed invalidation alone already covers it).
 */
const ACTION_INVALIDATES: Partial<Record<AdviceActionKey, readonly QueryKey[]>> = {
  skip_sport_slot: [SPORT_SLOT_SKIPS_QUERY_KEY],
  lighten_tomorrow: [WORKOUT_TODAY_QUERY_KEY],
  shift_sleep_anchor: [['sleepGoal'], ['habitDay'], ['fuelDay']],
}

/**
 * Applies one advice-card action (S5, mezo-d58h.5). Persisted in real mode: on success the
 * companion feed is invalidated so the applied card's own re-fetch carries the server's
 * `applied` stamp — the applied state is driven by that server truth, never local-only state
 * a reload would lose. Any query the action's own effect touches beyond the card (see
 * `ACTION_INVALIDATES`) is invalidated in the SAME success handler, unconditionally alongside the
 * feed — a half-applied skip (card done, week agenda stale) is exactly the bug this closes. A
 * no-op in mock mode (`useExperimentActions`'s shape, copied verbatim): the mock companion feed
 * is always `[]`, so there is no advice card to apply anything to, and nothing to invalidate.
 */
export function useAdviceActions() {
  const queryClient = useQueryClient()
  const mock = isMockMode()

  const mutation = useMutation({
    mutationFn: async ({ id, actionKey }: { id: string; actionKey: AdviceActionKey }) => {
      if (mock) return
      await adviceApi.apply(id, actionKey)
    },
    onSuccess: mock
      ? undefined
      : (_data, { actionKey }) => {
          queryClient.invalidateQueries({ queryKey: COMPANION_FEED_KEY })
          for (const queryKey of ACTION_INVALIDATES[actionKey] ?? []) {
            queryClient.invalidateQueries({ queryKey: [...queryKey] })
          }
        },
  })

  return {
    apply: (id: string, actionKey: AdviceActionKey) => mutation.mutate({ id, actionKey }),
    pending: mutation.isPending,
    /** The card id of the most recent FAILED apply (undefined once a later attempt succeeds or
     *  none has failed) — lets a card check "was it MY apply that failed" rather than every
     *  card on the thread lighting up from one unrelated failure. */
    failedId: mutation.isError ? mutation.variables?.id : undefined,
  }
}
