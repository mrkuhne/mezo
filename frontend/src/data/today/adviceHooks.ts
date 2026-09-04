import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { adviceApi } from '@/data/today/adviceApi'
import type { AdviceActionKey } from '@/data/types'

/** Shared with `useCompanionFeed`'s query key prefix (`feedHooks.ts`) — invalidating this
 *  prefix catches every date's cached feed, not just today's. */
const COMPANION_FEED_KEY = ['companionFeed']

/**
 * Applies one advice-card action (S5, mezo-d58h.5). Persisted in real mode: on success the
 * companion feed is invalidated so the applied card's own re-fetch carries the server's
 * `applied` stamp — the applied state is driven by that server truth, never local-only state
 * a reload would lose. A no-op in mock mode (`useExperimentActions`'s shape, copied verbatim):
 * the mock companion feed is always `[]`, so there is no advice card to apply anything to.
 */
export function useAdviceActions() {
  const queryClient = useQueryClient()
  const mock = isMockMode()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: COMPANION_FEED_KEY })

  const mutation = useMutation({
    mutationFn: async ({ id, actionKey }: { id: string; actionKey: AdviceActionKey }) => {
      if (mock) return
      await adviceApi.apply(id, actionKey)
    },
    onSuccess: mock ? undefined : invalidate,
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
