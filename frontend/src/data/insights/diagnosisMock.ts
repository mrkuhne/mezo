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
  {
    id: 'diag-demo-weight',
    phenomenon: 'weight',
    windowDays: 7,
    anchorStart: '2026-08-31',
    verdict:
      'A heti −0,7 kg nagyobb része víz és glikogén, nem zsír — a sós, magas szénhidrátú napok tartották magasan a vízszintet, a valódi zsírvesztés a cél-sávon belül van.',
    confidence: 'moderate',
    generatedAt: '2026-09-06T07:00:00Z',
    stale: false,
    evidence: [
      {
        kind: 'derived',
        label: 'valódi delta',
        detail: 'heti átlag 82,4 · előző hét 83,1 · trend Δ -0,7 kg/hét',
        sourceHu: 'számvetés',
      },
      {
        kind: 'derived',
        label: 'szövet-plafon',
        detail: 'többlet ≈ -3900 kcal → max 0,51 kg zsír (7700 kcal/kg) · a delta többi része víz/glikogén/tartalom',
        sourceHu: 'számvetés',
      },
      {
        kind: 'derived',
        label: 'cél-sáv',
        detail: 'terven (sáv: -1,0 – -0,25 %/hét) · cél: -0,5 %/hét',
        sourceHu: 'számvetés',
      },
      {
        kind: 'derived',
        label: 'erő-trend',
        detail: 'top-gyakorlatok e1RM Δ +1,8% → glikogén/izom-sztori',
        sourceHu: 'számvetés',
      },
      {
        kind: 'metric',
        label: 'súly-delta',
        detail: 'átlag -0.7 (bázis 0, eltérés -0.7) · 5 mért nap',
        sourceHu: 'Súly-napló',
        metricKey: 'WEIGHT_DELTA_KG',
        value: -0.7,
        baselineValue: 0,
        delta: -0.7,
        coverageDays: 5,
      },
      {
        kind: 'metric',
        label: 'nátrium',
        detail: 'átlag 4.2 (bázis 2.8, eltérés +1.4) · 6 mért nap',
        sourceHu: 'Fuel-napló',
        metricKey: 'DAILY_SALT_G',
        value: 4.2,
        baselineValue: 2.8,
        delta: 1.4,
        coverageDays: 6,
      },
    ],
    suspects: [
      {
        rank: 1,
        title: 'Vízvisszatartás — só és szénhidrát',
        claim:
          'A heti delta zöme a szövet-plafon alatt marad, miközben a nátrium-bevitel a bázis fölé ugrott — ez vízvisszatartást magyaráz, nem zsírvesztést.',
        evidenceIndexes: [1, 5],
        strength: 'strong',
        probeText: 'Tartsd a nátriumot a bázis közelében egy héten át, és nézzük meg újra a delta összetételét.',
        metricKey: 'DAILY_SALT_G',
        expectedDirection: 'down',
        totalDays: 7,
      },
      {
        rank: 2,
        title: 'A valódi zsírvesztés terven van',
        claim:
          'A cél-sáv szerint a héten terven belül haladtál — a heti delta nagy szórása csak a víz-részt torzítja, a szövet-oldal stabil.',
        evidenceIndexes: [2, 4],
        strength: 'moderate',
        probeText: 'Folytasd változatlanul még egy hétig, és vesd össze a két hét trend-deltáját.',
        metricKey: 'WEIGHT_TREND_PCT_WK',
        expectedDirection: 'down',
        totalDays: 14,
      },
    ],
  },
]
