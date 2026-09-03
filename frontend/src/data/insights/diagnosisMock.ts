import type { Diagnosis } from '@/data/types'

/**
 * The mock-mode demo diagnosis (mezo-hqfi). ONE row, deliberately shaped like a real answer:
 * ranked suspects, every claim bound to evidence by index, every suspect carrying a probe.
 * Numbers are demo values — real mode never renders this seed (the dual-mode guard).
 */
export const mockDiagnoses: Diagnosis[] = [
  {
    id: 'diag-demo-1',
    phenomenon: 'fatigue',
    windowDays: 14,
    verdict:
      'A fáradtságod legvalószínűbb oka az alvás megrövidülése — két hete napi bő egy órával kevesebbet alszol, és a terhelésed közben nem csökkent.',
    confidence: 'moderate',
    generatedAt: '2026-08-30T06:12:00Z',
    stale: false,
    evidence: [
      {
        kind: 'metric',
        label: 'alváshossz',
        detail: 'átlag 6.1 (bázis 7.3, eltérés -1.2) · 13 mért nap',
        sourceHu: 'Alvás-napló',
        metricKey: 'SLEEP_DURATION_H',
        value: 6.1,
        baselineValue: 7.3,
        delta: -1.2,
        coverageDays: 13,
      },
      {
        kind: 'metric',
        label: 'energia-szint',
        detail: 'átlag 4.2 (bázis 6.8, eltérés -2.6) · 12 mért nap',
        sourceHu: 'Check-in sheet',
        metricKey: 'CHECKIN_ENERGY',
        value: 4.2,
        baselineValue: 6.8,
        delta: -2.6,
        coverageDays: 12,
      },
      {
        kind: 'metric',
        label: 'akut:krónikus terhelés',
        detail: 'átlag 1.34 (bázis 1.02, eltérés +0.32) · 14 mért nap',
        sourceHu: 'származtatott: sport + gym terhelésből',
        metricKey: 'ACWR',
        value: 1.34,
        baselineValue: 1.02,
        delta: 0.32,
        coverageDays: 14,
      },
      {
        kind: 'pattern',
        label: 'Késői lefekvés ↔ másnapi energia',
        detail: 'Közepes erősségű negatív együttjárás.',
        sourceHu: 'Minták',
      },
    ],
    suspects: [
      {
        rank: 1,
        title: 'Alváshiány',
        claim:
          'Napi bő egy órával rövidebb alvás mellett a regenerációra jutó mélyalvás-idő csökken, ami közvetlenül a nappali energiaszintben jelentkezik.',
        evidenceIndexes: [0, 1, 3],
        strength: 'strong',
        probeText: 'Feküdj le hét estén át 23:00 előtt, és nézzük meg újra.',
        metricKey: 'SLEEP_DURATION_H',
        expectedDirection: 'up',
        totalDays: 7,
      },
      {
        rank: 2,
        title: 'Megugrott terhelés',
        claim:
          'Az akut terhelésed a krónikus átlagod fölé került, miközben az alvás nem nőtt vele — a kettő együtt halmozódó fáradtságot okoz.',
        evidenceIndexes: [2, 0],
        strength: 'moderate',
        probeText: 'Vegyél vissza egy hétre a heti volumenből nagyjából negyedet.',
        metricKey: 'ACWR',
        expectedDirection: 'down',
        totalDays: 7,
      },
    ],
  },
]
