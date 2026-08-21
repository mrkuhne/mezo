import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { gratitudeApi } from '@/data/journal/gratitudeApi'
import { mockGratitudeEntries } from '@/data/journal/gratitudeMock'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { localDateString } from '@/shared/lib/dates'
import type { GratitudeEntry } from '@/data/journal/journalTypes'

/** Every currently-mounted `['gratitude', from, to]` cache entry, with its own range extracted —
 * `setQueriesData`'s updater does NOT hand back the matched query's key (queryClient.ts:209-228,
 * @tanstack/query-core 5.101.0: it maps `findAll(filters)` through `setQueryData(queryKey, updater)`
 * with no key passed to `updater`), so per-entry range logic has to walk the query cache directly
 * and call `setQueryData` per key instead of the blanket `setQueriesData`. */
function gratitudeRangeQueries(qc: QueryClient): Array<{ queryKey: QueryKey; from: string; to: string }> {
  return qc
    .getQueryCache()
    .findAll({ queryKey: ['gratitude'] })
    .flatMap((q) => {
      const [, from, to] = q.queryKey
      return typeof from === 'string' && typeof to === 'string' ? [{ queryKey: q.queryKey, from, to }] : []
    })
}

/** Insert `entry` keeping the list sorted newest-first by `occurredOn` (ties: the new entry lands
 * before same-day entries, matching "just added" intuition). */
function insertByOccurredOnDesc(list: GratitudeEntry[], entry: GratitudeEntry): GratitudeEntry[] {
  const idx = list.findIndex((e) => e.occurredOn <= entry.occurredOn)
  if (idx === -1) return [...list, entry]
  return [...list.slice(0, idx), entry, ...list.slice(idx)]
}

export function useGratitudeEntries(
  from: string,
  to: string,
): { data: GratitudeEntry[]; isPending: boolean; isError: boolean; refetch: () => void } {
  return useDualQuery<GratitudeEntry[]>({
    queryKey: ['gratitude', from, to],
    mockData: mockGratitudeEntries.filter((e) => e.occurredOn >= from && e.occurredOn <= to),
    realFetch: () => gratitudeApi.list(from, to),
    realEmpty: [],
  })
}

export function useGratitudeActions(): {
  addEntry: (text: string, lifeArea?: string | null, occurredOn?: string) => Promise<GratitudeEntry>
  removeEntry: (id: string) => Promise<void>
  pending: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()

  const addM = useMutation({
    mutationFn: async (input: { text: string; lifeArea?: string | null; occurredOn?: string }): Promise<GratitudeEntry> => {
      if (mock) {
        const entry: GratitudeEntry = {
          id: `ge-m-${Date.now()}`,
          occurredOn: input.occurredOn ?? localDateString(),
          text: input.text,
          lifeArea: input.lifeArea ?? null,
          createdAt: new Date().toISOString(),
        }
        for (const { queryKey, from, to } of gratitudeRangeQueries(qc)) {
          if (entry.occurredOn < from || entry.occurredOn > to) continue
          qc.setQueryData<GratitudeEntry[]>(queryKey, (d) => insertByOccurredOnDesc(d ?? [], entry))
        }
        return entry
      }
      return gratitudeApi.create(input.text, input.lifeArea, input.occurredOn)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: ['gratitude'] }),
  })

  const removeM = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (mock) {
        qc.setQueriesData<GratitudeEntry[]>({ queryKey: ['gratitude'] }, (d) => (d ?? []).filter((e) => e.id !== id))
        return
      }
      await gratitudeApi.remove(id)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: ['gratitude'] }),
  })

  return {
    addEntry: (text: string, lifeArea?: string | null, occurredOn?: string) => addM.mutateAsync({ text, lifeArea, occurredOn }),
    removeEntry: (id: string) => removeM.mutateAsync(id),
    pending: addM.isPending || removeM.isPending,
  }
}
