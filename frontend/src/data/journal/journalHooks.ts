import { useMutation, useQueryClient } from '@tanstack/react-query'
import { journalApi } from '@/data/journal/journalApi'
import { mockJournalNotes } from '@/data/journal/journalMock'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { localDateString } from '@/shared/lib/dates'
import type { JournalNote } from '@/data/journal/journalTypes'

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

  // Mock-mode mutations touch every cached `['journal', from, to]` entry at once — reconstructing
  // the exact keys currently mounted is fiddly, `setQueriesData` with the `['journal']` prefix
  // updates all of them in one pass (TanStack's default partial-key matching).
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
        qc.setQueriesData<JournalNote[]>({ queryKey: ['journal'] }, (d) => [note, ...(d ?? [])])
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
        qc.setQueriesData<JournalNote[]>({ queryKey: ['journal'] }, (d) =>
          (d ?? []).map((n) => {
            if (n.id !== input.id) return n
            updated = { ...n, text: input.text, occurredOn: input.occurredOn ?? n.occurredOn }
            return updated
          }),
        )
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
