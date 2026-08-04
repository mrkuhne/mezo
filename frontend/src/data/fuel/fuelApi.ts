import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { Protocol, ProtocolOccurrence, StackZoneKey, StackPlacementSource } from '@/data/types'
import { nowOffsetIso } from '@/shared/lib/dates'

type ProtocolViewResponse = components['schemas']['ProtocolViewResponse']
type ProtocolItemResponse = components['schemas']['ProtocolItemResponse']
type ProtocolItemCreateRequest = components['schemas']['ProtocolItemCreateRequest']
type ProtocolItemPatchRequest = components['schemas']['ProtocolItemPatchRequest']
type IntakeResponse = components['schemas']['IntakeResponse']
type IntakeListResponse = components['schemas']['IntakeListResponse']
type IntakeRequest = components['schemas']['IntakeRequest']

export interface Intake {
  id: string
  pantryItemId: string
  takenAt: string
  dose: string | null
  slotKey: string | null
}

export interface ProtocolView {
  protocol: Protocol | null
  occurrences: ProtocolOccurrence[]
}

const formatBuiltAt = (iso: string) =>
  new Date(iso).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function fromItem(r: ProtocolItemResponse): ProtocolOccurrence {
  return {
    id: r.id, pantryItemId: r.pantryItemId, slotKey: r.slotKey as StackZoneKey,
    dose: r.dose ?? null, pinned: r.pinned,
    placementSource: r.placementSource as StackPlacementSource,
    placementReason: r.placementReason ?? null,
    restDayFallback: (r.restDayFallback ?? null) as ProtocolOccurrence['restDayFallback'],
    dailyTotalHint: r.dailyTotalHint ?? null,
  }
}

/** Contract protocol-view → FE Protocol shape (itemCount = the occurrence count, source is fixed). */
export function fromProtocolView(r: ProtocolViewResponse): ProtocolView {
  const a = r.active
  if (!a) return { protocol: null, occurrences: [] }
  const occurrences = (a.items ?? []).map(fromItem)
  return {
    protocol: {
      version: a.version,
      builtAt: formatBuiltAt(a.builtAt),
      source: 'Stack builder',
      status: a.status,
      itemCount: occurrences.length,
      confidence: a.confidence ?? 0,
      lastReplanReason: a.lastReplanReason ?? null,
      history: (r.history ?? []).map(h => ({ v: h.version, when: formatBuiltAt(h.builtAt), reason: h.reason ?? '' })),
    },
    occurrences,
  }
}

function fromIntake(r: IntakeResponse): Intake {
  return { id: r.id, pantryItemId: r.pantryItemId, takenAt: r.takenAt, dose: r.dose ?? null, slotKey: r.slotKey ?? null }
}

export const fuelApi = {
  getProtocol: (): Promise<ProtocolView> =>
    apiFetch<ProtocolViewResponse>('/api/fuel/protocol').then(fromProtocolView),
  listIntakes: (date: string): Promise<Intake[]> =>
    apiFetch<IntakeListResponse>(`/api/fuel/intake/${date}`).then(r => r.intakes.map(fromIntake)),
  // Always stamp an offset-bearing `takenAt` for "now" (browser wall-clock + local UTC offset) so
  // the server's day key (`takenDate = takenAt.toLocalDate()`) lands on the browser's calendar day —
  // a missing takenAt would default to the container's UTC now and misfile a 00:00–02:00 local tap
  // under yesterday (mirrors the medication dose-logging path in LogDoseSheet, shared via offsetIso).
  logIntake: (input: { pantryItemId: string; dose?: string; slotKey?: string }): Promise<Intake> =>
    apiFetch<IntakeResponse>('/api/fuel/intake', {
      method: 'POST',
      body: JSON.stringify({ ...input, takenAt: nowOffsetIso() } satisfies IntakeRequest),
    }).then(fromIntake),
  deleteIntake: (id: string): Promise<void> =>
    apiFetch(`/api/fuel/intake/entry/${id}`, { method: 'DELETE' }).then(() => undefined),
  // --- occurrence ops (mezo-vx9v living protocol) ---
  addProtocolItem: (body: { pantryItemId: string; slotKey?: StackZoneKey; dose?: string }): Promise<ProtocolOccurrence> =>
    apiFetch<ProtocolItemResponse>('/api/fuel/protocol/items', {
      method: 'POST',
      body: JSON.stringify(body satisfies ProtocolItemCreateRequest),
    }).then(fromItem),
  patchProtocolItem: (
    id: string,
    body: { slotKey?: StackZoneKey; dose?: string; pinned?: boolean },
  ): Promise<ProtocolOccurrence> =>
    apiFetch<ProtocolItemResponse>(`/api/fuel/protocol/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body satisfies ProtocolItemPatchRequest),
    }).then(fromItem),
  deleteProtocolItem: (id: string): Promise<void> =>
    apiFetch(`/api/fuel/protocol/items/${id}`, { method: 'DELETE' }).then(() => undefined),
}
