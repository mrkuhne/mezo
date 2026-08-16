import type {
  Pattern,
  PatternCategory,
  PatternImpact,
  PatternMonitor,
  PatternPairDetail,
  Prediction,
  Experiment,
  WeeklyReview,
  WeeklyGrowth,
  Memoir,
} from '@/data/types'

export const MIN_PATTERN_CONFIDENCE = 0.65

/** A döntés-inbox erősség-küszöbe (spec 2026-08-14): |r| >= minAbsR ÉS p <= maxP — az
 *  "ígéretes jel" határa (confidenceMeta). Alatta a lelet "nincs összefüggés" — eredmény,
 *  nem döntés-kérés. */
export const STRONG_SIGNAL = { minAbsR: 0.3, maxP: 0.15 }

export function patternCategoryColor(cat: PatternCategory): string {
  return `var(--cat-${cat})`
}

export const patterns: Pattern[] = [
  {
    id: 'p1',
    pairKey: 'sport-load~next-sleep-quality',
    category: 'physiology',
    categoryLabel: 'Fiziológia',
    confidence: 0.85,
    title: 'Magas sportterhelés → rákövetkező éjjel mélyebb alvás',
    mechanism:
      'A 90 perc feletti sportterhelésű napok után az alvásminőség érezhetően jobb. A nézőpontunk: ezeken az éjszakákon az alvás-score 84% körül van (átlag: 71%).',
    evidence: ['12 terhelt nap óta', '9 éjszaka megerősítve', '0.85 statisztikai stabilitás'],
    critique: { statistical: 0.85, confounders: 0.72, l3align: 0.91, actionability: 0.88 },
    thinking:
      'Megfigyelés: D2-D3 napokon a meal-count 3-ról 2-re csökken, és ez nem a tudatos döntés következménye, hanem az éhségérzet eltűnése. Hipotézis: a pacing-alert push T-2h-val az edzés előtt fix kell maradjon ezeken a napokon — különben az under-fueling kockázat magas.',
    // mezo-tk88.4: the dashboard's "✓ Megerősítve" lifecycle bucket needs ≥1 already-judged mock
    // row to render in the demo — this is the strongest-evidence seed, so it reads as the one
    // that's already been through the L2 decision.
    status: 'confirmed',
  },
  {
    id: 'p2',
    pairKey: 'late-meal~next-sleep-quality',
    category: 'trigger',
    categoryLabel: 'Trigger',
    confidence: 0.78,
    title: 'Késő szénhidrát (>20:00 · >60g) → másnap reggeli RPE +1',
    mechanism:
      'Késői szénhidrát-bevitel csökkenti az első deep sleep ciklus minőségét. Másnap reggeli RPE-emelkedés a Pull Day-eknél mérhető.',
    evidence: ['8/11 megfigyelés', 'Sleep-quality < 7 átlag', 'PR-attempt failure 3/4'],
    critique: { statistical: 0.78, confounders: 0.65, l3align: 0.82, actionability: 0.95 },
    thinking:
      'Az este 20:30 utáni szénhidrát-bevitel és a másnap reggeli RPE között robosztus a korreláció. A confounder: tegnap volt-e volleyball (extra glikogén-merítés ezt módosíthatja).',
  },
  {
    id: 'p3',
    pairKey: 'hyp-3fa1c2d9',
    category: 'response',
    categoryLabel: 'Response',
    confidence: 0.69,
    title: 'Caffeine 14:00 utáni dózis → sleep onset +24 perc',
    mechanism: 'A 14:00 utáni koffein (>40mg) átlagosan 24 perccel kitolja az alvás kezdetét.',
    evidence: ['7 nap mérve', 'Stabil pattern, alacsony variancia'],
    critique: { statistical: 0.69, confounders: 0.78, l3align: 0.74, actionability: 0.91 },
  },
]

export const recentlyConfirmed: string[] = [
  'Hét 18: Pre-workout 2-3h whey + carb',
  'Hét 17: Volleyball nap → kevesebb gym set',
  'Hét 16: Magnézium 21:00 előtt',
]

export const weekly: WeeklyReview = {
  title: 'Hét 21 áttekintés · Máj 18-24',
  score: 82,
  delta: 4,
  items: [
    { label: 'Edzés volumen', value: '16 set fölött', trend: 'up' },
    { label: 'Alvás átlag', value: '7.2h', trend: 'flat' },
    { label: 'Kcal pacing', value: '94% target', trend: 'up' },
    { label: 'Niggle-mentes napok', value: '5/7', trend: 'down' },
  ],
}

export const growthWeek: WeeklyGrowth = {
  weekStart: '2026-05-18',
  questCompleted: 9,
  questClosed: 14,
  lifeXp: 120,
  activities: 6,
  savingsHuf: 50000,
}

export const weeklySuggestion =
  'Hét 22: tartsd ezt a Pull/Push váltogatást. A volleyball után visszamentünk 7.2h-ra — vasárnap próbáljunk 8h+-ot.'

export const memoir: Memoir = {
  week: 'Hét 20 · 2026 · Máj 11-17',
  title: 'Egy hét amikor a tested megtanult várni',
  body: 'Ezen a héten történt valami amit én is csak utólag láttam: nem siettetted a vasárnap esti reggelet hétfő helyett. Március óta a hétfő reggeleken mindig hajtottad magad, mintha pótolnod kéne valamit — most leültél, és a porridge mellett még megnézted a tegnapi PR-videót. Ez nem semmi. A Chest Row 105.8-on dolgozunk hat hete, és úgy érzem hogy ezen a héten téged is megnyugtatott. Csütörtökön (Pull Day) a 102.5 × 9 @ RIR 2 olyan tisztán ment, hogy elgondolkodtam: jövő héten 105 × 8-re menjünk? Erről beszéljünk pénteken.',
  anchors: [
    { kind: 'PR', label: 'Chest Row 102.5 × 9' },
    { kind: 'Medication', label: 'D1 reggel · pihenve' },
    { kind: 'Identity', label: 'Peak performance · life' },
  ],
}

export const anniversaryNote =
  'Egy hónapja kezdtük tudatosan korábbra tolni a vacsorát. Akkor még tipikus volt az este 22:00-s vacsora — most a hét 5 napján 21:30 előtt tudunk csukni a konyhában. Ez nem semmi.'

export const predictions: Prediction[] = [
  {
    id: 'pred1',
    title: 'Csütörtök Pull Day · Chest Row PR (107.5 × 8)',
    confidence: 0.72,
    status: 'pending',
    date: 'Máj 22',
    basis:
      'Március óta a 102.5 stabil. Múlt heti RIR 2 + 7.5h alvás kombináció historikusan +5kg-os emelést támogatott.',
  },
  {
    id: 'pred2',
    title: 'Hét 21 testsúly · 78.4 ±0.3 kg',
    confidence: 0.81,
    status: 'pending',
    date: 'Máj 26',
    basis: 'Hét 20 átlag 78.6kg. Hét közepén jellemzően alacsonyabb intake. 7-day MA trend.',
  },
  {
    id: 'pred3',
    title: 'Péntek reggeli RPE > 7.5 ha vacsora < 21:30',
    confidence: 0.69,
    status: 'validated',
    date: 'Máj 16',
    actual: 'RPE 8.2 · vacsora 20:50',
  },
  {
    id: 'pred4',
    title: 'Vasárnap volleyball RPE 6.5-7.0',
    confidence: 0.74,
    status: 'validated',
    date: 'Máj 17',
    actual: 'RPE 6.8',
  },
]

export const experiments: Experiment[] = [
  {
    id: 'exp1',
    title: 'Glikogén-feltöltés volleyball előtt',
    status: 'active',
    day: 4,
    total: 7,
    hypothesis: 'Pre-volleyball 80g szénhidrát 2h-val korábban → vertikális ugrás stabilabb a 4. setre.',
  },
  {
    id: 'exp2',
    title: 'Magnézium dose timing: 21:00 vs 19:00',
    status: 'completed',
    day: 14,
    total: 14,
    hypothesis: '21:00-s adagolás → deep sleep első órája tisztább.',
    outcome: 'Megerősítve · 3/4 mérés',
    outcomeGood: true,
  },
]

/** A monitor demo-pillanatképe (mezo-viqs) — a 8 katalógus-páron 4 verdikt látszik (live, few_days, no_data, degenerate). */
export const patternMonitor: PatternMonitor = {
  windowFrom: '2026-06-13',
  windowTo: '2026-08-10',
  lookbackDays: 60,
  minN: 8,
  cron: '0 40 2 * * *',
  lastRunAt: '2026-08-11T00:40:00Z',
  pairs: [
    {
      key: 'sleep-quality~next-day-training-rpe',
      title: 'Alvásminőség ↔ másnapi edzés-RPE',
      category: 'physiology', categoryLabel: 'Fiziológia', lagDays: 1,
      metricAKey: 'sleep-quality', metricALabel: 'alvásminőség',
      metricBKey: 'training-rpe', metricBLabel: 'edzés-RPE',
      mechanismHu: 'A rosszabb alvás másnap nehezebbnek érződő edzést hozhat.',
      questionHu: 'Könnyebb az edzés, ha jól aludtál?', expectedDirection: 'negative',
      whenPositiveHu: 'a jobb alvás után {erősség} nehezebbnek érződött az edzés',
      whenNegativeHu: 'a jobb alvás után {erősség} könnyebbnek érződött az edzés',
      metricADomain: 'sleep', metricBDomain: 'train',
      verdict: 'live', alignedDays: 21, missingDays: null, bottleneckMetricKey: null,
      r: -0.42, n: 21, p: 0.058, status: null,
    },
    {
      key: 'checkin-stress~sleep-quality',
      title: 'Stressz-szint ↔ aznapi alvásminőség',
      category: 'trigger', categoryLabel: 'Trigger', lagDays: 0,
      metricAKey: 'checkin-stress', metricALabel: 'stressz-szint',
      metricBKey: 'sleep-quality', metricBLabel: 'alvásminőség',
      mechanismHu: 'A stresszes nap ronthatja az aznapi alvásminőséget.',
      questionHu: 'Elrontja az alvásod a stresszes nap?', expectedDirection: 'negative',
      whenPositiveHu: 'a stresszesebb napokon {erősség} jobban aludtál',
      whenNegativeHu: 'a stresszesebb napokon {erősség} rosszabbul aludtál',
      metricADomain: 'mind', metricBDomain: 'sleep',
      verdict: 'live', alignedDays: 34, missingDays: null, bottleneckMetricKey: null,
      r: -0.61, n: 34, p: 0.001, status: null,
    },
    {
      key: 'sleep-duration~next-day-training-rpe',
      title: 'Alváshossz ↔ másnapi edzés-RPE',
      category: 'physiology', categoryLabel: 'Fiziológia', lagDays: 1,
      metricAKey: 'sleep-duration-h', metricALabel: 'alváshossz',
      metricBKey: 'training-rpe', metricBLabel: 'edzés-RPE',
      mechanismHu: 'A rövidebb alvás másnap magasabb erőkifejtés-érzetet hozhat.',
      questionHu: 'Könnyebb az edzés hosszabb alvás után?', expectedDirection: 'negative',
      whenPositiveHu: 'a hosszabb alvás után {erősség} nehezebbnek érződött az edzés',
      whenNegativeHu: 'a hosszabb alvás után {erősség} könnyebbnek érződött az edzés',
      metricADomain: 'sleep', metricBDomain: 'train',
      verdict: 'few_days', alignedDays: 6, missingDays: 2, bottleneckMetricKey: 'training-rpe',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'late-meal~next-sleep-quality',
      title: 'Késői étkezés ↔ rákövetkező alvásminőség',
      category: 'trigger', categoryLabel: 'Trigger', lagDays: 1,
      metricAKey: 'late-meal-hour', metricALabel: 'utolsó étkezés ideje',
      metricBKey: 'sleep-quality', metricBLabel: 'alvásminőség',
      mechanismHu: 'A késői étkezés ronthatja a rákövetkező éjszaka minőségét.',
      questionHu: 'Rosszabbul alszol, ha későn eszel?', expectedDirection: 'negative',
      whenPositiveHu: 'a későbbi vacsorák után {erősség} jobban aludtál',
      whenNegativeHu: 'a későbbi vacsorák után {erősség} rosszabbul aludtál',
      metricADomain: 'fuel', metricBDomain: 'sleep',
      verdict: 'few_days', alignedDays: 7, missingDays: 1, bottleneckMetricKey: 'late-meal-hour',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'daily-kcal~next-morning-weight-delta',
      title: 'Napi kalória ↔ másnap reggeli súlyváltozás',
      category: 'response', categoryLabel: 'Response', lagDays: 1,
      metricAKey: 'daily-kcal', metricALabel: 'napi kalória',
      metricBKey: 'weight-delta-kg', metricBLabel: 'reggeli súlyváltozás',
      mechanismHu: 'A napi bevitel a másnap reggeli súlyban csapódhat le.',
      questionHu: 'Meglátszik a napi kalória a reggeli súlyon?', expectedDirection: 'positive',
      whenPositiveHu: 'a nagyobb kalóriájú napok után {erősség} nagyobb volt a reggeli súlyugrás',
      whenNegativeHu: 'a nagyobb kalóriájú napok után {erősség} kisebb volt a reggeli súly',
      metricADomain: 'fuel', metricBDomain: 'body',
      verdict: 'few_days', alignedDays: 3, missingDays: 5, bottleneckMetricKey: 'weight-delta-kg',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'sport-load~next-day-gym-volume',
      title: 'Sportterhelés ↔ másnapi gym-volumen',
      category: 'response', categoryLabel: 'Response', lagDays: 1,
      metricAKey: 'sport-load-min', metricALabel: 'sportterhelés',
      metricBKey: 'gym-volume-kg', metricBLabel: 'gym-volumen',
      mechanismHu: 'A sportterhelés másnapra elvehet a gym-teljesítményből.',
      questionHu: 'Elveszi a sport a másnapi gym-erőt?', expectedDirection: 'negative',
      whenPositiveHu: 'a sportosabb napok után {erősség} nagyobb volument toltál',
      whenNegativeHu: 'a sportosabb napok után {erősség} kisebb volument toltál',
      metricADomain: 'train', metricBDomain: 'train',
      verdict: 'no_data', alignedDays: 0, missingDays: null, bottleneckMetricKey: 'sport-load-min',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'daily-water~checkin-energy',
      title: 'Vízbevitel ↔ energia-szint',
      category: 'physiology', categoryLabel: 'Fiziológia', lagDays: 0,
      metricAKey: 'daily-water-ml', metricALabel: 'vízbevitel',
      metricBKey: 'checkin-energy', metricBLabel: 'energia-szint',
      mechanismHu: 'A hidratáltság az energia-szintben érződhet.',
      questionHu: 'Több energiád van, ha többet iszol?', expectedDirection: 'positive',
      whenPositiveHu: 'a jól hidratált napokon {erősség} több energiád volt',
      whenNegativeHu: 'a jól hidratált napokon {erősség} kevesebb energiád volt',
      metricADomain: 'fuel', metricBDomain: 'mind',
      verdict: 'degenerate', alignedDays: 19, missingDays: null, bottleneckMetricKey: 'daily-water-ml',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'medication-cycle-day~daily-kcal',
      title: 'Gyógyszer-ciklusnap ↔ napi kalória',
      category: 'physiology', categoryLabel: 'Fiziológia', lagDays: 0,
      metricAKey: 'medication-cycle-day', metricALabel: 'Gyógyszer-ciklusnap',
      metricBKey: 'daily-kcal', metricBLabel: 'napi kalória',
      mechanismHu: 'A ciklus fázisa befolyásolhatja az étvágyat és a bevitelt.',
      questionHu: 'A ciklus vége felé nő az étvágyad?', expectedDirection: 'positive',
      whenPositiveHu: 'a ciklus későbbi napjain {erősség} többet ettél',
      whenNegativeHu: 'a ciklus későbbi napjain {erősség} kevesebbet ettél',
      metricADomain: 'fuel', metricBDomain: 'fuel',
      verdict: 'no_data', alignedDays: 0, missingDays: null, bottleneckMetricKey: 'medication-cycle-day',
      r: null, n: null, p: null, status: null,
    },
  ],
  // Deliberately NOT ascending by coveredDays (a wire response carries no ordering guarantee) —
  // this is what makes the PatternsPage.test.tsx Adat-egészség "orders thinnest-first" assertion
  // actually prove the page's own sort, rather than passing on an already-sorted fixture.
  metrics: [
    { key: 'sleep-quality', label: 'alvásminőség', sourceHu: 'Alvás-napló', domain: 'sleep', coveredDays: 58, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 3 },
    { key: 'training-rpe', label: 'edzés-RPE', sourceHu: 'Sport- és futás-napló (RPE)', domain: 'train', coveredDays: 12, windowDays: 60, lastDayWithData: '2026-08-09', pairCount: 2 },
    { key: 'medication-cycle-day', label: 'Gyógyszer-ciklusnap', sourceHu: 'Gyógyszer-napló', domain: 'fuel', coveredDays: 0, windowDays: 60, lastDayWithData: null, pairCount: 1 },
    { key: 'sport-load-min', label: 'sportterhelés', sourceHu: 'Sport-napló (perc)', domain: 'train', coveredDays: 0, windowDays: 60, lastDayWithData: null, pairCount: 1 },
    { key: 'checkin-stress', label: 'stressz-szint', sourceHu: 'Check-in sheet', domain: 'mind', coveredDays: 34, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'late-meal-hour', label: 'utolsó étkezés ideje', sourceHu: 'Étkezés-napló (utolsó étkezés)', domain: 'fuel', coveredDays: 16, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'daily-kcal', label: 'napi kalória', sourceHu: 'Étkezés-napló', domain: 'fuel', coveredDays: 27, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 2 },
    { key: 'gym-volume-kg', label: 'gym-volumen', sourceHu: 'Workout szettek (súly×ism.)', domain: 'train', coveredDays: 4, windowDays: 60, lastDayWithData: '2026-07-02', pairCount: 1 },
    { key: 'checkin-energy', label: 'energia-szint', sourceHu: 'Check-in sheet', domain: 'mind', coveredDays: 34, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'sleep-duration-h', label: 'alváshossz', sourceHu: 'Alvás-napló', domain: 'sleep', coveredDays: 22, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'weight-delta-kg', label: 'reggeli súlyváltozás', sourceHu: 'Reggeli mérlegelés', domain: 'body', coveredDays: 9, windowDays: 60, lastDayWithData: '2026-08-06', pairCount: 1 },
    { key: 'daily-water-ml', label: 'vízbevitel', sourceHu: 'Víz-számláló', domain: 'fuel', coveredDays: 19, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
  ],
}

// --- Pattern pair detail (mezo-tk88.5) — mockPatternPairDetail(pairKey) ---

/** A kirakat-pár kulcsa — megerősített, teljes történettel rendelkező sor a `patternMonitor.pairs`-ban
 *  (spec-mockup screen 2 alapja, iránya a valós katalógus-pár szerint: alvásminőség → másnapi RPE). */
const SHOWCASE_PAIR_KEY = 'sleep-quality~next-day-training-rpe'

const EMPTY_IMPACT: PatternImpact = { fact: null, predictions: [], experiments: [], challenges: [] }

/** Kézzel írt kirakat-detail (spec-mockup a forrás): 5 snapshot a jel erősödéséről
 *  (r -0.18 → -0.58, jún 3 → aug 13), megerősítve + promotálva júl 12-én, kétszer
 *  megerősödve (júl 30 ×2, aug 13 ×4), ~24 illesztett nap negatív trenden. */
const showcaseDetail: PatternPairDetail = {
  pair: patternMonitor.pairs.find((p) => p.key === SHOWCASE_PAIR_KEY)!,
  pattern: {
    id: 'pattern-showcase-1',
    pairKey: SHOWCASE_PAIR_KEY,
    category: 'physiology',
    categoryLabel: 'Fiziológia',
    title: 'Alvásminőség ↔ másnapi edzés-RPE',
    mechanism: 'A rosszabb alvás másnap nehezebbnek érződő edzést hozhat.',
    evidence: ['32 közös nap', 'r=-0.58', 'p=0.001'],
    status: 'confirmed',
    kind: 'statistical',
  },
  events: [
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14, p: 0.52 },
    { kind: 'snapshot', occurredAt: '2026-06-24T02:40:00Z', r: -0.31, n: 18, p: 0.19 },
    { kind: 'snapshot', occurredAt: '2026-07-12T02:40:00Z', r: -0.42, n: 21, p: 0.058 },
    { kind: 'confirmed', occurredAt: '2026-07-12T09:15:00Z' },
    { kind: 'promoted', occurredAt: '2026-07-12T09:15:05Z', factId: 'fact-showcase-1' },
    { kind: 'snapshot', occurredAt: '2026-07-30T02:40:00Z', r: -0.51, n: 27, p: 0.008 },
    { kind: 'reinforced', occurredAt: '2026-07-30T02:40:01Z', reinforcementCount: 2 },
    { kind: 'snapshot', occurredAt: '2026-08-13T02:40:00Z', r: -0.58, n: 32, p: 0.001 },
    { kind: 'reinforced', occurredAt: '2026-08-13T02:40:01Z', reinforcementCount: 4 },
  ],
  // 24 illesztett nap (júl 21 – aug 13) — a és b enyhén zajos, de összességében negatív trenden
  // (magasabb alvásminőség → alacsonyabb másnapi RPE), a szórásdiagram ebből épül.
  days: [
    { date: '2026-07-21', a: 4.8, b: 7.6 }, { date: '2026-07-22', a: 5.2, b: 7.3 },
    { date: '2026-07-23', a: 6.1, b: 6.8 }, { date: '2026-07-24', a: 5.5, b: 7.1 },
    { date: '2026-07-25', a: 6.8, b: 6.2 }, { date: '2026-07-26', a: 7.0, b: 5.9 },
    { date: '2026-07-27', a: 4.5, b: 7.9 }, { date: '2026-07-28', a: 6.3, b: 6.5 },
    { date: '2026-07-29', a: 7.5, b: 5.4 }, { date: '2026-07-30', a: 5.0, b: 7.4 },
    { date: '2026-07-31', a: 6.6, b: 6.1 }, { date: '2026-08-01', a: 7.2, b: 5.7 },
    { date: '2026-08-02', a: 5.8, b: 6.9 }, { date: '2026-08-03', a: 8.0, b: 5.0 },
    { date: '2026-08-04', a: 6.0, b: 6.6 }, { date: '2026-08-05', a: 7.8, b: 5.2 },
    { date: '2026-08-06', a: 5.4, b: 7.0 }, { date: '2026-08-07', a: 8.3, b: 4.6 },
    { date: '2026-08-08', a: 6.9, b: 6.0 }, { date: '2026-08-09', a: 7.6, b: 5.3 },
    { date: '2026-08-10', a: 5.9, b: 6.8 }, { date: '2026-08-11', a: 8.5, b: 4.4 },
    { date: '2026-08-12', a: 7.1, b: 5.6 }, { date: '2026-08-13', a: 8.8, b: 4.1 },
  ],
  impact: {
    fact: {
      id: 'fact-showcase-1',
      text: 'Ha rosszul alszol, nehezebbnek érzed másnap az edzést.',
      reinforcementCount: 4,
      includeInPrompt: true,
    },
    predictions: [
      { id: 'pred-showcase-1', title: 'Csütörtök reggeli edzés RPE > 7 (alvás < 6)', status: 'validated' },
      { id: 'pred-showcase-2', title: 'Hétfő reggeli edzés könnyebbnek érződik (alvás 8+)', status: 'pending' },
    ],
    experiments: [
      { id: 'exp-showcase-1', title: 'Esti lecsendesítés rutina edzés előtti este', status: 'active' },
    ],
    challenges: [
      { id: 'chal-showcase-1', title: 'Volume PR alvás ≥ 7.5h után', status: 'completed' },
    ],
  },
}

/** Két kézzel írt detail-seed (spec-mockup a forrás): egy megerősített pár teljes történettel
 *  + a katalógus minden MÁS párjára minimál-detail (pair a patternMonitor-ból, pattern: null,
 *  üres history/days/impact — gyűjtögető pár, még nem ment át a kapun). Ismeretlen kulcsra
 *  `null` (a hook ezt a real-mode 404-gyel egyenértékű "nincs ilyen minta" állapotra képezi). */
export function mockPatternPairDetail(pairKey: string): PatternPairDetail | null {
  if (pairKey === SHOWCASE_PAIR_KEY) return showcaseDetail
  const pair = patternMonitor.pairs.find((p) => p.key === pairKey)
  if (!pair) return null
  return { pair, pattern: null, events: [], days: [], impact: EMPTY_IMPACT }
}
