import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { notificationApi } from '@/data/notification/notificationApi'
import { notificationPrefSeed } from '@/data/notification/notificationMock'
import type { components } from '@/data/_client/api.gen'
import type { NotificationCategoryKey, NotificationPrefView } from '@/data/types'

const PREFS_KEY = ['notificationPrefs'] as const

function toView(pref: components['schemas']['NotificationPref']): NotificationPrefView {
  // The wire `category` is a plain string; the backend guarantees it is always one of the 14
  // known keys ("All 14 categories, always complete" — GET /api/notification/pref), so this
  // narrowing cast is safe without a runtime check.
  return { category: pref.category as NotificationCategoryKey, enabled: pref.enabled, leadMinutes: pref.leadMinutes }
}

/**
 * Dual-mode per-category notification prefs (N2 settings list, bd mezo-h4wp.6.2). Unlike N1's
 * device-owned `usePushSubscription`, this IS a server-owned read: mock seeds the deterministic
 * `notificationPrefSeed` (all 14, spec defaults) synchronously and never touches the network;
 * real fetches `GET /api/notification/pref` and, while unresolved, returns the same seed as the
 * honest pre-resolve ghost — the backend's own "no stored row = code default" rule means the
 * seed IS the correct fallback, not a fabricated placeholder.
 */
export function useNotificationPrefs(): {
  prefs: NotificationPrefView[]
  isPending: boolean
  setPref: (
    category: NotificationCategoryKey,
    patch: Partial<Pick<NotificationPrefView, 'enabled' | 'leadMinutes'>>,
  ) => Promise<void>
} {
  const qc = useQueryClient()
  const mock = isMockMode()
  const { data, isPending } = useDualQuery<NotificationPrefView[]>({
    queryKey: PREFS_KEY,
    mockData: notificationPrefSeed,
    realFetch: async () => (await notificationApi.prefs()).prefs.map(toView),
    realEmpty: notificationPrefSeed,
  })

  // Per-category upsert (mirrors the backend's own per-category PUT semantics — never a full
  // list replace, so a concurrent edit to a different category can never be clobbered by this
  // write). Optimistic update + invalidate on both branches; mock's mutationFn does nothing
  // (never reaches the network) because onMutate already wrote the cache.
  const mutation = useMutation({
    mutationFn: async (pref: NotificationPrefView) => {
      if (mock) return
      await notificationApi.putPrefs([pref])
    },
    onMutate: async (pref) => {
      await qc.cancelQueries({ queryKey: PREFS_KEY })
      const previous = qc.getQueryData<NotificationPrefView[]>(PREFS_KEY)
      qc.setQueryData<NotificationPrefView[]>(PREFS_KEY, (rows) =>
        (rows ?? data).map((p) => (p.category === pref.category ? pref : p)))
      return { previous }
    },
    onError: (_err, _pref, context) => {
      if (context?.previous) qc.setQueryData(PREFS_KEY, context.previous)
    },
    onSettled: () => {
      if (!mock) qc.invalidateQueries({ queryKey: PREFS_KEY })
    },
  })

  const setPref = useCallback(
    (
      category: NotificationCategoryKey,
      patch: Partial<Pick<NotificationPrefView, 'enabled' | 'leadMinutes'>>,
    ): Promise<void> => {
      const current = qc.getQueryData<NotificationPrefView[]>(PREFS_KEY) ?? data
      const base = current.find((p) => p.category === category)
        ?? notificationPrefSeed.find((p) => p.category === category)!
      const next: NotificationPrefView = { ...base, ...patch }
      return mutation.mutateAsync(next).then(() => undefined)
    },
    [qc, data, mutation],
  )

  return { prefs: data, isPending, setPref }
}
