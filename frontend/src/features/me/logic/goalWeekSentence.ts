import type { LifeGoalTodaySummary } from '@/data/lifegoal/lifegoalApi'

/**
 * A Heti hub cél-sorának egy mondata (mezo-iizd.9) — KIZÁRÓLAG a motor számolt tényeiből.
 *
 * A prototípus (celok-body.html #page-heti) per-cél magyarázó mondata AI-narratíva; azt a heti
 * visszatekintés adja (a promptja a nyilakat a Task 4 óta megkapja), és a „Mezo · heti elemzés"
 * csempén jelenik meg. Ez a sor NEM annak a másolata: számolt tény, ezért sosem hazudik.
 *
 * Őszinteség: `no_data` nap SOSEM számít találatnak és sosem számít kihagyásnak; ha egyetlen
 * adat-nap sincs, a mondat ezt mondja ki ahelyett, hogy „0 találat-napot" állítana.
 */
export function goalWeekSentence(s: LifeGoalTodaySummary): string {
  const week = s.days7.slice(-7)
  const dataDays = week.filter((d) => d !== 'no_data').length
  const hits = week.filter((d) => d === 'hit').length
  if (dataDays === 0) return 'Ezen a héten még nincs adata.'

  const span = `${hits} találat-nap a ${week.length}-ből`
  const today = s.pillarsTotal != null && s.pillarsTotal > 0 && s.pillarsHitToday != null
    ? ` · ma ${s.pillarsHitToday} / ${s.pillarsTotal} pillér`
    : ''
  if (s.arrow === 'insufficient') return `Még kevés az adat az irányhoz — ${span}.`
  return `${span}${today}.`
}
