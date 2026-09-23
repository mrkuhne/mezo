import { TEAM, characterForMetricDomain, characterForPersona } from './team'

test('mind az 5 posztoló karakter + a nem posztoló Szkeptikus létezik', () => {
  expect(Object.keys(TEAM)).toHaveLength(6)
  expect(TEAM.szkeptikus.postable).toBe(false)
  expect(Object.values(TEAM).filter(c => c.postable)).toHaveLength(5)
})

test('metrika-domén → gazda (spec §4: pontosan egy gazda)', () => {
  expect(characterForMetricDomain('sleep')).toBe('szunya')
  expect(characterForMetricDomain('train')).toBe('mocor')
  expect(characterForMetricDomain('fuel')).toBe('falat')
  expect(characterForMetricDomain('mind')).toBe('deru')
  expect(characterForMetricDomain('body')).toBe('deru') // mérések/egészségjelek → Közérzet
  expect(characterForMetricDomain('other')).toBe('mezo')
})

test('backend-persona → karakter beolvadás (spec §2.2)', () => {
  expect(characterForPersona('szomnologus')).toBe('szunya')
  expect(characterForPersona('edzo')).toBe('mocor')
  expect(characterForPersona('drill')).toBe('mocor')
  expect(characterForPersona('taplalkozo')).toBe('falat')
  expect(characterForPersona('pszichologus')).toBe('deru')
  expect(characterForPersona('doki')).toBe('deru')
  expect(characterForPersona('antropologus')).toBe('mezo')
  expect(characterForPersona('mezo')).toBe('mezo')
  expect(characterForPersona('szkeptikus')).toBe('szkeptikus')
  expect(characterForPersona('ismeretlen-uj-persona')).toBe('mezo') // biztonságos default
})

test('Mezo arany, a Szkeptikus palaszürke figurát visel (mezo-a9bo7.9)', () => {
  expect(TEAM.mezo.boop).toBe('gold')
  expect(TEAM.szkeptikus.boop).toBe('slate')
})
