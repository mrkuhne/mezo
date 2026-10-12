import { afterEach, test, expect } from 'vitest'
import { setLang } from '@/shared/i18n'
import { formatImpact, impactPoints } from '@/features/fuel/logic/formatImpact'

afterEach(() => setLang('hu', { persist: false }))

test('the scorer shape is read as points on the hundred scale, one rounding', () => {
  expect(impactPoints('+0.04 score')).toBe(4)
  expect(impactPoints('−0.02 score')).toBe(-2)
  expect(impactPoints('-0.1 score')).toBe(-10)
  expect(impactPoints('+0,036 score')).toBe(4)
  expect(impactPoints('Mg-status 32% → 48%')).toBeNull()
})
test('the printed impact is the SAME points on the ten scale: "+0.04 score" → "+0,4", "-0.1 score" → "−1"', () => {
  expect(formatImpact('+0.04 score')).toBe('+0,4')
  expect(formatImpact('−0.02 score')).toBe('−0,2')
  expect(formatImpact('-0.1 score')).toBe('−1')
  // one number, one rounding (bible F4.8): the ten-scale text is always points / 10
  for (const raw of ['+0.04 score', '+0.036 score', '+0.125 score', '-0.2 score']) {
    const pts = impactPoints(raw)!
    expect(formatImpact(raw).replace('−', '-').replace('+', '').replace(',', '.')).toBe(String(pts / 10))
  }
})
test('English prints a decimal point', () => {
  setLang('en', { persist: false })
  expect(formatImpact('+0.04 score')).toBe('+0.4')
})
test('free text is passed through untouched', () => {
  expect(formatImpact('Mg-status 32% → 48%')).toBe('Mg-status 32% → 48%')
})
