import { describe, expect, test } from 'vitest'
import { buildMezoMessages } from '@/features/today/logic/mezoMessages'
import type { Briefing, CompanionNote } from '@/data/types'

const briefing: Briefing = {
  eyebrow: 'Mezo · reggeli briefing · 06:30',
  body: [{ type: 'p', text: 'Jó reggelt.' }, { type: 'p', text: 'Ma Pull Day.' }],
  refs: [{ kind: 'workout', label: 'Push Day · tegnap' }],
  confidence: 0.88,
}
const note: CompanionNote = { window: '12:30', kind: 'nudge', text: 'Fehérjéből 100 g van meg.' }
const closing: CompanionNote = { window: '21:15', kind: 'closing', text: 'Szép nap volt.' }

describe('buildMezoMessages', () => {
  test('üres nap → üres tömb (honest absence)', () => {
    expect(buildMezoMessages({ briefing: null, note: null })).toEqual([])
  })

  test('csak briefing → egy üzenet, minden bekezdéssel és a refekkel', () => {
    const msgs = buildMezoMessages({ briefing, note: null })
    expect(msgs).toHaveLength(1)
    expect(msgs[0].id).toBe('briefing')
    expect(msgs[0].paragraphs).toEqual(['Jó reggelt.', 'Ma Pull Day.'])
    expect(msgs[0].refs).toHaveLength(1)
  })

  test('a briefing ideje az eyebrow-ból jön, a szöveg pedig magyar cím marad', () => {
    const [m] = buildMezoMessages({ briefing, note: null })
    expect(m.time).toBe('06:30')
    expect(m.eyebrow).toBe('Reggeli briefing')
  })

  test('idő nélküli eyebrow → null idő, de a saját eyebrow-szöveg marad', () => {
    const [m] = buildMezoMessages({ briefing: { ...briefing, eyebrow: 'Mezo · esti szó' }, note: null })
    expect(m.time).toBeNull()
    expect(m.eyebrow).toBe('Reggeli briefing')
  })

  test('real módban a fabrikált confidence helyett őszinte demo-címke', () => {
    expect(buildMezoMessages({ briefing, note: null })[0].meta).toBe('Confidence 88%')
    expect(buildMezoMessages({ briefing, note: null, briefingDemo: true })[0].meta).toBe('Demo tartalom')
  })

  test('a jegyzet kind-ja adja az eyebrow-t, a window az időt', () => {
    const [, m] = buildMezoMessages({ briefing, note })
    expect(m.eyebrow).toBe('Napközi jegyzet')
    expect(m.time).toBe('12:30')
    expect(buildMezoMessages({ briefing, note: closing })[1].eyebrow).toBe('Napzárás')
  })

  test('a sorrend kronologikus — a briefing elöl, a jegyzet mögötte', () => {
    expect(buildMezoMessages({ briefing, note }).map((m) => m.id)).toEqual(['briefing', 'note'])
  })

  test('csak jegyzet → egyetlen üzenet, briefing nélkül', () => {
    const msgs = buildMezoMessages({ briefing: null, note })
    expect(msgs.map((m) => m.id)).toEqual(['note'])
  })
})
