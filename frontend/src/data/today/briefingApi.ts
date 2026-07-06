import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { Briefing } from '@/data/types'

type BriefingWire =
  paths['/api/proactive/briefing']['get']['responses']['200']['content']['application/json']

/** Wire → FE Briefing: paragraphs wrap into BriefingPara, refs pass through, NO confidence. */
export function toBriefing(wire: BriefingWire): Briefing {
  return {
    eyebrow: wire.eyebrow,
    body: wire.body.map((text) => ({ type: 'p' as const, text })),
    refs: wire.refs.map((r) => ({ kind: r.kind, label: r.label })),
  }
}

export const briefingApi = {
  /** The generated briefing for the FE's LOCAL day (the check-in date precedent). */
  get: (date: string) =>
    apiFetch<BriefingWire>(`/api/proactive/briefing?date=${date}`).then(toBriefing),
}
