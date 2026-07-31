import type { Medal } from '@/data/train/medalTypes'

// Offline cabinet seed (mezo-wp6n): plausible medals across three of the mock plan's
// exercises (train.ts `workout.exercises` / `exerciseLibrary` — exl-1/exl-2/exl-6),
// spanning ~6 weeks, mixing all five medal types so the cabinet (Task 10) has content
// to group and render without a backend. Exercise names match the mock plan's English
// gym-exercise catalog verbatim (the mock plan itself has no Hungarian exercise names).
export const medalsMock: Medal[] = [
  {
    type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Chest Supported Row',
    catalogId: 'exl-1', muscle: 'back-mid', date: '2026-06-22',
    workoutSessionId: 'w1', setIndex: 2,
    value: 100, unit: 'KG', weightKg: 100, reps: 8,
    previousValue: 97.5, previousDate: '2026-06-08',
  },
  {
    type: 'E1RM', tier: 'RECORD', exerciseName: 'Chest Supported Row',
    catalogId: 'exl-1', muscle: 'back-mid', date: '2026-07-06',
    workoutSessionId: 'w3', setIndex: 3,
    value: 126.7, unit: 'KG', weightKg: 102.5, reps: 8,
    previousValue: 120, previousDate: '2026-06-22',
  },
  {
    type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Chest Supported Row',
    catalogId: 'exl-1', muscle: 'back-mid', date: '2026-07-20',
    workoutSessionId: 'w5', setIndex: 4,
    value: 10, unit: 'REPS', weightKg: 105, reps: 10,
    previousValue: null, previousDate: null,
  },
  {
    type: 'REPS_AT_WEIGHT', tier: 'RECORD', exerciseName: 'Lat Pulldown · Pronated',
    catalogId: 'exl-2', muscle: 'back-wide', date: '2026-06-29',
    workoutSessionId: 'w2', setIndex: 3,
    value: 12, unit: 'REPS', weightKg: 74.5, reps: 12,
    previousValue: 10, previousDate: '2026-06-15',
  },
  {
    type: 'SESSION_VOLUME', tier: 'RECORD', exerciseName: 'Lat Pulldown · Pronated',
    catalogId: 'exl-2', muscle: 'back-wide', date: '2026-07-13',
    workoutSessionId: 'w4', setIndex: null,
    value: 2450, unit: 'KG', weightKg: null, reps: null,
    previousValue: 2200, previousDate: '2026-06-29',
  },
  {
    type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Hammer Curl',
    catalogId: 'exl-6', muscle: 'biceps-brachialis', date: '2026-06-15',
    workoutSessionId: 'w1', setIndex: 3,
    value: 20, unit: 'KG', weightKg: 20, reps: 11,
    previousValue: 18, previousDate: '2026-05-25',
  },
  {
    type: 'E1RM', tier: 'RECORD', exerciseName: 'Hammer Curl',
    catalogId: 'exl-6', muscle: 'biceps-brachialis', date: '2026-07-27',
    workoutSessionId: 'w6', setIndex: 3,
    value: 30.7, unit: 'KG', weightKg: 22, reps: 12,
    previousValue: 28, previousDate: '2026-06-15',
  },
  {
    type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Hammer Curl',
    catalogId: 'exl-6', muscle: 'biceps-brachialis', date: '2026-07-27',
    workoutSessionId: 'w6', setIndex: 3,
    value: 12, unit: 'REPS', weightKg: 22, reps: 12,
    previousValue: null, previousDate: null,
  },
]
