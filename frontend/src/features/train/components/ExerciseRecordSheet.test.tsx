import { render, screen } from '@testing-library/react'
import type { ExerciseRecordResponse } from '@/lib/trainApi'
import { ExerciseRecordSheet } from '@/features/train/components/ExerciseRecordSheet'

const fullRecord: ExerciseRecordResponse = {
  catalogId: 'f1e3a0e2-0000-4000-8000-000000000070',
  name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound',
  bestSet: { weightKg: 102.5, reps: 9, date: '2026-06-02' },
  bestE1rm: { value: 133.3, set: { weightKg: 102.5, reps: 9, date: '2026-06-02' } },
  bestSessionVolume: { volumeKg: 4920, date: '2026-05-26' },
  totalVolume: 182450, totalSets: 342, totalReps: 2814, sessionCount: 21,
  repRecords: [
    { weightKg: 102.5, reps: 9, date: '2026-06-02' },
    { weightKg: 100, reps: 9, date: '2026-05-19' },
    { weightKg: 90, reps: 13, date: '2026-04-28' },
  ],
  recentTopSets: [
    { weightKg: 95, reps: 8, date: '2026-05-12' },
    { weightKg: 102.5, reps: 9, date: '2026-06-02' },
  ],
}

const bodyweightRecord: ExerciseRecordResponse = {
  name: 'Box Jump', muscle: 'quad', type: 'plyo',
  totalVolume: 0, totalSets: 18, totalReps: 186, sessionCount: 6,
  repRecords: [],
  recentTopSets: [{ reps: 12, date: '2026-06-02' }],
}

test('renders hero best set, stat grid, rep records and recent sets', () => {
  render(<ExerciseRecordSheet record={fullRecord} onClose={() => {}} />)
  expect(screen.getByRole('heading', { name: 'Chest Supported Row' })).toBeInTheDocument()
  expect(screen.getByText('102.5 kg × 9')).toBeInTheDocument()       // hero
  expect(screen.getByText('133.3 kg')).toBeInTheDocument()           // e1RM
  expect(screen.getByText('4920 kg')).toBeInTheDocument()            // best session volume (HU: no grouping under 5 digits)
  expect(screen.getByText('182,5 t')).toBeInTheDocument()            // total volume >= 10t
  expect(screen.getByText('342 · 2814')).toBeInTheDocument()         // sets · reps
  expect(screen.getByText('13 REP')).toBeInTheDocument()             // rep record row (90 kg)
  expect(screen.getByText('Máj 12')).toBeInTheDocument()             // sparkline date label
})

test('bodyweight record shows rep hero and dashes for weight stats', () => {
  render(<ExerciseRecordSheet record={bodyweightRecord} onClose={() => {}} />)
  expect(screen.getByText('186 rep')).toBeInTheDocument()            // hero = total reps
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)  // e1RM + session volume cells
  expect(screen.queryByText(/Rep-rekord/i)).not.toBeInTheDocument()  // table hidden when empty
})
