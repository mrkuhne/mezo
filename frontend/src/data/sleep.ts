import type { SleepEntry, SleepTrends } from './types'

export const sleepLog: SleepEntry[] = [
  { date: '2026-05-09', bedtime: '23:15', wakeup: '06:45', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 130, notes: null },
  { date: '2026-05-10', bedtime: '23:40', wakeup: '07:00', duration: 7.3, quality: 7, awakenings: 1, mealToSleep: 95, notes: 'Vacsora csúszott' },
  { date: '2026-05-11', bedtime: '23:55', wakeup: '07:20', duration: 7.4, quality: 6, awakenings: 2, mealToSleep: 80, notes: 'Volleyball szombat · late dinner' },
  { date: '2026-05-12', bedtime: '22:50', wakeup: '06:30', duration: 7.7, quality: 8, awakenings: 0, mealToSleep: 145, notes: null },
  { date: '2026-05-13', bedtime: '23:10', wakeup: '06:50', duration: 7.7, quality: 8, awakenings: 1, mealToSleep: 140, notes: null },
  { date: '2026-05-14', bedtime: '23:30', wakeup: '06:50', duration: 7.3, quality: 7, awakenings: 1, mealToSleep: 110, notes: null },
  { date: '2026-05-15', bedtime: '00:15', wakeup: '07:00', duration: 6.8, quality: 5, awakenings: 3, mealToSleep: 65, notes: 'Magnézium kihagyva · késő szénhidrát' },
  { date: '2026-05-16', bedtime: '23:00', wakeup: '06:30', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 150, notes: null },
  { date: '2026-05-17', bedtime: '23:20', wakeup: '07:00', duration: 7.7, quality: 8, awakenings: 1, mealToSleep: 155, notes: null },
  { date: '2026-05-18', bedtime: '23:50', wakeup: '07:10', duration: 7.3, quality: 7, awakenings: 2, mealToSleep: 95, notes: 'Volleyball + késő vacsora' },
  { date: '2026-05-19', bedtime: '22:45', wakeup: '06:30', duration: 7.8, quality: 9, awakenings: 0, mealToSleep: 160, notes: 'Reta D1 · pihenve, magnézium ment' },
  { date: '2026-05-20', bedtime: '23:00', wakeup: '06:30', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 140, notes: null },
  { date: '2026-05-21', bedtime: '23:25', wakeup: '06:45', duration: 7.3, quality: 7, awakenings: 1, mealToSleep: 110, notes: null },
  { date: '2026-05-22', bedtime: '23:05', wakeup: '06:30', duration: 7.4, quality: 7, awakenings: 1, mealToSleep: 125, notes: 'Tegnap stabil' },
]

export const sleepTrends: SleepTrends = {
  target: { duration: 7.5, quality: 8, bedtime: '22:45', wakeup: '06:30' },
  last7d: { avgDuration: 7.46, avgQuality: 7.7, nightsUnder7h: 0, awakeningsAvg: 1.0, onTrack: true },
  last14d: { avgDuration: 7.41, avgQuality: 7.4, nightsUnder7h: 1, awakeningsAvg: 1.1, onTrack: true },
  factors: [
    { kind: 'positive', title: 'Magnézium 21:00 stack megtartva', impact: '+0.6 quality', evidence: '8/10 nap megerősítve · P2 pattern', confidence: 0.84 },
    { kind: 'positive', title: 'Kitchen close 21:30 előtt', impact: '+0.4 quality', evidence: 'Meal-to-sleep > 2h korreláció', confidence: 0.78 },
    { kind: 'watch', title: 'Reta D1 hétfő · késő-bedtime tendencia', impact: '−15 perc onset', evidence: 'Múlt 4 ciklusban D1 átlag 23:30+', confidence: 0.71 },
    { kind: 'negative', title: 'Caffeine 14:00 utáni napok', impact: '−24 perc onset', evidence: 'Pattern P3 megerősítve', confidence: 0.69, warning: true },
  ],
  insights: [
    { type: 'milestone', text: 'Heti átlag **7.46h, quality 7.7** — két hete tartja magát. 7.5h target, gyakorlatilag elértük.' },
    { type: 'pattern', text: '**Csü volleyball napok** átlaga 7.3h vs hét többi napja 7.6h. A 19:30-as session után a 21:30 kitchen close kritikus — ha ez tartja, nincs jelentős impact.' },
    { type: 'warning', text: 'Máj 15 (csütörtök · magnézium kihagyva + késő szénhidrát) **6.8h · 3 ébredés** — egyértelmű pattern P2+P3 együtt.' },
  ],
}
