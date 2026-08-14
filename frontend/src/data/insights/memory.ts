import type { MemoryLlmUsage, MemoryOverview, MemorySummaryItem, SimilarDay } from '@/data/types'

/** A demo áttekintés (mezo-al1i) — a számok a napló-seeddel nagyságrendben konzisztensek. */
export const memoryOverview: MemoryOverview = {
  l0: { daysWithAnyData: 47, windowDays: 60 },
  l1: {
    summaryCount: 38,
    firstDate: '2026-07-01',
    lastDate: '2026-08-12',
    embeddings: { dailySummary: 38, chatTurn: 112 },
  },
  l2: {
    patterns: [
      { kind: 'statistical', status: 'proposed', count: 2 },
      { kind: 'statistical', status: 'confirmed', count: 3 },
      { kind: 'ai_hypothesis', status: 'monitoring', count: 1 },
    ],
    pendingFactCandidates: 2,
  },
  l3: {
    facts: [
      { source: 'chat', count: 9 },
      { source: 'pattern', count: 3 },
      { source: 'manual', count: 2 },
    ],
    totalReinforcements: 31,
    factsInPrompt: 12,
  },
  jobs: {
    summaryCron: '0 20 2 * * *',
    patternCron: '0 40 2 * * *',
    hypothesisCron: '0 0 3 * * SUN',
    lastSummaryDate: '2026-08-12',
    lastDetectedAt: '2026-08-13T00:40:00Z',
  },
}

/** Az L1 napló demo-bejegyzései — két hónapot fed, hogy a hónap-elválasztó látsszon. */
export const memorySummaries: MemorySummaryItem[] = [
  {
    date: '2026-08-12',
    narrative:
      'Erős pull-nap volt: a Chest Supported Row 3×8-ra ment 62,5 kg-mal, a válla nem szólt bele. ' +
      'Este 21:40-kor zárta a konyhát, a fehérje 168 g-on állt meg. Az alvás 7,4 óra lett, minőség 4/5.',
    embedded: true,
  },
  {
    date: '2026-08-11',
    narrative:
      'Röplabda-este kedden — 95 perc pályán, utána késői vacsora 21:55-kor. A reggeli check-in ' +
      'energiája 3/5 volt, a stressz alacsony. Vízbevitel 2,8 l.',
    embedded: true,
  },
  {
    date: '2026-08-09',
    narrative:
      'Pihenőnap volt, de a napzárás elmaradt. Rövidebb alvás (6,1 óra, 2/5) követte — a vasárnap ' +
      'esti mintázat megint kirajzolódott. Reta ciklusnap 6.',
    embedded: false,
  },
  {
    date: '2026-07-30',
    narrative:
      'Push-nap 8 900 kg összvolumennel, a bench 5 kg-os PR-kísérlete 1 ismétlésen elakadt. ' +
      'A kreatin + kollagén stack ment, a kcal 2 450-en zárt.',
    embedded: true,
  },
  {
    date: '2026-07-28',
    narrative:
      'Nehéz munkanap után 40 perces easy futás — a HR-recovery 52 s volt, jobb a szokásosnál. ' +
      'Az esti reflexió „részben" lett: a foci csak félig valósult meg.',
    embedded: true,
  },
  {
    date: '2026-07-21',
    narrative:
      'Deload-hét első napja. Korai lefekvés 22:10-kor, 8,1 óra alvás (5/5) — másnap a gym-workload ' +
      'is könnyebbnek érződött. A társ ezt a párost figyeli.',
    embedded: true,
  },
]

/** A kereső demo-találatai — determinisztikus, a query-től független (demo-világ). */
export const similarDaysSeed: SimilarDay[] = [
  {
    date: '2026-08-09',
    excerpt: 'Pihenőnap volt, de a napzárás elmaradt. Rövidebb alvás (6,1 óra, 2/5) követte…',
    similarity: 0.81,
    finalScore: 0.78,
  },
  {
    date: '2026-07-28',
    excerpt: 'Nehéz munkanap után 40 perces easy futás — a HR-recovery 52 s volt…',
    similarity: 0.64,
    finalScore: 0.54,
  },
  {
    date: '2026-07-21',
    excerpt: 'Deload-hét első napja. Korai lefekvés 22:10-kor, 8,1 óra alvás (5/5)…',
    similarity: 0.52,
    finalScore: 0.41,
  },
]

/** Az Audit demo LLM-forgalma — 7 nap; a totals a perDay pontos összege. */
export const memoryLlmUsage: MemoryLlmUsage = {
  enabled: true,
  perDay: [
    { date: '2026-08-06', calls: 9, inputTokens: 41200, outputTokens: 6300, costUsd: 0.021 },
    { date: '2026-08-07', calls: 4, inputTokens: 18400, outputTokens: 2900, costUsd: 0.009 },
    { date: '2026-08-08', calls: 12, inputTokens: 55600, outputTokens: 8800, costUsd: 0.028 },
    { date: '2026-08-09', calls: 7, inputTokens: 32800, outputTokens: 5100, costUsd: 0.016 },
    { date: '2026-08-10', calls: 3, inputTokens: 12100, outputTokens: 1800, costUsd: 0.006 },
    { date: '2026-08-11', calls: 11, inputTokens: 50900, outputTokens: 8200, costUsd: 0.026 },
    { date: '2026-08-12', calls: 8, inputTokens: 37300, outputTokens: 5600, costUsd: 0.019 },
  ],
  totals: { calls: 54, inputTokens: 248300, outputTokens: 38700, costUsd: 0.125 },
}
