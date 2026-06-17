import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import { WorkoutComplete } from './WorkoutComplete'
import type { WorkoutPlan } from '@/data/types'

const WORKOUT: WorkoutPlan = {
  title: 'Pull Day',
  tag: '',
  durationEst: 60,
  exercises: [
    { id: 'ex0', name: 'Chest Supported Row', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound', muscle: 'back-mid', lastWeek: null },
    { id: 'ex1', name: 'Lat Pulldown · Pronated', sets: 3, targetReps: '10-12', targetRIR: 2, type: 'compound', muscle: 'lats', lastWeek: null },
  ],
  challenges: [],
}

test('recap marks a fully-skipped exercise (no logged sets) as "kihagyva" instead of a set count', () => {
  render(
    <WorkoutComplete
      workout={WORKOUT}
      completedSets={{ ex0: [{ weight: 100, reps: 8, rir: 2 }] }}
      hadPR={false}
      onExit={() => {}}
      skippedExerciseIds={['ex1']}
    />,
  )
  // Fully-skipped exercise (0 logged sets) shows the "kihagyva" marker.
  expect(screen.getByText('kihagyva')).toBeInTheDocument()
  // A never-skipped exercise still shows its set count.
  expect(screen.getByText('1/4 szet')).toBeInTheDocument()
  // The fully-skipped exercise must NOT render a 0/n set count (visually distinct from never-attempted).
  expect(screen.queryByText('0/3 szet')).not.toBeInTheDocument()
})

test('recap keeps the real set count AND adds a "kihagyva" marker for a partially-skipped exercise', () => {
  render(
    <WorkoutComplete
      workout={WORKOUT}
      completedSets={{
        // ex0 (4 target sets) was logged 2× then skipped — sets are real and counted.
        ex0: [
          { weight: 100, reps: 8, rir: 2 },
          { weight: 100, reps: 7, rir: 1 },
        ],
      }}
      hadPR={false}
      onExit={() => {}}
      skippedExerciseIds={['ex0']}
    />,
  )
  // The 2 logged sets stay visible as the real count (counted in "Mai mérleg").
  expect(screen.getByText('2/4 szet')).toBeInTheDocument()
  // ...and a muted marker still communicates the remainder was skipped.
  expect(screen.getByText(/kihagyva/)).toBeInTheDocument()
})

test('recap shows the set count when no exercise is skipped', () => {
  render(
    <WorkoutComplete
      workout={WORKOUT}
      completedSets={{ ex0: [{ weight: 100, reps: 8, rir: 2 }], ex1: [{ weight: 70, reps: 10, rir: 2 }] }}
      hadPR={false}
      onExit={() => {}}
    />,
  )
  expect(screen.queryByText('kihagyva')).not.toBeInTheDocument()
  expect(screen.getByText('1/4 szet')).toBeInTheDocument()
  expect(screen.getByText('1/3 szet')).toBeInTheDocument()
})
