import type { MemoryOverview, MemorySummaryItem } from '@/data/types'

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
