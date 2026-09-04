import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { useLifeGoalToday } from '@/data/hooks'
import { DIMENSIONS, DOT_CLASS } from '@/features/me/logic/lifegoalLabels'
import type { LifeGoalDimension } from '@/data/lifegoal/lifegoalApi'

// Nap-mozaik „Célok · ma" csempe (mezo-iizd.9, prototípus celok-body.html #page-nap `.gtile`).
// EGY adatot mond: ma hány pillér teljesült az összesből, plusz a goal-napok hét pöttye.
//
// Miért rendereli null-ként magát három esetben:
//  · nincs aktív cél — a csempe nem foglalhat helyet egy üres funkció nevében (bd mezo-iizd.9:
//    „CSAK aktív cél mellett");
//  · a lekérés még fut vagy elhasalt — a `useLifeGoalToday` `realEmpty`-je feloldatlan ablakban
//    UGYANAZT az üres listát adja, mint a „nincs célod", tehát a feltétel nélküli számolás egy
//    kitalált „0 / 0"-t nyomtatna (a CelokPage `todayHonest` idiómája);
//  · egyetlen cél sem közöl pillér-számot — nincs mit mondani.
export function LifeGoalTodayTile({ delayMs }: { delayMs: number }) {
  const navigate = useNavigate()
  const { today, isPending, isError } = useLifeGoalToday()
  if (isPending || isError || today.goals.length === 0) return null

  // SZÁMOLT célok: csak az, amelyik MINDKÉT számot közli. Egy `pillarsTotal == null` célnál a
  // korábbi `?? 0` a számlálóból ÉS a nevezőből is némán kiejtette a célt — a csempe „2 / 3"-at
  // állított, miközben egy negyedik cél számolatlanul ott volt. Az elhagyás most explicit: egy
  // szám nélküli cél nem pillér-tény, tehát nem szerepelhet egy pillér-tallyben; és ha EGYETLEN
  // cél sem közöl számot, a csempe eltűnik ahelyett, hogy „0 / 0"-t nyomtatna.
  const counted = today.goals.filter((g) => g.pillarsTotal != null && g.pillarsHitToday != null)
  const hit = counted.reduce((s, g) => s + (g.pillarsHitToday as number), 0)
  const total = counted.reduce((s, g) => s + (g.pillarsTotal as number), 0)
  if (counted.length === 0 || total === 0) return null

  // A csempe mosása a legtöbb aktív célt hordozó dimenzióé — egy csempe egy színt visel.
  const byDim = today.goals.reduce((acc, g) => {
    acc[g.dimension] = (acc[g.dimension] ?? 0) + 1
    return acc
  }, {} as Partial<Record<LifeGoalDimension, number>>)
  const lead = today.goals.reduce((best, g) => ((byDim[g.dimension] ?? 0) > (byDim[best] ?? 0) ? g.dimension : best), today.goals[0].dimension)
  const dim = DIMENSIONS[lead]

  // A pöttysor a LEGTÖBB pillért vivő cél goal-napjai — a hét napja per cél, nem összegzés
  // (a státuszok nem összeadhatók: két cél „hit"-je nem egy nagyobb „hit").
  const leadGoal = counted.reduce((best, g) => ((g.pillarsTotal as number) > (best.pillarsTotal as number) ? g : best), counted[0])
  const days7 = leadGoal.days7.slice(-7)

  return (
    <button type="button" className={`mz-tile lg-gtile rise ${dim.cls}`}
      style={{ '--d': `${delayMs}ms` } as React.CSSProperties}
      onClick={() => navigate('/me/goals')} aria-label={`Célok · ma — ${hit} / ${total} pillér`}>
      <span className="mz-eyebrow"><i aria-hidden="true" />Célok · ma</span>
      <div className="lg-gtile-row">
        <ClayIcon name="i-cel" size={30} />
        {/* `none` — a nagy szám egy TALLY (ma hány pillér teljesült), nem irány. Az `up`
            siker-zöldje egy „0 / 9"-et is teljesítésnek festett volna. */}
        <span className="lg-arrow none">
          <span className="v">{hit}<small> / {total}</small></span>
        </span>
      </div>
      <div className="lg-wk7" style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
        {days7.map((status, i) => <i key={i} className={status ? DOT_CLASS[status] : 'n'} style={{ '--i': i } as React.CSSProperties} />)}
        <span className="lbl">pillér</span>
      </div>
    </button>
  )
}
