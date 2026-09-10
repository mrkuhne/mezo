import { describe, expect, test } from 'vitest'
import { nextStep, type NextStepInputs } from './nextStep'

const base: NextStepInputs = {
  face: 'nap', ritualClosed: false, intentionSet: true, morningHabitPending: false,
  checkinStale: false, waterMl: 1600, waterTargetMl: 2000, workoutPlanned: true,
  workoutDone: true, goalStep: null,
}

describe('nextStep — egy kiemelt lépés', () => {
  test('este mindig a napzárás, lezárás után lecsendesül', () => {
    expect(nextStep({ ...base, face: 'este' }).to).toBe('/ritual')
    expect(nextStep({ ...base, face: 'este', ritualClosed: true }).title).toBe('A mai nap a helyén.')
  })
  test('reggel: előbb a szándék, aztán a reggeli rutin', () => {
    expect(nextStep({ ...base, face: 'reggel', intentionSet: false }).kind).toBe('intention')
    expect(nextStep({ ...base, face: 'reggel', morningHabitPending: true }).to).toBe('/nap/rutin?dp=reggel')
  })
  test('napközbeni létra: check-in → víz → edzés → cél → napló', () => {
    expect(nextStep({ ...base, checkinStale: true }).to).toBe('/nap/checkin')
    expect(nextStep({ ...base, waterMl: 500 }).to).toBe('/fuel')
    expect(nextStep({ ...base, workoutDone: false }).to).toBe('/train')
    expect(nextStep({ ...base, goalStep: 'Heti három edzés' }).sub).toBe('Heti három edzés')
    expect(nextStep(base).title).toBe('Egy gondolatnyi hely.')
  })
  test('a check-in megelőzi a vizet (egy dolog egyszerre)', () => {
    expect(nextStep({ ...base, checkinStale: true, waterMl: 0 }).to).toBe('/nap/checkin')
  })
})
