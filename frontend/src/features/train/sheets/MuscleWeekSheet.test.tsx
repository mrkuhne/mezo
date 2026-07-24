import { render, screen } from '@testing-library/react'
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
  expect(screen.getByText('Mell')).toBeInTheDocument()
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
