import type { PatternMonitorPair } from '@/data/types'
import { patternHeadline, patternPlainLine } from './patternCopy'

const pair = {
  key: 'ritual-closed~next-sleep-quality',
  title: 'Esti lezárás ↔ rákövetkező alvásminőség',
  questionHu: 'Jobban alszol, ha este lezárod a napot?',
  mechanismHu: 'Az esti lezárás lecsendesítheti az elalvást — jobb alvásminőség.',
  expectedDirection: 'positive',
  whenPositiveHu: 'a lezárt esték után {erősség} jobban aludtál',
  whenNegativeHu: 'a lezárt esték után {erősség} rosszabbul aludtál',
  r: null,
} as PatternMonitorPair

const STAT = 'Gyenge pozitív együttjárás a(z) esti lezárás és a(z) alvásminőség között (1 napos eltolással) az elmúlt 60 napban.'

describe('patternHeadline (mezo-0469: a kérdés, sosem a nyilas párcím)', () => {
  test('a pár kérdése a cím', () => {
    expect(patternHeadline(pair.title, pair)).toBe('Jobban alszol, ha este lezárod a napot?')
  })
  test('pár nélkül a nyilas címből kérdő mondat lesz, nyíl nélkül', () => {
    const h = patternHeadline('Ébredés ideje ↔ energia-szint')
    expect(h).toBe('Az ébredés ideje és az energia-szint együtt mozognak?')
    expect(h).not.toContain('↔')
  })
  test('nyíl nélküli cím változatlan', () => {
    expect(patternHeadline('Anna és az alvásod')).toBe('Anna és az alvásod')
  })
})

describe('patternPlainLine (a gépi statisztikai mondat sosem látszik)', () => {
  test('mért irány nélkül a pár miértje', () => {
    expect(patternPlainLine(STAT, pair)).toBe(pair.mechanismHu)
  })
  test('mért iránnyal a lelet mondata', () => {
    expect(patternPlainLine(STAT, { ...pair, r: 0.2 }))
      .toBe('Eddig ebbe az irányba mutatnak a napjaid: a lezárt esték után kicsit jobban aludtál.')
  })
  test('pár nélkül őszinte töltelék-mentes mondat', () => {
    expect(patternPlainLine(STAT)).toBe('Még gyűjtöm hozzá a napokat.')
  })
  test('az emberi (reflexiós) mechanizmus változatlanul megy tovább', () => {
    expect(patternPlainLine('Az Annás napok után hosszabb alvás jött ki.', pair))
      .toBe('Az Annás napok után hosszabb alvás jött ki.')
  })
})
