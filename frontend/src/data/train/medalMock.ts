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
    // Scoped to the review-page fixture (mezo-w943 final review, Finding 2): matches
    // `workoutDetailMock.id` (data/train/train.ts) so /train/review renders a "Medálok"
    // section in mock mode at all — every OTHER seeded medal points at a 'w1'..'w6' id
    // that no mock workout detail carries, so the review page's medal filter never
    // matched anything before this. setIndex 2 also lands on a real logged set of
    // `workoutDetailMock`'s "Chest Supported Row" (index 2, 85 kg × 8) — renders both
    // the medal card AND that set's 🏅 record chip. workoutSessionId is not rendered
    // anywhere, so this is content-neutral for every other consumer (MedalsPage, visual).
    workoutSessionId: 'wd-mock-1', setIndex: 2,
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
    // Re-pointed from 'w5' to the review fixture (mezo-d20.8.2.1): the "Mihez képest" tile's
    // célszett delta needs a TARGET medal on at least one side of the comparison, and the
    // previous instance (wd-mock-0) deliberately has none — so the cell reads +1 and
    // demonstrates the only toned direction the palette has. Re-pointing rather than ADDING a
    // row keeps the medal cabinet's content identical, exactly as the WEIGHT row above does.
    type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Chest Supported Row',
    catalogId: 'exl-1', muscle: 'back-mid', date: '2026-07-20',
    workoutSessionId: 'wd-mock-1', setIndex: 4,
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
    // weightKg/reps mirror the backend shape (MedalService.toMedal): they name the
    // session's top set, NOT the headline — that's `value` (the session volume, kg).
    // See medalLabels.ts medalValueLabel for why the two must not be conflated.
    type: 'SESSION_VOLUME', tier: 'RECORD', exerciseName: 'Lat Pulldown · Pronated',
    catalogId: 'exl-2', muscle: 'back-wide', date: '2026-07-13',
    workoutSessionId: 'w4', setIndex: 2,
    value: 2450, unit: 'KG', weightKg: 77.5, reps: 10,
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
