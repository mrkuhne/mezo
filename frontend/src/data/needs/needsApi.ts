// ============================================================
// Mezo · needsApi — REST client for the day-close + summary read (mezo-dhzk, Task 9).
// Spec: .superpowers/sdd/2026-08-17-needs-rings/task-9-brief.md
// ============================================================
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

export type NeedsRingsWire = components['schemas']['NeedsRings']
type CloseReq = components['schemas']['NeedsCloseRequest']
export type NeedsCloseResult = components['schemas']['NeedsCloseResponse']
export type NeedsSummary = components['schemas']['NeedsSummaryResponse']

export const needsApi = {
  close: (date: string, rings: NeedsRingsWire): Promise<NeedsCloseResult> =>
    apiFetch<NeedsCloseResult>('/api/needs/day-close', {
      method: 'POST',
      body: JSON.stringify({ date, rings } satisfies CloseReq),
    }),
  summary: (): Promise<NeedsSummary> => apiFetch<NeedsSummary>('/api/needs/summary'),
}
