import { describe, expect, test } from 'vitest'
import { challengeConfidenceLine, challengeTypeLabel, targetChips } from '@/features/train/logic/challengeDisplay'

describe('challengeDisplay (mezo-oy91i)', () => {
  test('targetChips splits on × and ·, and unit-labels the load and the reps', () => {
    expect(targetChips('107.5 kg × 8')).toEqual(['107,5 kg', '8 ism.'])
    expect(targetChips('+1 szet · 4×15-20')).toEqual(['+1 szet', '4×15-20'])
  })

  test('targetChips turns a depth sentence into the RIR value and where it applies', () => {
    expect(targetChips('Utolsó szet RIR 0-ig')).toEqual(['RIR 0', 'utolsó szett'])
    expect(targetChips('Az utolsó szet RIR 1-ig')).toEqual(['RIR 1', 'utolsó szett'])
  })

  test('challengeTypeLabel drops a leading emoji and speaks Hungarian', () => {
    expect(challengeTypeLabel('⚡ Túlterhelés')).toBe('Túlterhelés')
    expect(challengeTypeLabel('PR-attempt')).toBe('PR-kísérlet')
    expect(challengeTypeLabel('Mélység')).toBe('Mélység')
  })

  test('challengeConfidenceLine is one faint sentence, never a raw "conf" code', () => {
    expect(challengeConfidenceLine(0.72, 'mid')).toBe('72% biztos · közepes kockázat')
    expect(challengeConfidenceLine(null, 'low')).toBe('Még tanulom, mennyire biztos · alacsony kockázat')
    expect(challengeConfidenceLine(undefined, 'low')).toBe('Még tanulom, mennyire biztos · alacsony kockázat')
  })
})
