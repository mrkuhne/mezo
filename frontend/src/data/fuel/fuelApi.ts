import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { Protocol } from '@/data/types'

type ProtocolViewResponse = components['schemas']['ProtocolViewResponse']
type ProtocolActivateRequest = components['schemas']['ProtocolActivateRequest']
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
  selectedIds: string[] | null
}

const formatBuiltAt = (iso: string) =>
  new Date(iso).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Contract protocol-view → FE Protocol shape (itemCount = selection length, source is fixed). */
export function fromProtocolView(r: ProtocolViewResponse): ProtocolView {
  const a = r.active
  if (!a) return { protocol: null, selectedIds: null }
  return {
    protocol: {
      version: a.version,
      builtAt: formatBuiltAt(a.builtAt),
      source: 'Stack builder',
      status: a.status,
      itemCount: a.selectedPantryItemIds.length,
      confidence: a.confidence ?? 0,
      lastReplanReason: a.lastReplanReason ?? null,
      history: (r.history ?? []).map(h => ({ v: h.version, when: formatBuiltAt(h.builtAt), reason: h.reason ?? '' })),
    },
    selectedIds: a.selectedPantryItemIds,
  }
}

function fromIntake(r: IntakeResponse): Intake {
  return { id: r.id, pantryItemId: r.pantryItemId, takenAt: r.takenAt, dose: r.dose ?? null, slotKey: r.slotKey ?? null }
}

export const fuelApi = {
  getProtocol: (): Promise<ProtocolView> =>
    apiFetch<ProtocolViewResponse>('/api/fuel/protocol').then(fromProtocolView),
  activateProtocol: (selectedIds: string[], reason?: string): Promise<ProtocolView> =>
    apiFetch<ProtocolViewResponse>('/api/fuel/protocol', {
      method: 'POST',
      body: JSON.stringify({ selectedPantryItemIds: selectedIds, reason } satisfies ProtocolActivateRequest),
    }).then(fromProtocolView),
  listIntakes: (date: string): Promise<Intake[]> =>
    apiFetch<IntakeListResponse>(`/api/fuel/intake/${date}`).then(r => r.intakes.map(fromIntake)),
  logIntake: (input: { pantryItemId: string; dose?: string; slotKey?: string }): Promise<Intake> =>
    apiFetch<IntakeResponse>('/api/fuel/intake', {
      method: 'POST',
      body: JSON.stringify(input satisfies IntakeRequest),
    }).then(fromIntake),
  deleteIntake: (id: string): Promise<void> =>
    apiFetch(`/api/fuel/intake/entry/${id}`, { method: 'DELETE' }).then(() => undefined),
}
