import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { JournalNote } from '@/data/journal/journalTypes'

type JournalListResponse = paths['/api/journal']['get']['responses']['200']['content']['application/json']
type JournalWire = JournalListResponse[number]
type JournalCreateBody = paths['/api/journal']['post']['requestBody']['content']['application/json']
type JournalUpdateBody = paths['/api/journal/{id}']['put']['requestBody']['content']['application/json']

export function toJournalNote(w: JournalWire): JournalNote {
  return {
    id: w.id,
    occurredOn: w.occurredOn,
    text: w.text,
    source: w.source,
    createdAt: w.createdAt,
  }
}

export const journalApi = {
  list: (from: string, to: string): Promise<JournalNote[]> =>
    apiFetch<JournalListResponse>(`/api/journal?from=${from}&to=${to}`).then((rows) => rows.map(toJournalNote)),
  create: (text: string, occurredOn?: string): Promise<JournalNote> =>
    apiFetch<JournalWire>(`/api/journal`, {
      method: 'POST',
      body: JSON.stringify({ text, occurredOn, source: 'quickinput' } satisfies JournalCreateBody),
    }).then(toJournalNote),
  update: (id: string, text: string, occurredOn?: string): Promise<JournalNote> =>
    apiFetch<JournalWire>(`/api/journal/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ text, occurredOn } satisfies JournalUpdateBody),
    }).then(toJournalNote),
  remove: (id: string): Promise<void> => apiFetch<void>(`/api/journal/${id}`, { method: 'DELETE' }),
}
