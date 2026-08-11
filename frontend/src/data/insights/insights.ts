import type {
  Pattern,
  PatternCategory,
  PatternMonitor,
  Prediction,
  Experiment,
  WeeklyReview,
  WeeklyGrowth,
  Memoir,
} from '@/data/types'

export const MIN_PATTERN_CONFIDENCE = 0.65

export function patternCategoryColor(cat: PatternCategory): string {
  return `var(--cat-${cat})`
}

export const patterns: Pattern[] = [
  {
    id: 'p1',
    category: 'physiology',
    categoryLabel: 'Fiziológia',
    confidence: 0.85,
    title: 'Reta beadás + 36h ablakban étvágy lefulladás',
    mechanism:
      'A Retatrutide beadás után 24-48h-val az étvágy a legalacsonyabb. A nézőpontunk: ezeken a napokon a kcal-pacing 15 órára 38% körül van (átlag: 51%).',
    evidence: ['12 Reta beadás óta', '9 nap megerősítve', '0.85 statisztikai stabilitás'],
    critique: { statistical: 0.85, confounders: 0.72, l3align: 0.91, actionability: 0.88 },
    thinking:
      'Megfigyelés: D2-D3 napokon a meal-count 3-ról 2-re csökken, és ez nem a tudatos döntés következménye, hanem az éhségérzet eltűnése. Hipotézis: a pacing-alert push T-2h-val az edzés előtt fix kell maradjon ezeken a napokon — különben az under-fueling kockázat magas.',
  },
  {
    id: 'p2',
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
  body: 'Ezen a héten történt valami amit én is csak utólag láttam: nem siettetted a vasárnap esti reggelet hétfő helyett. Március óta a Reta-beadás reggelén mindig hajtottad magad, mintha pótolnod kéne valamit — most leültél, és a porridge mellett még megnézted a tegnapi PR-videót. Ez nem semmi. A Chest Row 105.8-on dolgozunk hat hete, és úgy érzem hogy ezen a héten téged is megnyugtatott. Csütörtökön (Pull Day) a 102.5 × 9 @ RIR 2 olyan tisztán ment, hogy elgondolkodtam: jövő héten 105 × 8-re menjünk? Erről beszéljünk pénteken.',
  anchors: [
    { kind: 'PR', label: 'Chest Row 102.5 × 9' },
    { kind: 'Reta', label: 'D1 reggel · pihenve' },
    { kind: 'Identity', label: 'Peak performance · life' },
  ],
}

export const anniversaryNote =
  'Egy hónapja kezdtük a Reta-protokollt. Akkor még tipikus volt az este 22:00-s vacsora — most a hét 5 napján 21:30 előtt tudunk csukni a konyhában. Ez nem semmi.'

export const predictions: Prediction[] = [
  {
    id: 'pred1',
    title: 'Csütörtök Pull Day · Chest Row PR (107.5 × 8)',
    confidence: 0.72,
    status: 'pending',
    date: 'Máj 22',
    basis:
      'Március óta a 102.5 stabil. Múlt heti RIR 2 + Reta D3 alacsony étvágy + 7.5h alvás kombináció historikusan +5kg-os emelést támogatott.',
  },
  {
    id: 'pred2',
    title: 'Hét 21 testsúly · 78.4 ±0.3 kg',
    confidence: 0.81,
    status: 'pending',
    date: 'Máj 26',
    basis: 'Hét 20 átlag 78.6kg. Reta D3-D7 alacsonyabb intake. 7-day MA trend.',
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

/** A monitor demo-pillanatképe (mezo-viqs) — mind az 5 verdikt látszik a 8 katalógus-páron. */
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
      verdict: 'live', alignedDays: 21, missingDays: null, bottleneckMetricKey: null,
      r: -0.42, n: 21, p: 0.058, status: null,
    },
    {
      key: 'checkin-stress~sleep-quality',
      title: 'Stressz-szint ↔ aznapi alvásminőség',
      category: 'trigger', categoryLabel: 'Trigger', lagDays: 0,
      metricAKey: 'checkin-stress', metricALabel: 'stressz-szint',
      metricBKey: 'sleep-quality', metricBLabel: 'alvásminőség',
      verdict: 'live', alignedDays: 34, missingDays: null, bottleneckMetricKey: null,
      r: -0.61, n: 34, p: 0.001, status: null,
    },
    {
      key: 'sleep-duration~next-day-training-rpe',
      title: 'Alváshossz ↔ másnapi edzés-RPE',
      category: 'physiology', categoryLabel: 'Fiziológia', lagDays: 1,
      metricAKey: 'sleep-duration-h', metricALabel: 'alváshossz',
      metricBKey: 'training-rpe', metricBLabel: 'edzés-RPE',
      verdict: 'few_days', alignedDays: 6, missingDays: 2, bottleneckMetricKey: 'training-rpe',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'late-meal~next-sleep-quality',
      title: 'Késői étkezés ↔ rákövetkező alvásminőség',
      category: 'trigger', categoryLabel: 'Trigger', lagDays: 1,
      metricAKey: 'late-meal-hour', metricALabel: 'utolsó étkezés ideje',
      metricBKey: 'sleep-quality', metricBLabel: 'alvásminőség',
      verdict: 'few_days', alignedDays: 7, missingDays: 1, bottleneckMetricKey: 'late-meal-hour',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'daily-kcal~next-morning-weight-delta',
      title: 'Napi kalória ↔ másnap reggeli súlyváltozás',
      category: 'response', categoryLabel: 'Response', lagDays: 1,
      metricAKey: 'daily-kcal', metricALabel: 'napi kalória',
      metricBKey: 'weight-delta-kg', metricBLabel: 'reggeli súlyváltozás',
      verdict: 'few_days', alignedDays: 3, missingDays: 5, bottleneckMetricKey: 'weight-delta-kg',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'sport-load~next-day-gym-volume',
      title: 'Sportterhelés ↔ másnapi gym-volumen',
      category: 'response', categoryLabel: 'Response', lagDays: 1,
      metricAKey: 'sport-load-min', metricALabel: 'sportterhelés',
      metricBKey: 'gym-volume-kg', metricBLabel: 'gym-volumen',
      verdict: 'no_data', alignedDays: 0, missingDays: null, bottleneckMetricKey: 'sport-load-min',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'daily-water~checkin-energy',
      title: 'Vízbevitel ↔ energia-szint',
      category: 'physiology', categoryLabel: 'Fiziológia', lagDays: 0,
      metricAKey: 'daily-water-ml', metricALabel: 'vízbevitel',
      metricBKey: 'checkin-energy', metricBLabel: 'energia-szint',
      verdict: 'degenerate', alignedDays: 19, missingDays: null, bottleneckMetricKey: 'daily-water-ml',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'reta-cycle-day~daily-kcal',
      title: 'Reta-ciklusnap ↔ napi kalória',
      category: 'physiology', categoryLabel: 'Fiziológia', lagDays: 0,
      metricAKey: 'reta-cycle-day', metricALabel: 'Reta-ciklusnap',
      metricBKey: 'daily-kcal', metricBLabel: 'napi kalória',
      verdict: 'frozen', alignedDays: 28, missingDays: null, bottleneckMetricKey: null,
      r: 0.55, n: 28, p: 0.002, status: 'confirmed',
    },
  ],
  metrics: [
    { key: 'sport-load-min', label: 'sportterhelés', coveredDays: 0, windowDays: 60, lastDayWithData: null, pairCount: 1 },
    { key: 'gym-volume-kg', label: 'gym-volumen', coveredDays: 4, windowDays: 60, lastDayWithData: '2026-07-02', pairCount: 1 },
    { key: 'weight-delta-kg', label: 'reggeli súlyváltozás', coveredDays: 9, windowDays: 60, lastDayWithData: '2026-08-06', pairCount: 1 },
    { key: 'training-rpe', label: 'edzés-RPE', coveredDays: 12, windowDays: 60, lastDayWithData: '2026-08-09', pairCount: 2 },
    { key: 'late-meal-hour', label: 'utolsó étkezés ideje', coveredDays: 16, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'daily-water-ml', label: 'vízbevitel', coveredDays: 19, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'sleep-duration-h', label: 'alváshossz', coveredDays: 22, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'daily-kcal', label: 'napi kalória', coveredDays: 27, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 2 },
    { key: 'reta-cycle-day', label: 'Reta-ciklusnap', coveredDays: 28, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'checkin-energy', label: 'energia-szint', coveredDays: 34, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'checkin-stress', label: 'stressz-szint', coveredDays: 34, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'sleep-quality', label: 'alvásminőség', coveredDays: 58, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 3 },
  ],
}
