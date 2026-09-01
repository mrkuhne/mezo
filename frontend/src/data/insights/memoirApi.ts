import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { Memoir, MemoirEntry } from '@/data/types'
import { isoWeekNumber } from '@/data/insights/weeklyHooks'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'

type MemoirWire = paths['/api/proactive/memoir']['get']['responses']['200']['content']['application/json']
type MemoirArchiveWire = paths['/api/proactive/memoir/archive']['get']['responses']['200']['content']['application/json']

/** Wire → FE Memoir: the week label derives client-side from weekStart. */
export function toMemoir(wire: MemoirWire): Memoir {
  return {
    // The memoir row id — the artifactId the 👍/👎 chips vote on (mezo-b3pp.15).
    id: wire.id,
    week: `Hét ${isoWeekNumber(wire.weekStart)} · ${deriveWeekTitle(wire.weekStart)}`,
    title: wire.title,
    body: wire.body,
    anchors: wire.anchors.map((a) => ({ kind: a.kind, label: a.label })),
  }
}

/** F7.5 (mezo-d20.8.5): one shelf entry — the latest read's mapping plus the routing key. */
export function toMemoirEntry(wire: MemoirWire): MemoirEntry {
  return { ...toMemoir(wire), weekStart: wire.weekStart }
}

export const memoirApi = {
  latest: () => apiFetch<MemoirWire>('/api/proactive/memoir').then(toMemoir),
  archive: () =>
    apiFetch<MemoirArchiveWire>('/api/proactive/memoir/archive')
      .then((r) => r.entries.map(toMemoirEntry)),
}
