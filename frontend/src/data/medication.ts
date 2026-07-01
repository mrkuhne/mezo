import type { MedicationDay } from '@/data/types'

/**
 * Mock-mode medication day (Gyógyszer slice) — used as TanStack Query `initialData` in mock mode.
 * The owner's single active medication: Retatrutide on a 7-day kinetic cycle (D1 peak → D7 trough).
 * The derived cycle sits on retaDay 3 (stable phase), with the three most recent weekly doses.
 */
export const medicationSeed: MedicationDay = {
  medication: {
    id: 'med-reta',
    name: 'Retatrutide',
    activeIngredient: 'retatrutide',
    route: 'subQ',
    cadence: 'weekly-monday',
    defaultDose: 6,
    doseUnit: 'mg',
    active: true,
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
    retaDay: 3,
    phaseKey: 'stable',
    phaseLabel: 'Stabil · plató',
    lastDoseAt: '2026-06-22T07:00:00',
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
