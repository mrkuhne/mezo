import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { medicationApi } from '@/lib/medicationApi'
import { isMockMode } from '@/lib/mode'
import { localDateString } from '@/lib/dates'
import { useDualQuery } from './useDualQuery'
import { medicationSeed } from './medication'
import type {
  Medication,
  MedicationCycle,
  MedicationCycleCell,
  MedicationCycleConfig,
  MedicationDay,
  MedicationDose,
  MedicationDoseInput,
  MedicationInput,
  MedicationPhase,
} from './types'

const MEDICATION_KEY = ['medication'] as const
const TODAY_KEY = ['today'] as const
const FUELDAY_KEY = ['fuelDay'] as const

// Real-mode unresolved fallback — a no-medication ghost, NEVER the seed (the "no static
// fallback in real mode" invariant). retaDay 0 + empty week + empty doses, mirroring the
// backend's honest-zero MedicationCycle when there is no dose to anchor "now".
const EMPTY_MEDICATION: Medication = {
  id: '', name: '', activeIngredient: '', route: '', cadence: '',
  defaultDose: 0, doseUnit: '', active: false,
  cycle: { cycleLengthDays: 0, phases: [] },
}
const EMPTY_CYCLE: MedicationCycle = { retaDay: 0, phaseKey: '', phaseLabel: '', lastDoseAt: null, week: [] }
const MEDICATION_EMPTY: MedicationDay = { medication: EMPTY_MEDICATION, cycle: EMPTY_CYCLE, recentDoses: [] }

/**
 * Dual-mode medication day (Fuel "Gyógyszer" slice). Mock seeds `medicationSeed` synchronously via
 * initialData (never background-refetches — useMedicationActions owns the cache via setQueryData);
 * real fetches `GET /api/medication` and, while unresolved, returns the no-medication ghost.
 */
export function useMedication(): { medication: Medication; cycle: MedicationCycle; doses: MedicationDose[] } {
  const { data } = useDualQuery<MedicationDay>({
    queryKey: MEDICATION_KEY,
    mockData: medicationSeed,
    realFetch: () => medicationApi.getDay(),
    realEmpty: MEDICATION_EMPTY,
    realStaleTime: 0,
  })
  return { medication: data.medication, cycle: data.cycle, doses: data.recentDoses }
}

/** log/remove a dose + update the medication definition. Mock mutates the ['medication'] cache via
 *  setQueryData (logDose recomputes the cycle); real calls medicationApi then invalidates
 *  ['medication'] + ['today'] + ['fuelDay'] (the cycle/retaDay broadcast feeds Today + Fuel). */
export function useMedicationActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: MEDICATION_KEY })
    qc.invalidateQueries({ queryKey: TODAY_KEY })
    qc.invalidateQueries({ queryKey: FUELDAY_KEY })
  }

  const logM = useMutation({
    mutationFn: mock
      ? async (input: MedicationDoseInput) => mockLogDose(qc, input)
      : (input: MedicationDoseInput) => medicationApi.logDose(medId(qc), input),
    onSuccess: mock ? undefined : invalidate,
  })
  const removeM = useMutation({
    mutationFn: mock
      ? async (doseId: string) => mockRemoveDose(qc, doseId)
      : (doseId: string) => medicationApi.deleteDose(medId(qc), doseId),
    onSuccess: mock ? undefined : invalidate,
  })
  const updateM = useMutation({
    mutationFn: mock
      ? async (input: MedicationInput) => mockUpdateMedication(qc, input)
      : (input: MedicationInput) => medicationApi.updateMedication(medId(qc), input),
    onSuccess: mock ? undefined : invalidate,
  })

  const logDose = useCallback((input: MedicationDoseInput) => logM.mutate(input), [logM])
  const removeDose = useCallback((doseId: string) => removeM.mutate(doseId), [removeM])
  const updateMedication = useCallback((input: MedicationInput) => updateM.mutate(input), [updateM])
  return { logDose, removeDose, updateMedication }
}

/** The active medication's id from the cached day (real mode) — for the api path params. */
function medId(qc: ReturnType<typeof useQueryClient>): string {
  return qc.getQueryData<MedicationDay>(MEDICATION_KEY)?.medication.id ?? ''
}

// --- mock-mode cache mutators. logDose/removeDose recompute the cycle the same way the backend
// MedicationCycleService.derive does: retaDay = days-since-newest-dose + 1, clamped to
// cycleLengthDays (a dose today → retaDay 1); the phase + week grid project that day onto the
// medication's cycle config. ---

/** The phase whose fromDay..toDay (inclusive) contains `day`; the last phase if none (clamped past). */
function phaseOf(cfg: MedicationCycleConfig, day: number): MedicationPhase | undefined {
  return cfg.phases.find(p => day >= p.fromDay && day <= p.toDay) ?? cfg.phases.at(-1)
}

/** Cells 1..cycleLengthDays, the cell at `currentDay` marked current (day 0 → none, the ghost week). */
function buildWeek(cfg: MedicationCycleConfig, currentDay: number): MedicationCycleCell[] {
  return Array.from({ length: cfg.cycleLengthDays }, (_, i) => {
    const day = i + 1
    const phase = phaseOf(cfg, day)
    return { day, phaseKey: phase?.key ?? '', label: phase?.label ?? '', current: day === currentDay }
  })
}

/** Days between two ISO datetime strings (date part only), mirroring ChronoUnit.DAYS.between. */
function daysBetween(fromIso: string, toIso: string): number {
  const d = (iso: string) => Date.UTC(...(iso.slice(0, 10).split('-').map(Number) as [number, number, number]))
  return Math.round((d(toIso) - d(fromIso)) / 86_400_000)
}

/** Re-derive the cycle from the newest dose (FE mirror of MedicationCycleService.derive). */
function deriveCycle(med: Medication, doses: MedicationDose[]): MedicationCycle {
  const cfg = med.cycle
  if (doses.length === 0) return { retaDay: 0, phaseKey: '', phaseLabel: '', lastDoseAt: null, week: buildWeek(cfg, 0) }
  const newest = doses.reduce((a, b) => (a.administeredAt >= b.administeredAt ? a : b))
  const since = daysBetween(newest.administeredAt, localDateString())
  const day = Math.min(since + 1, cfg.cycleLengthDays)
  const phase = phaseOf(cfg, day)
  return {
    retaDay: day,
    phaseKey: phase?.key ?? '',
    phaseLabel: phase?.label ?? '',
    lastDoseAt: newest.administeredAt,
    week: buildWeek(cfg, day),
  }
}

function patchDay(qc: ReturnType<typeof useQueryClient>, fn: (d: MedicationDay) => MedicationDose[]) {
  qc.setQueryData<MedicationDay>(MEDICATION_KEY, prev => {
    const base = prev ?? medicationSeed
    const recentDoses = fn(base)
    return { ...base, recentDoses, cycle: deriveCycle(base.medication, recentDoses) }
  })
  return undefined
}
function mockLogDose(qc: ReturnType<typeof useQueryClient>, input: MedicationDoseInput) {
  const dose: MedicationDose = {
    id: crypto.randomUUID(),
    administeredAt: input.administeredAt ?? `${localDateString()}T${new Date().toTimeString().slice(0, 8)}`,
    dose: input.dose,
    note: input.note ?? null,
  }
  return patchDay(qc, d => [dose, ...d.recentDoses])
}
function mockRemoveDose(qc: ReturnType<typeof useQueryClient>, doseId: string) {
  return patchDay(qc, d => d.recentDoses.filter(x => x.id !== doseId))
}
function mockUpdateMedication(qc: ReturnType<typeof useQueryClient>, input: MedicationInput) {
  qc.setQueryData<MedicationDay>(MEDICATION_KEY, prev => {
    const base = prev ?? medicationSeed
    const medication: Medication = { ...base.medication, ...input }
    return { ...base, medication, cycle: deriveCycle(medication, base.recentDoses) }
  })
  return undefined
}
