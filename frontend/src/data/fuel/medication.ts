import type { MedicationDay } from '@/data/types'

/**
 * Mock-mode medication day (Gyógyszer slice) — used as TanStack Query `initialData` in mock mode.
 * The owner tracks NO medication (mezo-lwmq): an honest no-medication ghost, byte-identical in
 * shape to the real-mode `MEDICATION_EMPTY` fallback in `medicationHooks.ts`. Tests that need the
 * populated branch seed their own fixture — see `medicationFixture` in `@/test/fixtures/medication`.
 */
export const medicationSeed: MedicationDay = {
  medication: {
    id: '', name: '', activeIngredient: '', route: '', cadence: '',
    defaultDose: 0, doseUnit: '', active: false,
    cycle: { cycleLengthDays: 0, phases: [] },
  },
  cycle: { cycleDay: 0, phaseKey: '', phaseLabel: '', lastDoseAt: null, week: [] },
  recentDoses: [],
}
