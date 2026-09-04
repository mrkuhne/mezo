import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { FeedMessage } from '@/data/types'

type FeedWire =
  paths['/api/proactive/feed']['get']['responses']['200']['content']['application/json']

/** Wire → FE FeedMessage[]: paragraphs wrap into BriefingPara, refs pass through. The row `id`
 *  rides along untouched — it is the `feed_message` feedback artifactId (mezo-b3pp.15). */
export function toFeedMessages(wire: FeedWire): FeedMessage[] {
  return wire.map((m) => ({
    id: m.id,
    kind: m.kind,
    eyebrow: m.eyebrow,
    body: m.body.map((text) => ({ type: 'p' as const, text })),
    refs: m.refs.map((r) => ({ kind: r.kind, label: r.label })),
    facts: m.facts,
    suggestions: m.suggestions,
    actions: m.actions,
    applied: m.applied,
    generatedAt: m.generatedAt,
  }))
}

export const feedApi = {
  /** The feed for the FE's LOCAL day (the check-in date precedent). */
  get: (date: string) =>
    apiFetch<FeedWire>(`/api/proactive/feed?date=${date}`).then(toFeedMessages),
}
