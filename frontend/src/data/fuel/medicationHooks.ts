import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { medicationApi } from '@/data/fuel/medicationApi'
import { isMockMode } from '@/data/_client/mode'
import { localDateString } from '@/shared/lib/dates'
import { useDualQuery, DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import { medicationSeed } from '@/data/fuel/medication'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
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
} from '@/data/types'

const MEDICATION_KEY = ['medication'] as const
const TODAY_KEY = ['today'] as const
const FUELDAY_KEY = ['fuelDay'] as const

// Real-mode unresolved fallback — a no-medication ghost, NEVER the seed (the "no static
// fallback in real mode" invariant). cycleDay 0 + empty week + empty doses, mirroring the
// backend's honest-zero MedicationCycle when there is no dose to anchor "now".
const EMPTY_MEDICATION: Medication = {
  id: '', name: '', activeIngredient: '', route: '', cadence: '',
  defaultDose: 0, doseUnit: '', active: false,
  cycle: { cycleLengthDays: 0, phases: [] },
}
const EMPTY_CYCLE: MedicationCycle = { cycleDay: 0, phaseKey: '', phaseLabel: '', lastDoseAt: null, week: [] }
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
    // Both "no medication configured" contract shapes land on the SAME ghost (mezo-5cmq): the
    // new backend answers 200 with `medication: null` (mapped to `null` here), the pre-5cmq one
    // answered 404, which rejects and is absorbed by `realEmpty` below. The two images do not
    // switch at the same moment, so the frontend has to read both.
    realFetch: async () => (await medicationApi.getDay()) ?? MEDICATION_EMPTY,
    realEmpty: MEDICATION_EMPTY,
    // The app default instead of the old always-stale `0` (mezo-5cmq): useTodayScenario mounts
    // this from the shell AND from several pages, so staleTime 0 bought a round-trip on every
    // navigation. Writes stay instant regardless — useMedicationActions invalidates
    // ['medication'] on every dose/definition change. Passed EXPLICITLY rather than omitted:
    // omitting sends `staleTime: undefined`, which clobbers the client default (see the
    // `realStaleTime` doc) and would leave the query always-stale after all.
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { medication: data.medication, cycle: data.cycle, doses: data.recentDoses }
}

/** log/remove a dose + update the medication definition. Mock mutates the ['medication'] cache via
 *  setQueryData (logDose recomputes the cycle); real calls medicationApi then invalidates
 *  ['medication'] + ['today'] + ['fuelDay'] (the cycle/cycleDay broadcast feeds Today + Fuel). */
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
      ? async (input: MedicationDoseInput) => {
          mockLogDose(qc, input)
          awardGamificationEvent(qc, { type: 'MEDICATION' })
          return undefined
        }
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

  const createM = useMutation({
    mutationFn: mock
      ? async (input: MedicationInput) => mockCreateMedication(qc, input)
      : (input: MedicationInput) => medicationApi.createMedication(input).then(() => undefined),
    onSuccess: mock ? undefined : invalidate,
  })
  const stopM = useMutation({
    // Stop = PUT active:false (soft-archive, the dose history stays server-side); the day read
    // then answers "no active medication" and the page falls onto its honest empty state.
    mutationFn: mock
      ? async (_input: MedicationInput) => mockStopMedication(qc)
      : (input: MedicationInput) => medicationApi.updateMedication(medId(qc), { ...input, active: false }).then(() => undefined),
    onSuccess: mock ? undefined : invalidate,
  })

  const logDose = useCallback((input: MedicationDoseInput) => logM.mutate(input), [logM])
  const removeDose = useCallback((doseId: string) => removeM.mutate(doseId), [removeM])
  const updateMedication = useCallback((input: MedicationInput) => updateM.mutate(input), [updateM])
  const createMedication = useCallback((input: MedicationInput) => createM.mutate(input), [createM])
  const stopMedication = useCallback((input: MedicationInput) => stopM.mutate(input), [stopM])
  return { logDose, removeDose, updateMedication, createMedication, stopMedication }
}

/** The active medication's id from the cached day (real mode) — for the api path params. */
function medId(qc: ReturnType<typeof useQueryClient>): string {
  return qc.getQueryData<MedicationDay>(MEDICATION_KEY)?.medication.id ?? ''
}

// --- mock-mode cache mutators. logDose/removeDose recompute the cycle the same way the backend
// MedicationCycleService.derive does: cycleDay = days-since-newest-dose + 1, clamped to
// cycleLengthDays (a dose today → cycleDay 1); the phase + week grid project that day onto the
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
  if (doses.length === 0) return { cycleDay: 0, phaseKey: '', phaseLabel: '', lastDoseAt: null, week: buildWeek(cfg, 0) }
  const newest = doses.reduce((a, b) => (a.administeredAt >= b.administeredAt ? a : b))
  const since = daysBetween(newest.administeredAt, localDateString())
  const day = Math.min(since + 1, cfg.cycleLengthDays)
  const phase = phaseOf(cfg, day)
  return {
    cycleDay: day,
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
function mockCreateMedication(qc: ReturnType<typeof useQueryClient>, input: MedicationInput) {
  const medication: Medication = { ...input, id: crypto.randomUUID() }
  qc.setQueryData<MedicationDay>(MEDICATION_KEY, {
    medication,
    cycle: deriveCycle(medication, []), // no dose yet — the honest-zero ghost cycle
    recentDoses: [],
  })
  return undefined
}
function mockStopMedication(qc: ReturnType<typeof useQueryClient>) {
  // The mock mirror of the real day read after a stop: no active medication -> the ghost.
  qc.setQueryData<MedicationDay>(MEDICATION_KEY, MEDICATION_EMPTY)
  return undefined
}
function mockUpdateMedication(qc: ReturnType<typeof useQueryClient>, input: MedicationInput) {
  qc.setQueryData<MedicationDay>(MEDICATION_KEY, prev => {
    const base = prev ?? medicationSeed
    const medication: Medication = { ...base.medication, ...input }
    return { ...base, medication, cycle: deriveCycle(medication, base.recentDoses) }
  })
  return undefined
}
