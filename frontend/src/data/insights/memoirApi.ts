import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { Memoir } from '@/data/types'
import { isoWeekNumber } from '@/data/insights/weeklyHooks'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'

type MemoirWire = paths['/api/proactive/memoir']['get']['responses']['200']['content']['application/json']

/** Wire → FE Memoir: the week label derives client-side from weekStart. */
export function toMemoir(wire: MemoirWire): Memoir {
  return {
    week: `Hét ${isoWeekNumber(wire.weekStart)} · ${deriveWeekTitle(wire.weekStart)}`,
    title: wire.title,
    body: wire.body,
    anchors: wire.anchors.map((a) => ({ kind: a.kind, label: a.label })),
  }
}

export const memoirApi = {
  latest: () => apiFetch<MemoirWire>('/api/proactive/memoir').then(toMemoir),
}
