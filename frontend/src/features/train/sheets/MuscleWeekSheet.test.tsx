import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MuscleWeekSheet } from '@/features/train/sheets/MuscleWeekSheet'
import { QueryWrapper } from '@/test/queryWrapper'
import type { Mesocycle, VolleyballSession } from '@/data/types'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const meso: Mesocycle = {
  id: 'm1', status: 'active', title: 'Hypertrophy', shortTitle: 'Hyper', goal: 'hipertrófia',
  startDate: 'Júl 13', endDate: 'Aug 24', weeks: 6, currentWeek: 1,
  split: 'Custom split · 4×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
  days: [{
    day: 'Hét', type: 'Push', muscle: 'chest', exerciseCount: 1,
    exercises: [{ id: 'e1', name: 'Bench', muscle: 'chest', warmupSets: 1, workingSets: 3, repMin: 8, repMax: 12, targetRIR: 2, type: 'compound', anchorWeightKg: 100 }],
  }],
}
const slots: VolleyballSession[] = [{ day: 'Kedd', time: '18:00', duration: 90, court: 'X', intensity: 'közepes', role: 'edzés' }]

const renderSheet = () =>
  render(<QueryWrapper><MuscleWeekSheet meso={meso} sportSlots={slots} onClose={() => {}} /></QueryWrapper>)

test('renders header + the three sections', () => {
  renderSheet()
  expect(screen.getByRole('heading', { name: 'Heti izomterhelés' })).toBeInTheDocument()
  expect(screen.getByText('Izomcsoportok')).toBeInTheDocument()
  expect(screen.getByText('Sport & futás terhelés')).toBeInTheDocument()
  expect(screen.getByText('Growth előrejelzés')).toBeInTheDocument()
})

test('muscle row shows sets, weekly reps, exercise count and stimulus chips', () => {
  renderSheet()
  // "Mell" also appears in the weekly-bands mirror below (wizard v2, mezo-d20.14) —
  // scope to the muscle-row card (identified by its unique rep-range text) to disambiguate.
  const muscleRow = screen.getByText('24–36 rep · 1 gyakorlat').closest('.col')
  expect(within(muscleRow as HTMLElement).getByText('Mell')).toBeInTheDocument()
  expect(screen.getByText('24–36 rep · 1 gyakorlat')).toBeInTheDocument()
  expect(screen.getByText('1×/hét gym')).toBeInTheDocument()
  expect(screen.getByText('+~300 XP')).toBeInTheDocument()
})

test('sport event card renders with region loads; forecast lists volleyball skills', () => {
  renderSheet()
  expect(screen.getByText('RÖPI')).toBeInTheDocument()
  expect(screen.getByText('Váll ▲▲▲')).toBeInTheDocument()
  expect(screen.getByText('Vertikális emelkedés')).toBeInTheDocument()
  expect(screen.getByText('Maximális erő')).toBeInTheDocument()
})

test('renders the weekly bands section (wizard v2, mezo-d20.14)', () => {
  renderSheet()
  expect(screen.getByText('Heti szetek · izmonként')).toBeInTheDocument()
})

test('bands show current → ceiling per group, and "szett · tart" for Maintain (wizard v2, mezo-d20.14)', () => {
  const bandsMeso: Mesocycle = {
    ...meso,
    // mirrors the mock active run's own musclePriorities ({shoulder: 'maintain'}, train.ts:69) —
    // MuscleWeekSheet threads meso.musclePriorities into weeklyBands.
    musclePriorities: { shoulder: 'maintain' },
    days: [{
      day: 'Hét', type: 'Push', muscle: 'chest', exerciseCount: 3,
      exercises: [
        { id: 'ob1', name: 'Bench Press', muscle: 'chest', warmupSets: 1, workingSets: 8, repMin: 4, repMax: 6, targetRIR: 1, type: 'compound', anchorWeightKg: 100 },
        { id: 'ob2', name: 'Cable Fly', muscle: 'chest', warmupSets: 1, workingSets: 8, repMin: 12, repMax: 15, targetRIR: 3, type: 'isolation', anchorWeightKg: 15 },
        { id: 'ob3', name: 'Lateral Raise', muscle: 'shoulder', warmupSets: 1, workingSets: 9, repMin: 12, repMax: 15, targetRIR: 2, type: 'isolation', anchorWeightKg: 10 },
      ],
    }],
  }
  render(<QueryWrapper><MuscleWeekSheet meso={bandsMeso} sportSlots={slots} onClose={() => {}} /></QueryWrapper>)
  // chest carries no key in musclePriorities -> tierOf defaults to 'grow' -> ceiling =
  // GROUP_LANDMARKS.chest.mav (14). 8+8 = 16 counted sets (both non-plyo, non-exempt) — planned
  // reads "16 → 14" (past ceiling renders as "plafonon", not a percentage).
  expect(screen.getByText('16 → 14')).toBeInTheDocument()
  // shoulder is 'maintain' -> ceiling = GROUP_LANDMARKS.shoulder.mev (8); Maintain rows always
  // render "planned szett · tart" instead of an arrow, regardless of the ceiling.
  expect(screen.getByText('9 szett · tart')).toBeInTheDocument()
})
