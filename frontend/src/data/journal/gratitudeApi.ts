import type { paths } from '@/data/_client/api.gen'
import { apiFetch } from '@/data/_client/api'
import type { GratitudeEntry } from '@/data/journal/journalTypes'

type Wire = paths['/api/journal/gratitude']['get']['responses']['200']['content']['application/json'][number]
type CreateBody = paths['/api/journal/gratitude']['post']['requestBody']['content']['application/json']

const toEntry = (w: Wire): GratitudeEntry => ({
  id: w.id, occurredOn: w.occurredOn, text: w.text,
  lifeArea: w.lifeArea ?? null, createdAt: w.createdAt,
})

export const gratitudeApi = {
  async list(from: string, to: string): Promise<GratitudeEntry[]> {
    const rows = await apiFetch<Wire[]>(`/api/journal/gratitude?from=${from}&to=${to}`)
    return rows.map(toEntry)
  },
  async create(text: string, lifeArea?: string | null, occurredOn?: string): Promise<GratitudeEntry> {
    const body = { text, lifeArea: lifeArea ?? undefined, occurredOn } satisfies CreateBody
    return toEntry(await apiFetch<Wire>('/api/journal/gratitude', { method: 'POST', body: JSON.stringify(body) }))
  },
  async remove(id: string): Promise<void> {
    await apiFetch<void>(`/api/journal/gratitude/${id}`, { method: 'DELETE' })
  },
}
