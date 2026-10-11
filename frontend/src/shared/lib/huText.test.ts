import { describe, expect, it } from 'vitest'
import { article, azA, outOf, sentenceCase } from './huText'

describe('article — before a word', () => {
  it('is „az" before a vowel sound, „a" otherwise', () => {
    expect(article('alvás')).toBe('az')
    expect(article('Étkezés')).toBe('az')
    expect(article('üveg')).toBe('az')
    expect(article('guggolás')).toBe('a')
    expect(article('Hát')).toBe('a')
  })
  it('capitalises at the start of a sentence', () => {
    expect(article('Overhead Press', true)).toBe('Az')
    expect(article('Bench Press', true)).toBe('A')
  })
})

describe('azA — before a numeral, as read aloud', () => {
  it('follows the spoken number, not the digit', () => {
    expect([1, 5, 50, 52, 59, 500, 1000, 1500, 5000].map((n) => azA(n))).toEqual(Array(9).fill('az'))
    expect([2, 3, 4, 6, 7, 8, 9, 10, 11, 15, 19, 20, 40, 60, 100, 150, 10000].map((n) => azA(n))).toEqual(Array(17).fill('a'))
  })
  it('capitalises at the start of a sentence', () => {
    expect(azA(5, true)).toBe('Az')
    expect(azA(3, true)).toBe('A')
  })
})

describe('outOf — the elative suffix after a number', () => {
  it('units decide when there are any', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(outOf)).toEqual(
      ['1-ből', '2-ből', '3-ból', '4-ből', '5-ből', '6-ból', '7-ből', '8-ból', '9-ből'])
    expect([12, 13, 16, 23, 75, 96].map(outOf)).toEqual(['12-ből', '13-ból', '16-ból', '23-ból', '75-ből', '96-ból'])
  })
  it('round tens follow the word of the ten', () => {
    expect([10, 20, 30, 40, 50, 60, 70, 80, 90].map(outOf)).toEqual(
      ['10-ből', '20-ból', '30-ból', '40-ből', '50-ből', '60-ból', '70-ből', '80-ból', '90-ből'])
  })
  it('nulla, száz, ezer, millió', () => {
    expect([0, 100, 300, 1000, 2000, 1_000_000].map(outOf)).toEqual(['0-ból', '100-ból', '300-ból', '1000-ből', '2000-ből', '1000000-ból'])
  })
})

describe('sentenceCase', () => {
  it('lowers an all-caps wire label to a word', () => {
    expect(sentenceCase('FUTÁS')).toBe('Futás')
    expect(sentenceCase('ÖSSZESEN')).toBe('Összesen')
  })
  it('leaves mixed case and known acronyms alone', () => {
    expect(sentenceCase('Röplabda')).toBe('Röplabda')
    expect(sentenceCase('TRX')).toBe('TRX')
  })
})
