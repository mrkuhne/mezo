import { describe, expect, test } from 'vitest'
import { buildMezoMessages, type MezoMessageItem } from '@/features/today/logic/mezoMessages'
import type { Briefing, FeedMessage } from '@/data/types'

const demoBriefing: Briefing = {
  eyebrow: 'Mezo · reggeli briefing · 06:30',
  body: [{ type: 'p', text: 'Jó reggelt.' }, { type: 'p', text: 'Ma Pull Day.' }],
  refs: [{ kind: 'workout', label: 'Push Day · tegnap' }],
  confidence: 0.88,
}

const morning: FeedMessage = {
  kind: 'morning',
  eyebrow: 'Reggeli briefing · Reta nap 3',
  body: [{ type: 'p', text: 'Jól aludtál.' }, { type: 'p', text: 'Ma Pull Day.' }],
  refs: [{ kind: 'Sleep', label: 'regeneráció' }],
  generatedAt: '2026-07-06T05:45:00Z',
}

const midday: FeedMessage = {
  kind: 'midday',
  eyebrow: 'Déli jegyzet',
  body: [{ type: 'p', text: 'Fehérjéből 100 g van meg.' }],
  refs: [],
  generatedAt: '2026-07-06T12:00:00Z',
}

describe('buildMezoMessages', () => {
  test('üres feed, nincs demo → üres tömb (honest absence)', () => {
    expect(buildMezoMessages({ feed: [], demoBriefing: null })).toEqual([])
  })

  test('a feed elemei 1:1 alakulnak MezoMessageItem-mé', () => {
    const [m] = buildMezoMessages({ feed: [morning], demoBriefing: null })
    expect(m.id).toBe('morning')
    expect(m.eyebrow).toBe('Reggeli briefing · Reta nap 3')
    expect(m.paragraphs).toEqual(['Jól aludtál.', 'Ma Pull Day.'])
    expect(m.refs).toEqual([{ kind: 'Sleep', label: 'regeneráció' }])
    expect(m.meta).toBeNull()
  })

  test('a time a generatedAt-ból jön, HH:mm formátumban', () => {
    const [m] = buildMezoMessages({ feed: [morning], demoBriefing: null })
    expect(m.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
  })

  test('a sorrend a feed sorrendje', () => {
    expect(buildMezoMessages({ feed: [morning, midday], demoBriefing: null }).map((m) => m.id))
      .toEqual(['morning', 'midday'])
  })

  test('nincs morning kind a feedben, de van demo → a demo elöl, „Demo tartalom" jelzéssel', () => {
    const msgs = buildMezoMessages({ feed: [midday], demoBriefing })
    expect(msgs.map((m) => m.id)).toEqual(['briefing-demo', 'midday'])
    expect(msgs[0].eyebrow).toBe('Reggeli briefing')
    expect(msgs[0].meta).toBe('Demo tartalom')
    expect(msgs[0].paragraphs).toEqual(['Jó reggelt.', 'Ma Pull Day.'])
    expect(msgs[0].refs).toEqual([{ kind: 'workout', label: 'Push Day · tegnap' }])
    expect(msgs[0].time).toBe('06:30')
  })

  test('van morning kind a feedben → nincs demo prepend, még ha van is demoBriefing', () => {
    const msgs = buildMezoMessages({ feed: [morning], demoBriefing })
    expect(msgs.map((m) => m.id)).toEqual(['morning'])
  })

  test('nincs demoBriefing → nincs prepend, még ha nincs is morning kind', () => {
    const msgs = buildMezoMessages({ feed: [midday], demoBriefing: null })
    expect(msgs.map((m) => m.id)).toEqual(['midday'])
  })

  test('üres feed + van demo → egyetlen demo-üzenet', () => {
    const msgs = buildMezoMessages({ feed: [], demoBriefing })
    expect(msgs.map((m) => m.id)).toEqual(['briefing-demo'])
  })

  // mezo-dhzk Task 5 — küszöb-nudge-ok a szál VÉGÉN.
  const nudge: MezoMessageItem = {
    id: 'nudge-hidratacio-2026-07-06T15:00:00.000Z',
    eyebrow: 'Életjel', time: '15:00',
    paragraphs: ['💧 Ma még alig ittál.'], refs: [], meta: 'Életjel-figyelő',
  }

  test('nudges: a feed ÉS a demo-előtag UTÁN, a szál VÉGÉRE fűződnek', () => {
    const msgs = buildMezoMessages({ feed: [midday], demoBriefing, nudges: [nudge] })
    expect(msgs.map((m) => m.id)).toEqual(['briefing-demo', 'midday', 'nudge-hidratacio-2026-07-06T15:00:00.000Z'])
  })

  test('nudges elhagyva (paraméter nélkül) → a viselkedés változatlan', () => {
    expect(buildMezoMessages({ feed: [morning, midday], demoBriefing: null }))
      .toEqual(buildMezoMessages({ feed: [morning, midday], demoBriefing: null, nudges: undefined }))
  })

  test('üres nudges tömb → nem told be semmit', () => {
    const msgs = buildMezoMessages({ feed: [midday], demoBriefing: null, nudges: [] })
    expect(msgs.map((m) => m.id)).toEqual(['midday'])
  })
})
