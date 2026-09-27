import type { ExpenditureExplanation, ExpenditureSeriesPoint } from '@/data/fuel/expenditureApi'
import { addDays } from '@/shared/lib/dates'

// „Hogy tanultam?” mock fixture (mezo-y72o3) — the owner-approved prototype's numbers
// (docs/design_2.0/prototypes/hogy-tanultam.html): 47 usable days, 52 weigh-ins, 8 weeks,
// 2780 − 352 − 426 ≈ 2000, four suspicious days, one water event, 9 unlogged days, ±200 LOW,
// 2356 → 2309 → −150 → 2159. Also the default MSW body for real-mode tests.

const SERIES_START = '2026-08-03'
const N = 56
// Day indices from SERIES_START: 41 = 09-13, 47 = 09-19, 48 = 09-20, 52 = 09-24.
const SUSPICIOUS: Record<number, number> = { 41: 604, 47: 929, 48: 828, 52: 1347 }
const UNLOGGED = new Set([3, 11, 17, 22, 27, 31, 40, 46, 53])
const WATER_FROM = 42 // 09-14 — the glycogen-water jump

const round2 = (n: number) => Math.round(n * 100) / 100

// Deterministic owner-like 8 weeks (the prototype's `data()` generator, re-anchored to the dates above).
function buildSeries(): ExpenditureSeriesPoint[] {
  let seed = 7
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  const out: ExpenditureSeriesPoint[] = []
  for (let i = 0; i < N; i++) {
    const water = i >= WATER_FROM ? Math.min(1.5, (i - WATER_FROM + 1) * 0.5) : 0
    const tissue = 83.2 + i * 0.046
    const w = tissue + water + (rnd() - 0.5) * 0.9
    const usable = Math.round(2620 + rnd() * 380 + (i >= WATER_FROM ? 90 : 0))
    const weighed = rnd() < 0.93
    const status: ExpenditureSeriesPoint['status'] =
      UNLOGGED.has(i) ? 'unlogged' : i in SUSPICIOUS ? 'suspicious' : 'usable'
    out.push({
      date: addDays(SERIES_START, i),
      intakeKcal: status === 'unlogged' ? null : SUSPICIOUS[i] ?? usable,
      status,
      weightKg: weighed ? round2(w) : null,
      trendKg: round2(tissue + water * 0.9),
      tissueKg: round2(tissue),
    })
  }
  return out
}

export const expenditureExplanationSeed: ExpenditureExplanation = {
  weekStart: '2026-09-21',
  status: 'learning',
  confidence: 'low',
  formulaBaseKcal: 2356,
  posteriorBaseKcal: 2020,
  posteriorSdKcal: 200,
  appliedBaseKcal: 2159,
  stepKcal: -150,
  windowStart: '2026-07-20',
  windowEnd: '2026-09-27',
  dataStart: '2026-07-30',
  usableDays: 47,
  weighInDays: 52,
  unloggedDays: 9,
  historyWeeks: 8,
  avgIntakeKcal: 2780,
  avgMovementKcal: 426,
  tissueRateKgPerWeek: 0.32,
  tissueKcalPerDay: 352,
  simpleBaseKcal: 2002,
  startBaseKcal: 2309,
  excludedDays: [
    { date: '2026-09-13', kcal: 604, reason: 'suspicious' },
    { date: '2026-09-19', kcal: 929, reason: 'suspicious' },
    { date: '2026-09-20', kcal: 828, reason: 'suspicious' },
    { date: '2026-09-24', kcal: 1347, reason: 'suspicious' },
  ],
  waterEvents: [{ date: '2026-09-14', kg: 1.5 }],
  series: buildSeries(),
}
