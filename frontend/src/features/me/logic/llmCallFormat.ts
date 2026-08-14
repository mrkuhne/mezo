import type { LlmCallDetailResponse } from '@/data/me/llmUsageApi'

// Pure formatters for the AI-napló surfaces (mezo-uakh). Kept out of the components so the two
// rules that matter — an unknown value renders as an em dash, and the token bar shows the NET
// prompt — are asserted once, here, instead of per component.

/** An unknown (null) money value is "—": unpriced is not free (ADR 0014). */
export function formatCost(costUsd: number | null | undefined): string {
  if (costUsd == null) return '—'
  // Below a dime (per-call detail costs): 4 decimals, because per-call costs live in the sub-cent
  // range and would render as $0.00 with 2. At or above (aggregates like period totals, feature
  // rollups): 2 decimals, because that's how we display money. This preserves the detail while
  // avoiding false zeros (the whole point of ADR 0014).
  return costUsd < 0.1 ? `$${costUsd.toFixed(4)}` : `$${costUsd.toFixed(2)}`
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
