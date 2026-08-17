import type { MedicationDay } from '@/data/types'

/** Neutral medication day for tests that exercise the POPULATED branch of the Gyógyszer slice.
 *  The app itself seeds no medication (mezo-lwmq) — this fixture exists only so the generic
 *  machinery (cycle derivation, dose log, cycle bar, LogDoseSheet) stays covered. */
export const medicationFixture: MedicationDay = {
  medication: {
    id: 'med-test', name: 'Teszt gyógyszer', activeIngredient: 'teszthatoanyag', route: 'subQ',
    cadence: 'weekly-monday', defaultDose: 6, doseUnit: 'mg', active: true,
    cycle: {
      cycleLengthDays: 7,
      phases: [
        { key: 'peak', fromDay: 1, toDay: 2, label: 'Peak · étvágy ↓' },
        { key: 'stable', fromDay: 3, toDay: 5, label: 'Stabil · plató' },
        { key: 'trough', fromDay: 6, toDay: 7, label: 'Trough · étvágy ↑' },
      ],
    },
  },
  cycle: {
    cycleDay: 3, phaseKey: 'stable', phaseLabel: 'Stabil · plató', lastDoseAt: '2026-06-22T07:00:00',
    week: [
      { day: 1, phaseKey: 'peak', label: 'Peak', current: false },
      { day: 2, phaseKey: 'peak', label: 'Peak', current: false },
      { day: 3, phaseKey: 'stable', label: 'Stabil', current: true },
      { day: 4, phaseKey: 'stable', label: 'Stabil', current: false },
      { day: 5, phaseKey: 'stable', label: 'Stabil', current: false },
      { day: 6, phaseKey: 'trough', label: 'Trough', current: false },
      { day: 7, phaseKey: 'trough', label: 'Trough', current: false },
    ],
  },
  recentDoses: [
    { id: 'dose-3', administeredAt: '2026-06-22T07:00:00', dose: 6, note: 'Hétfő reggel · subQ has' },
    { id: 'dose-2', administeredAt: '2026-06-15T07:10:00', dose: 6, note: null },
    { id: 'dose-1', administeredAt: '2026-06-08T07:05:00', dose: 6, note: null },
  ],
}
