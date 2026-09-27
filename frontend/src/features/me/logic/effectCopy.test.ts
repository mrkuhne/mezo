import { describe, expect, it } from 'vitest'
import {
  METRIC_COPY, personEffectSentence, eventEffectSentence, formatMeanDiff, effectEvidenceLine,
} from '@/features/me/logic/effectCopy'
import type { PersonEffect } from '@/data/types'

describe('effectCopy', () => {
  it('the three metric sentences for higher/lower, exactly as today', () => {
    expect(METRIC_COPY.mental).toEqual({ higher: 'jobb a hangulatod', lower: 'nyomottabb a hangulatod' })
    expect(METRIC_COPY.energy).toEqual({ higher: 'több az energiád', lower: 'kevesebb az energiád' })
    expect(METRIC_COPY.stress).toEqual({ higher: 'feszültebb vagy', lower: 'nyugodtabb vagy' })
  })

  it('personEffectSentence', () => {
    const e: PersonEffect = { metric: 'mental', direction: 'higher', strength: 'enyhe', confidence: 'gyenge', meanDiff: 0.5, subjectDays: 11 }
    expect(personEffectSentence('Anya', e)).toBe('Úgy tűnik, azokon a napokon, amikor Anya szóba kerül, jobb a hangulatod.')
  })

  it('eventEffectSentence', () => {
    const e: PersonEffect = { metric: 'stress', direction: 'lower', strength: 'kozepes', confidence: 'kozepes', meanDiff: 0.4, subjectDays: 9 }
    expect(eventEffectSentence('edzes', e)).toBe('Úgy tűnik, az edzésnapokon nyugodtabb vagy.')
  })

  it('formatMeanDiff — today\'s toFixed(1) rounding', () => {
    expect(formatMeanDiff(-0.55)).toBe('0,6')
  })

  it('effectEvidenceLine', () => {
    const e: PersonEffect = { metric: 'energy', direction: 'higher', strength: 'enyhe', confidence: 'gyenge', meanDiff: 0.5, subjectDays: 11 }
    expect(effectEvidenceLine(e)).toBe('11 nap alapján · átlagosan ~0,5 ponttal')
  })
})
