import { apiFetch } from '@/lib/api'
import type { components } from '@/lib/api.gen'
import type {
  Medication,
  MedicationDay,
  MedicationDose,
  MedicationCycle,
  MedicationInput,
  MedicationDoseInput,
} from '@/data/types'

type MedicationRequest = components['schemas']['MedicationRequest']
type MedicationResponse = components['schemas']['MedicationResponse']
type MedicationDoseRequest = components['schemas']['MedicationDoseRequest']
type MedicationDoseResponse = components['schemas']['MedicationDoseResponse']
type MedicationCycleResponse = components['schemas']['MedicationCycleResponse']
type MedicationDayResponse = components['schemas']['MedicationDayResponse']

/** Editor input → contract request. The Medication DTOs are already FE-friendly, so this is a
 *  straight pass-through (the cycle config carried verbatim). */
export function toRequest(input: MedicationInput): MedicationRequest {
  return {
    name: input.name,
    activeIngredient: input.activeIngredient,
    route: input.route,
    cadence: input.cadence,
    defaultDose: input.defaultDose,
    doseUnit: input.doseUnit,
    cycle: input.cycle,
    active: input.active,
  } satisfies MedicationRequest
}

/** Log-dose input → contract request. */
export function toDoseRequest(input: MedicationDoseInput): MedicationDoseRequest {
  return {
    administeredAt: input.administeredAt ?? null,
    dose: input.dose,
    note: input.note ?? null,
  } satisfies MedicationDoseRequest
}

/** Contract response → domain Medication (shapes already align 1:1). */
export function fromResponse(r: MedicationResponse): Medication {
  return {
    id: r.id,
    name: r.name,
    activeIngredient: r.activeIngredient,
    route: r.route,
    cadence: r.cadence,
    defaultDose: r.defaultDose,
    doseUnit: r.doseUnit,
    cycle: r.cycle,
    active: r.active,
  }
}

function fromCycleResponse(c: MedicationCycleResponse): MedicationCycle {
  return {
    retaDay: c.retaDay,
    phaseKey: c.phaseKey,
    phaseLabel: c.phaseLabel,
    lastDoseAt: c.lastDoseAt ?? null,
    week: c.week.map(cell => ({
      day: cell.day,
      phaseKey: cell.phaseKey,
      label: cell.label,
      current: cell.current,
    })),
  }
}

function fromDoseResponse(d: MedicationDoseResponse): MedicationDose {
  return {
    id: d.id,
    administeredAt: d.administeredAt,
    dose: d.dose,
    note: d.note ?? null,
  }
}

function fromDayResponse(d: MedicationDayResponse): MedicationDay {
  return {
    medication: fromResponse(d.medication),
    cycle: fromCycleResponse(d.cycle),
    recentDoses: d.recentDoses.map(fromDoseResponse),
  }
}

export const medicationApi = {
  getDay: (): Promise<MedicationDay> =>
    apiFetch<MedicationDayResponse>('/api/medication').then(fromDayResponse),
  logDose: (medId: string, input: MedicationDoseInput): Promise<MedicationDose> =>
    apiFetch<MedicationDoseResponse>(`/api/medication/${medId}/dose`, {
      method: 'POST',
      body: JSON.stringify(toDoseRequest(input)),
    }).then(fromDoseResponse),
  deleteDose: (medId: string, doseId: string): Promise<void> =>
    apiFetch(`/api/medication/${medId}/dose/${doseId}`, { method: 'DELETE' }).then(() => undefined),
  updateMedication: (medId: string, input: MedicationInput): Promise<Medication> =>
    apiFetch<MedicationResponse>(`/api/medication/${medId}`, {
      method: 'PUT',
      body: JSON.stringify(toRequest(input)),
    }).then(fromResponse),
}
