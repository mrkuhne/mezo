import { describe, expect, test } from 'vitest'
import { buildMezoMessages, partitionMezoThread, type MezoMessageItem } from '@/features/today/logic/mezoMessages'
import type { Briefing, FeedMessage } from '@/data/types'

const demoBriefing: Briefing = {
  eyebrow: 'Mezo · reggeli briefing · 06:30',
  body: [{ type: 'p', text: 'Jó reggelt.' }, { type: 'p', text: 'Ma Pull Day.' }],
  refs: [{ kind: 'workout', label: 'Push Day · tegnap' }],
  confidence: 0.88,
}

const morning: FeedMessage = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'morning',
  eyebrow: 'Reggeli briefing · Reta nap 3',
  body: [{ type: 'p', text: 'Jól aludtál.' }, { type: 'p', text: 'Ma Pull Day.' }],
  refs: [{ kind: 'Sleep', label: 'regeneráció' }],
  generatedAt: '2026-07-06T05:45:00Z',
}

const midday: FeedMessage = {
  id: '22222222-2222-4222-8222-222222222222',
  kind: 'midday',
  eyebrow: 'Déli jegyzet',
  body: [{ type: 'p', text: 'Fehérjéből 100 g van meg.' }],
  refs: [],
  generatedAt: '2026-07-06T12:00:00Z',
}

// W5.2 (mezo-b3pp.19) — config-text intervention kártya a companion-feedben.
const intervention: FeedMessage = {
  id: '33333333-3333-4333-8333-333333333333',
  kind: 'intervention',
  eyebrow: 'Mezo · észrevétel',
  body: [{ type: 'p', text: 'Két napja alszol keveset — ma korábban lefeküdhetnél.' }],
  refs: [],
  generatedAt: '2026-07-06T15:00:00Z',
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

  // mezo-b3pp.15 — a visszajelzés-chipek CSAK perzisztált artifactre ülhetnek. Az item `id`-je
  // marad a kind (React-kulcs + látott-üzenet kulcs); az artifact-azonosító külön mező.
  test('a feed-elem artifactId-ja a sor uuid-je, az id-je pedig továbbra is a kind', () => {
    const [m] = buildMezoMessages({ feed: [morning], demoBriefing: null })
    expect(m.id).toBe('morning')
    expect(m.artifactId).toBe('11111111-1111-4111-8111-111111111111')
  })

  // W5.2 (mezo-b3pp.19) — a sheet a `kind`-ot használja a „Segített?" kártya-változat kiválasztásához.
  test('az intervention feed-elem a kindjével ÉS az artifactId-jével fut végig', () => {
    const [m] = buildMezoMessages({ feed: [intervention], demoBriefing: null })
    expect(m.id).toBe('intervention')
    expect(m.kind).toBe('intervention')
    expect(m.artifactId).toBe('33333333-3333-4333-8333-333333333333')
  })

  test('egy sima feed-elemen (pl. morning) a kind ugyanaz, mint a feed sor kindje', () => {
    const [m] = buildMezoMessages({ feed: [morning], demoBriefing: null })
    expect(m.kind).toBe('morning')
  })

  test('a demo-briefing kártyán NINCS artifactId — nem perzisztált artifact (mezo-kr9v)', () => {
    const [demo] = buildMezoMessages({ feed: [midday], demoBriefing })
    expect(demo.id).toBe('briefing-demo')
    expect(demo.artifactId).toBeUndefined()
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

  // A nudge-fixture korábban a `needsNudges.toNudgeMessage()` gyárból jött; az a modul a
  // TodayPage-dzsel együtt kikerült (mezo-d20.9.1), a `nudges` PARAMÉTER viszont él
  // (NapHubPage/FuelMaiPage is átadhat sort), ezért a szerződés itt marad — a fixture most
  // a fenti literál, ami pontosan azt a shape-et adja, amit a gyár adott (artifactId nélkül).
  test('a nudge artifactId nélkül fut végig a szálon — nem perzisztált artifact (mezo-kr9v)', () => {
    const msgs = buildMezoMessages({ feed: [midday], demoBriefing, nudges: [nudge] })
    expect(msgs[msgs.length - 1].artifactId).toBeUndefined()
    // A szálban PONTOSAN egy elem votolható: a feed sora.
    expect(msgs.filter((m) => m.artifactId != null).map((m) => m.id)).toEqual(['midday'])
  })

  test('nudges elhagyva (paraméter nélkül) → a viselkedés változatlan', () => {
    expect(buildMezoMessages({ feed: [morning, midday], demoBriefing: null }))
      .toEqual(buildMezoMessages({ feed: [morning, midday], demoBriefing: null, nudges: undefined }))
  })

  test('üres nudges tömb → nem told be semmit', () => {
    const msgs = buildMezoMessages({ feed: [midday], demoBriefing: null, nudges: [] })
    expect(msgs.map((m) => m.id)).toEqual(['midday'])
  })

  // S4 (mezo-d58h.4) — az advice-kártya facts/suggestions tömbjei 1:1 futnak át a szál elemére.
  const advice: FeedMessage = {
    id: '44444444-4444-4444-8444-444444444444',
    kind: 'advice',
    eyebrow: 'Mezo · észrevétel',
    body: [{ type: 'p', text: 'Ma este feküdj le korábban.' }],
    refs: [],
    facts: ['Alvásadósság: 1,6 óra/éjszaka'],
    suggestions: ['Told előre a villanyoltást.'],
    generatedAt: '2026-07-06T15:00:00Z',
  }

  test('az advice feed-elem facts/suggestions tömbjei átfutnak a szál elemére', () => {
    const [m] = buildMezoMessages({ feed: [advice], demoBriefing: null })
    expect(m.kind).toBe('advice')
    expect(m.facts).toEqual(['Alvásadósság: 1,6 óra/éjszaka'])
    expect(m.suggestions).toEqual(['Told előre a villanyoltást.'])
  })
})

describe('partitionMezoThread (mezo-ho9k)', () => {
  const feedItem: MezoMessageItem = {
    id: 'morning', artifactId: 'fm-1', kind: 'morning', eyebrow: 'Reggeli briefing',
    time: '07:05', paragraphs: ['szöveg'], refs: [], meta: null,
  }
  const nudgeItem: MezoMessageItem = {
    id: 'nudge-hidratacio-2026-05-22T12:00:00.000Z', eyebrow: 'Életjel', time: '12:00',
    paragraphs: ['💧'], refs: [], meta: 'Életjel-figyelő', source: 'eletjel',
  }

  test('a source: eletjel elemek az eletjelek partícióba kerülnek, a többi az uzenetek-be', () => {
    const { uzenetek, eletjelek } = partitionMezoThread([feedItem, nudgeItem])
    expect(uzenetek).toEqual([feedItem])
    expect(eletjelek).toEqual([nudgeItem])
  })

  test('sorrendtartó mindkét partíción belül', () => {
    const n2 = { ...nudgeItem, id: 'nudge-mozgas-x' }
    const f2 = { ...feedItem, id: 'sleep' }
    const { uzenetek, eletjelek } = partitionMezoThread([feedItem, nudgeItem, f2, n2])
    expect(uzenetek.map((m) => m.id)).toEqual(['morning', 'sleep'])
    expect(eletjelek.map((m) => m.id)).toEqual([nudgeItem.id, 'nudge-mozgas-x'])
  })
})
