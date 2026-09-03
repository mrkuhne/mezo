import { sectionFor } from '@/app/headerSection'

test('az öt tab gyökere a saját nevét és spotját adja', () => {
  expect(sectionFor('/nap')).toEqual({ label: 'Nap', spot: 's-reggel' })
  expect(sectionFor('/train')).toEqual({ label: 'Edzés', spot: 's-edzes' })
  expect(sectionFor('/fuel')).toEqual({ label: 'Fuel', spot: 's-fuel' })
  expect(sectionFor('/mezo')).toEqual({ label: 'Mezo', spot: 's-orb-figyel' })
  expect(sectionFor('/me')).toEqual({ label: 'Én', spot: 's-en' })
})

// A fejléc a SZEKCIÓT jelöli („hol vagyok"), nem az oldalt — a pontos címet az
// oldal saját PageHead-je adja. Így egy új route sem igényel táblabővítést.
test('a mélyoldalak a szekciójuk címkéjét öröklik', () => {
  expect(sectionFor('/train/mesocycles/42/week/hat')).toEqual({ label: 'Edzés', spot: 's-edzes' })
  expect(sectionFor('/fuel/recipes/12/edit')).toEqual({ label: 'Fuel', spot: 's-fuel' })
  expect(sectionFor('/nap/uzenetek')).toEqual({ label: 'Nap', spot: 's-reggel' })
  expect(sectionFor('/me/sleep')).toEqual({ label: 'Én', spot: 's-en' })
})

test('a query és a záró perjel nem zavarja', () => {
  expect(sectionFor('/nap/')).toEqual({ label: 'Nap', spot: 's-reggel' })
  expect(sectionFor('/train')).toEqual({ label: 'Edzés', spot: 's-edzes' })
})

// Honest state: ismeretlen szekcióra nem találgatunk címet.
test('ismeretlen prefix és a gyökér null-t ad', () => {
  expect(sectionFor('/')).toBeNull()
  expect(sectionFor('/ritual')).toBeNull()
  expect(sectionFor('/auth/login')).toBeNull()
  expect(sectionFor('')).toBeNull()
})

// A „train" prefix nem ragadhat rá egy hasonló nevű szekcióra.
test('a szegmens teljes egyezés, nem prefix-illesztés', () => {
  expect(sectionFor('/training')).toBeNull()
  expect(sectionFor('/napok')).toBeNull()
})
