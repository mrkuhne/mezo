import { hu1, huArticle, huFrom, huInt } from '@/shared/lib/huNum'

test('formats one decimal with a comma', () => expect(hu1(78.6)).toBe('78,6'))
test('strips a trailing ,0 for whole numbers', () => expect(hu1(73)).toBe('73'))
test('rounds to one decimal', () => expect(hu1(5.649)).toBe('5,6'))

test('huInt groups thousands with a regular space', () => expect(huInt(1300)).toBe('1 300'))
test('huInt leaves sub-1000 values ungrouped', () => expect(huInt(420)).toBe('420'))
test('huInt uses the Unicode minus for negative values', () => expect(huInt(-1300)).toBe('−1 300'))
test('huInt rounds to the nearest integer', () => expect(huInt(1299.6)).toBe('1 300'))

test('huFrom follows the last read-aloud word', () => {
  expect(huFrom(32)).toBe('32-ből') // harminckettő
  expect(huFrom(30)).toBe('30-ból') // harminc
  expect(huFrom(7)).toBe('7-ből') // hét
  expect(huFrom(3)).toBe('3-ból') // három
  expect(huFrom(10)).toBe('10-ből') // tíz
  expect(huFrom(20)).toBe('20-ból') // húsz
  expect(huFrom(45)).toBe('45-ből') // negyvenöt
  expect(huFrom(100)).toBe('100-ból') // száz
  expect(huFrom(1000)).toBe('1000-ből') // ezer
  expect(huFrom(0)).toBe('0-ból') // nulla
})

test('huArticle follows the first read-aloud word', () => {
  expect(huArticle(32)).toBe('a')
  expect(huArticle(5)).toBe('az')
  expect(huArticle(1)).toBe('az')
  expect(huArticle(50)).toBe('az')
  expect(huArticle(15)).toBe('a') // tizenöt
  expect(huArticle(500)).toBe('az')
  expect(huArticle(1200)).toBe('az') // ezerkétszáz
  expect(huArticle(2000)).toBe('a') // kétezer
  expect(huArticle(5000)).toBe('az')
})

test('reads a four-digit count the way the admin map banner shows it', () => {
  expect(`${huArticle(1842)} ${huFrom(1842)}`).toBe('az 1842-ből') // ezernyolcszáznegyvenkettő
})

test('reads a four-digit count the way the admin map banner shows it', () => {
  expect(`${huArticle(1842)} ${huFrom(1842)}`).toBe('az 1842-ből') // ezernyolcszáznegyvenkettő
})
