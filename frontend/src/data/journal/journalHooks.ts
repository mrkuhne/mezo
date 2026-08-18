import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { journalApi } from '@/data/journal/journalApi'
import { mockJournalNotes } from '@/data/journal/journalMock'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { localDateString } from '@/shared/lib/dates'
import type { JournalNote } from '@/data/journal/journalTypes'

/** Every currently-mounted `['journal', from, to]` cache entry, with its own range extracted —
 * `setQueriesData`'s updater does NOT hand back the matched query's key (queryClient.ts:209-228,
 * @tanstack/query-core 5.101.0: it maps `findAll(filters)` through `setQueryData(queryKey, updater)`
 * with no key passed to `updater`), so per-entry range logic has to walk the query cache directly
 * and call `setQueryData` per key instead of the blanket `setQueriesData`. */
function journalRangeQueries(qc: QueryClient): Array<{ queryKey: QueryKey; from: string; to: string }> {
  return qc
    .getQueryCache()
    .findAll({ queryKey: ['journal'] })
    .flatMap((q) => {
      const [, from, to] = q.queryKey
      return typeof from === 'string' && typeof to === 'string' ? [{ queryKey: q.queryKey, from, to }] : []
    })
}

/** Insert `note` keeping the list sorted newest-first by `occurredOn` (ties: the new note lands
 * before same-day entries, matching "just added" intuition). */
function insertByOccurredOnDesc(list: JournalNote[], note: JournalNote): JournalNote[] {
  const idx = list.findIndex((n) => n.occurredOn <= note.occurredOn)
  if (idx === -1) return [...list, note]
  return [...list.slice(0, idx), note, ...list.slice(idx)]
}

export function useJournalNotes(
  from: string,
  to: string,
): { data: JournalNote[]; isPending: boolean; isError: boolean; refetch: () => void } {
  return useDualQuery<JournalNote[]>({
    queryKey: ['journal', from, to],
    mockData: mockJournalNotes.filter((n) => n.occurredOn >= from && n.occurredOn <= to),
    realFetch: () => journalApi.list(from, to),
    realEmpty: [],
  })
}

export function useJournalActions(): {
  addNote: (text: string, occurredOn?: string) => Promise<JournalNote>
  updateNote: (id: string, text: string, occurredOn?: string) => Promise<JournalNote>
  removeNote: (id: string) => Promise<void>
  pending: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()

  // Mock-mode mutations must touch every cached `['journal', from, to]` entry, but ONLY where the
  // note's `occurredOn` actually falls in that entry's own range — Task 7's "Korábbi hónapok"
  // widens `from`, so several ranges are cached (and alive forever under mock's staleTime:
  // Infinity) at once; a blanket `setQueriesData` would leak a note into ranges it doesn't belong
  // to. `journalRangeQueries` + per-key `setQueryData` gives each entry its own from/to to check.
  const addM = useMutation({
    mutationFn: async (input: { text: string; occurredOn?: string }): Promise<JournalNote> => {
      if (mock) {
        const note: JournalNote = {
          id: `jn-m-${Date.now()}`,
          occurredOn: input.occurredOn ?? localDateString(),
          text: input.text,
          source: 'quickinput',
          createdAt: new Date().toISOString(),
        }
        for (const { queryKey, from, to } of journalRangeQueries(qc)) {
          if (note.occurredOn < from || note.occurredOn > to) continue
          qc.setQueryData<JournalNote[]>(queryKey, (d) => insertByOccurredOnDesc(d ?? [], note))
        }
        return note
      }
      return journalApi.create(input.text, input.occurredOn)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: ['journal'] }),
  })

  const updateM = useMutation({
    mutationFn: async (input: { id: string; text: string; occurredOn?: string }): Promise<JournalNote> => {
      if (mock) {
        let updated: JournalNote | undefined
        for (const { queryKey, from, to } of journalRangeQueries(qc)) {
          qc.setQueryData<JournalNote[]>(queryKey, (d) => {
            const list = d ?? []
            const idx = list.findIndex((n) => n.id === input.id)
            if (idx === -1) return list
            const next: JournalNote = {
              ...list[idx],
              text: input.text,
              occurredOn: input.occurredOn ?? list[idx].occurredOn,
            }
            updated = next
            const withoutOld = [...list.slice(0, idx), ...list.slice(idx + 1)]
            // The edit may have moved the note out of THIS entry's range — drop it there; a
            // still-in-range edit is reinserted so the newest-first order stays correct.
            if (next.occurredOn < from || next.occurredOn > to) return withoutOld
            return insertByOccurredOnDesc(withoutOld, next)
          })
        }
        return updated!
      }
      return journalApi.update(input.id, input.text, input.occurredOn)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: ['journal'] }),
  })

  const removeM = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (mock) {
        qc.setQueriesData<JournalNote[]>({ queryKey: ['journal'] }, (d) => (d ?? []).filter((n) => n.id !== id))
        return
      }
      await journalApi.remove(id)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: ['journal'] }),
  })

  return {
    addNote: (text: string, occurredOn?: string) => addM.mutateAsync({ text, occurredOn }),
    updateNote: (id: string, text: string, occurredOn?: string) => updateM.mutateAsync({ id, text, occurredOn }),
    removeNote: (id: string) => removeM.mutateAsync(id),
    pending: addM.isPending || updateM.isPending || removeM.isPending,
  }
}
