import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
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
    cycleDay: c.cycleDay,
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

/** Contract day → domain day, or `null` when the owner has no active medication: the backend
 *  answers that with 200 and `medication`/`cycle` null (mezo-5cmq), a normal state and not an
 *  error. Mapping it would read `.id` off null — the exact crash this fix exists to stop — so the
 *  emptiness is carried out as `null` and the hook turns it into the no-medication ghost. */
function fromDayResponse(d: MedicationDayResponse): MedicationDay | null {
  if (!d.medication || !d.cycle) return null
  return {
    medication: fromResponse(d.medication),
    cycle: fromCycleResponse(d.cycle),
    recentDoses: d.recentDoses.map(fromDoseResponse),
  }
}

export const medicationApi = {
  /** `null` = the owner has no active medication (see fromDayResponse). */
  getDay: (): Promise<MedicationDay | null> =>
    apiFetch<MedicationDayResponse>('/api/medication').then(fromDayResponse),
  logDose: (medId: string, input: MedicationDoseInput): Promise<MedicationDose> =>
    apiFetch<MedicationDoseResponse>(`/api/medication/${medId}/dose`, {
      method: 'POST',
      body: JSON.stringify(toDoseRequest(input)),
    }).then(fromDoseResponse),
  deleteDose: (medId: string, doseId: string): Promise<void> =>
    apiFetch(`/api/medication/${medId}/dose/${doseId}`, { method: 'DELETE' }).then(() => undefined),
  createMedication: (input: MedicationInput): Promise<Medication> =>
    apiFetch<MedicationResponse>('/api/medication', {
      method: 'POST',
      body: JSON.stringify(toRequest(input)),
    }).then(fromResponse),
  updateMedication: (medId: string, input: MedicationInput): Promise<Medication> =>
    apiFetch<MedicationResponse>(`/api/medication/${medId}`, {
      method: 'PUT',
      body: JSON.stringify(toRequest(input)),
    }).then(fromResponse),
}
