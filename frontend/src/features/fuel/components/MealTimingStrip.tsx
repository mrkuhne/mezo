// ============================================================
// Mezo · MealTimingStrip — a `context` dimenzió időzítés-sávja (mezo-jcpt.3)
// Source: a jóváhagyott napi-értékelés prototípus 3. képernyője, `.predtile.sky` `.tline`.
//
// Nyelvtan: Stephen Few bullet-graph — lineáris tengely, a minőségi zóna (az étkezési
// ablak) KITÖLTÖTT háttérsávként (nem körvonalként, ami a 3:1 nem-szöveges kontrasztot
// megbukná), és a tényleges érték EGY jelölőként. Legend nélkül olvasható.
//
// A tengely SZÁNDÉKOSAN a teljes nap (0–24 h), minden étkezésnél azonos skálán (Tufte
// small-multiples): egy nap étkezései így egymás mellett is összehasonlíthatók. Az
// „ablak ± 3 h" zoomolt tengelyt elvetettük — étkezésenként más skálát adna.
//
// A sáv aria-hidden: a szöveges igazságot a meglévő „Időzítés" tény-chip hordozza
// (WCAG / Carbon: a szín soha nem az egyetlen jel).
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { MealTiming } from '@/data/types'

/** "HH:mm" → a nap hányadrésze, %-ban. */
function pct(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return ((h * 60 + m) / 1440) * 100
}

/** Egy tizedesre kerekített százalék-string — a teszt és a render ugyanazt a számot látja. */
function at(hhmm: string): string {
  return `${Math.round(pct(hhmm) * 10) / 10}%`
}

export function MealTimingStrip({ timing }: { timing: MealTiming }) {
  const { eatenAt, windowFrom, windowTo } = timing
  const anyHour = windowFrom == null || windowTo == null
  const eaten = pct(eatenAt)
  const from = anyHour ? 0 : pct(windowFrom)
  const to = anyHour ? 100 : pct(windowTo)
  const miss = !anyHour && (eaten < from || eaten > to)
  // A híd az ablak KÖZELEBBI szélétől a pontig tart — soha nem a tengely elejétől.
  const linkFrom = eaten > to ? to : eaten
  const linkTo = eaten > to ? eaten : from

  return (
    <div className="sb-tline" aria-hidden="true">
      <span className="trk" />
      <span className={cn('band', anyHour && 'is-any')}
        style={{ left: `${Math.round(from * 10) / 10}%`, width: `${Math.round((to - from) * 10) / 10}%` }} />
      {miss && (
        <span className="miss-lnk"
          style={{ left: `${Math.round(linkFrom * 10) / 10}%`, width: `${Math.round((linkTo - linkFrom) * 10) / 10}%` }} />
      )}
      <span className={cn('dot', miss && 'is-miss')} style={{ left: at(eatenAt) }} />
      <span className={cn('tlab', miss && 'is-miss')} style={{ left: at(eatenAt) }}>{eatenAt}</span>
      <span className="ax" style={{ left: '0%' }}>0</span>
      <span className="ax" style={{ left: '25%' }}>6</span>
      <span className="ax" style={{ left: '50%' }}>12</span>
      <span className="ax" style={{ left: '75%' }}>18</span>
      <span className="ax" style={{ left: '100%' }}>24</span>
    </div>
  )
}
