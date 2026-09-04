import { BIRTH_DATE_MIN, HEIGHT_CM, WEIGHT_KG, birthDateValid, clamp, summaryLines } from '@/features/auth/logic/onboardingSteps'

test('bounds mirror the contracts (heightCm 50..260, weightKg inside (0, 999.99])', () => {
  expect(HEIGHT_CM).toMatchObject({ min: 50, max: 260 })
  expect(WEIGHT_KG).toMatchObject({ min: 1, max: 999.9 })
  expect(clamp(999, HEIGHT_CM.min, HEIGHT_CM.max)).toBe(260)
  expect(clamp(0, WEIGHT_KG.min, WEIGHT_KG.max)).toBe(1)
  expect(clamp(72.5, WEIGHT_KG.min, WEIGHT_KG.max)).toBe(72.5)
})

test('a birth date must be set, after the floor and before today', () => {
  expect(birthDateValid('', '2026-09-02')).toBe(false)
  expect(birthDateValid('1899-12-31', '2026-09-02')).toBe(false)
  expect(birthDateValid('2026-09-02', '2026-09-02')).toBe(false)
  expect(birthDateValid('1993-05-14', '2026-09-02')).toBe(true)
  expect(BIRTH_DATE_MIN).toBe('1900-01-01')
})

test('the summary lists name, birth date, sex, height and weight in Hungarian', () => {
  expect(summaryLines('Béla', { sex: 'M', birthDate: '1993-05-14', heightCm: 181, weightKg: 84.5 })).toEqual([
    'Név: Béla', 'Születési dátum: 1993-05-14', 'Nem: Férfi', 'Magasság: 181 cm', 'Súly: 84,5 kg',
  ])
  expect(summaryLines('Anna', { sex: 'F', birthDate: '1994-02-11', heightCm: 168, weightKg: 61 })[2]).toBe('Nem: Nő')
})
