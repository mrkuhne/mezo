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

test('recap marks a skipped exercise as "kihagyva" instead of a set count', () => {
  render(
    <WorkoutComplete
      workout={WORKOUT}
      completedSets={{ ex0: [{ weight: 100, reps: 8, rir: 2 }] }}
      hadPR={false}
      onExit={() => {}}
      skippedExerciseIds={['ex1']}
    />,
  )
  // Skipped exercise shows the "kihagyva" marker.
  expect(screen.getByText('kihagyva')).toBeInTheDocument()
  // A never-skipped exercise still shows its set count.
  expect(screen.getByText('1/4 szet')).toBeInTheDocument()
  // The skipped exercise must NOT render a 0/n set count (visually distinct from never-attempted).
  expect(screen.queryByText('0/3 szet')).not.toBeInTheDocument()
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
