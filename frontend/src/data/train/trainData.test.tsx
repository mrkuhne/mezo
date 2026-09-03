import {
  mesocycles, activeMeso, workout, gymSchedule, sport, exerciseLibrary,
  MUSCLE_LABELS, DAY_LABELS, DAY_ORDER,
  MESOCYCLE_PHASE_COLORS, phaseBarHeight,
} from '@/data/train/train'

test('mesocycles: one active, two planned, three archived (two with a report, one without)', () => {
  expect(mesocycles).toHaveLength(6)
  expect(mesocycles.filter((m) => m.status === 'active')).toHaveLength(1)
  expect(mesocycles.filter((m) => m.status === 'planned')).toHaveLength(2)
  // Three closed runs since the mezo-meyc.4 fix wave — a pair with reports for the compare
  // view, plus a third, report-less one so the library's selection mode has a run to prove
  // it refuses a THIRD pick.
  const archived = mesocycles.filter((m) => m.status === 'archived')
  expect(archived).toHaveLength(3)
  expect(archived.map((m) => m.id)).toEqual(['meso-rec-03', 'meso-hyp-03', 'meso-cut-02'])
  expect(archived.filter((m) => m.hasReport === true).map((m) => m.id)).toEqual(['meso-rec-03', 'meso-hyp-03'])
  expect(archived.find((m) => m.id === 'meso-cut-02')?.hasReport).toBe(false)
  expect(activeMeso.shortTitle).toBe('Hypertrophy 04')
  expect(activeMeso.currentWeek).toBe(3)
  expect(activeMeso.phaseCurve).toEqual(['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'])
})

test('active workout: 5 exercises, niggle warning, 4 pre-workout challenges', () => {
  expect(workout.title).toBe('Pull Day')
  expect(workout.exercises).toHaveLength(5)
  expect(workout.exercises[0].name).toBe('Chest Supported Row')
  expect(workout.exercises[0].lastWeek).toEqual({ weight: 102.5, reps: 9, rir: 2 })
  expect(workout.niggleWarning?.muscleLabel).toBe('Jobb váll')
  expect(workout.challenges).toHaveLength(4)
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

test('exercise library + label maps', () => {
  expect(exerciseLibrary.length).toBeGreaterThanOrEqual(15)
  expect(MUSCLE_LABELS.chest).toBe('Mell')
  expect(DAY_LABELS.Csü).toBe('Csütörtök')
  expect(DAY_ORDER).toEqual(['Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'])
  expect(MESOCYCLE_PHASE_COLORS.MAV).toBe('var(--coral)')
  expect(phaseBarHeight('MRV')).toBeGreaterThan(phaseBarHeight('MEV'))
})
