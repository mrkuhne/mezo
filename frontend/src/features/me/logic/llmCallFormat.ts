import type { LlmCallDetailResponse } from '@/data/me/llmUsageApi'

// Pure formatters for the AI-napló surfaces (mezo-uakh). Kept out of the components so the two
// rules that matter — an unknown value renders as an em dash, and the token bar shows the NET
// prompt — are asserted once, here, instead of per component.
//
// Two money formatters, deliberately not one: `formatCost` is for a SINGLE call's cost (the
// call-detail and call-list surfaces), which routinely lands in the sub-cent range — at 2 decimals
// those would all read as the same false "$0.00". `formatRollupCost` is for a PERIOD/FEATURE/MODEL
// AGGREGATE (the header cards) — a rollup being under a dime is ordinary in production (a
// rarely-used feature), not a mock-data artifact, so an aggregate column must hold a stable 2
// decimals throughout rather than switching precision row-to-row. Never mix the two within one
// column.

/**
 * A single call's cost — "—" for unknown (ADR 0014: unpriced is not free). Below a dime: 4
 * decimals, because per-call costs live in the sub-cent range and would render as $0.00 with 2.
 * At or above: 2 decimals. Used by the call-list and call-detail surfaces (Tasks 7/9), NOT by the
 * header aggregates — see `formatRollupCost`.
 */
export function formatCost(costUsd: number | null | undefined): string {
  if (costUsd == null) return '—'
  return costUsd < 0.1 ? `$${costUsd.toFixed(4)}` : `$${costUsd.toFixed(2)}`
}

/**
 * A period/feature/model aggregate's cost — "—" for unknown, otherwise always 2 decimals (money),
 * so a column of rollups never mixes precision. The one guard: a genuinely nonzero rollup under
 * half a cent must not round to "$0.00" — that reads as free, exactly what ADR 0014 exists to
 * prevent for the per-call case too — so it renders "<$0.01" instead. An exact 0 still renders
 * "$0.00" (there is nothing to hide).
 */
export function formatRollupCost(costUsd: number | null | undefined): string {
  if (costUsd == null) return '—'
  if (costUsd !== 0 && costUsd < 0.005) return '<$0.01'
  return `$${costUsd.toFixed(2)}`
}

export function formatTokens(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('hu-HU').replace(/\s/g, ' ')
}

export function formatLatency(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

export function formatTime(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('hu-HU', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest',
  })
}

const KIND_LABELS: Record<string, string> = {
  CHAT: 'CHAT',
  CHAT_STREAM: 'STREAM',
  VISION: 'KÉP',
  SMART: 'SMART',
  TOOL: 'TOOL',
  TRANSCRIBE: 'HANG',
  EMBED_DOC: 'EMBED',
  EMBED_QUERY: 'EMBED?',
}

export function callKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind
}

export function statusTone(status: string): 'ok' | 'error' | 'cancelled' {
  if (status === 'ERROR') return 'error'
  if (status === 'CANCELLED') return 'cancelled'
  return 'ok'
}

export interface TokenSegment {
  key: string
  label: string
  value: number
  percent: number
}

/**
 * The four billable token slices of one call, as bar segments.
 *
 * `promptTokens` is stored RAW and INCLUDES `cachedTokens` (Gemini reports cached as a subset), so
 * the prompt segment shows the NET value — otherwise the cached tokens would be drawn twice and
 * the bar would not match what the call was billed.
 */
export function tokenSegments(d: LlmCallDetailResponse): TokenSegment[] {
  const cached = d.cachedTokens ?? 0
  const raw = [
    { key: 'prompt', label: 'prompt', value: Math.max((d.promptTokens ?? 0) - cached, 0) },
    { key: 'candidates', label: 'válasz', value: d.candidatesTokens ?? 0 },
    { key: 'thoughts', label: 'gondolkodás', value: d.thoughtsTokens ?? 0 },
    { key: 'cached', label: 'cache-elt', value: cached },
  ]
  const total = raw.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return []
  return raw.map((s) => ({ ...s, percent: (s.value / total) * 100 }))
}
