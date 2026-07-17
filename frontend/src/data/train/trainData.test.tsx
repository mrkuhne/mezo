import {
  mesocycles, activeMeso, workout, gymSchedule, sport, exerciseLibrary,
  GOAL_PRESETS, SPLITS, MUSCLE_LABELS, DAY_LABELS, DAY_ORDER,
  MESOCYCLE_PHASE_COLORS, phaseBarHeight,
} from '@/data/train/train'

test('mesocycles: one active, two planned, one archived', () => {
  expect(mesocycles).toHaveLength(4)
  expect(mesocycles.filter((m) => m.status === 'active')).toHaveLength(1)
  expect(mesocycles.filter((m) => m.status === 'planned')).toHaveLength(2)
  expect(mesocycles.filter((m) => m.status === 'archived')).toHaveLength(1)
  expect(activeMeso.shortTitle).toBe('Hypertrophy 04')
  expect(activeMeso.currentWeek).toBe(3)
  expect(activeMeso.phaseCurve).toEqual(['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'])
})

test('active workout: 5 exercises, niggle warning, 3 pre-workout challenges', () => {
  expect(workout.title).toBe('Pull Day')
  expect(workout.exercises).toHaveLength(5)
  expect(workout.exercises[0].name).toBe('Chest Supported Row')
  expect(workout.exercises[0].lastWeek).toEqual({ weight: 102.5, reps: 9, rir: 2 })
  expect(workout.niggleWarning?.muscleLabel).toBe('Jobb váll')
  expect(workout.challenges).toHaveLength(3)
  expect(workout.challenges[0].type).toBe('PR')
})

test('gym weekly schedule: Csütörtök is today + Pull Day', () => {
  const csu = gymSchedule.weeklyTimes.find((d) => d.day === 'Csü')
  expect(csu?.today).toBe(true)
  expect(csu?.type).toBe('Pull Day')
  expect(csu?.duration).toBe(78)
})

test('sport: volleyball schedule, recent sessions with jumpCount, crossLoad', () => {
  expect(sport.schedule.volleyball.team).toBe('BVSC · Felnőtt II.')
  expect(sport.sessions.length).toBeGreaterThanOrEqual(5)
  expect(sport.sessions.every((s) => typeof s.jumpCount === 'number')).toBe(true)
  expect(sport.week.avgRPE).toBeCloseTo(7.1)
  expect(sport.crossLoad.length).toBeGreaterThanOrEqual(5)
})

test('exercise library + planner presets + label maps', () => {
  expect(exerciseLibrary.length).toBeGreaterThanOrEqual(15)
  expect(GOAL_PRESETS.length).toBeGreaterThanOrEqual(6)
  expect(GOAL_PRESETS[0].id).toBe('hypertrophy')
  expect(GOAL_PRESETS.some((g) => g.id === 'erohipertrofia')).toBe(true)
  expect(SPLITS.length).toBeGreaterThanOrEqual(5)
  expect(MUSCLE_LABELS.chest).toBe('Mell')
  expect(DAY_LABELS.Csü).toBe('Csütörtök')
  expect(DAY_ORDER).toEqual(['Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'])
  expect(MESOCYCLE_PHASE_COLORS.MAV).toBe('var(--coral)')
  expect(phaseBarHeight('MRV')).toBeGreaterThan(phaseBarHeight('MEV'))
})
