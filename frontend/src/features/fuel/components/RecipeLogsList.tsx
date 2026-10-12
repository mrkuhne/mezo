// ============================================================
// Mezo · RecipeLogsList
// Today's logs of this recipe (`useRecipeLogs` — other days never show here): which meal, when,
// the meal's own rating, how it stands against the recipe's rating, and its macros.
// Folyadék (mezo-n4wf5.5, fuel.js `SH.reclogs`): a plain list inside the sheet — the bubble
// plate, the title and time, the score on the ten scale (or „folyamatban"), one sentence for the
// difference, and the four tinted cells. Words in `fuelRecept.detail`.
//
// What arrives from the server is data: `slot` is a meal-slot key or a stored window name,
// `loggedAt` an ISO instant — the label and the clock are composed here. (The mock seed still
// carries ready Hungarian strings; those print as they are.)
// ============================================================
import type { RecipeLog } from '@/data/types'
import { m, useM } from '@/shared/i18n'
import { fmtClock, fmtFixed, fmtNum } from '@/shared/lib/format'
import { Bub, Empty, Note, St } from '@/shared/ui/folyadek'
import { MacroTriple } from '@/features/fuel/components/folyadek'

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** „ma 07:15" from an ISO instant (the list is today's only); a ready string prints unchanged. */
function whenLabel(loggedAt: string): string {
  if (!ISO.test(loggedAt) || Number.isNaN(new Date(loggedAt).getTime())) return loggedAt
  return m().fuelRecept.common.today(fmtClock(loggedAt))
}

/** A slot key becomes its label; a stored name stays as written. */
function slotLabel(slot: string): string {
  const labels = m().fuelLogika.slot as Record<string, string>
  return labels[slot.toLowerCase()] ?? slot
}

export function RecipeLogsList({ logs, baselineScore }: { logs?: RecipeLog[]; baselineScore: number }) {
  const M = useM()
  const D = M.fuelRecept.detail
  if (!logs || logs.length === 0) {
    return <Empty icon="t-journal" className="fc-logs-empty">{D.logsEmpty}</Empty>
  }
  return (
    <div className="fc-logs">
      {logs.map((l, i) => {
        // delta vs the recipe's live rating (mezo-yta); the seed's authored delta is the fallback
        // for mock logs whose baseline is still the pending null → 0. Printed on the ten scale.
        const delta = baselineScore > 0 && l.score ? l.score - baselineScore : l.delta
        const d = Math.round(delta * 100) / 10
        return (
          <div key={i} className="fc-log">
            <div className="fc-log-top">
              <Bub icon="t-plate" size={38} />
              <span className="g"><strong>{slotLabel(l.slot)}</strong><small>{whenLabel(l.loggedAt)}</small></span>
              {l.score ? <span className="v">{fmtFixed(l.score * 10, 1)}</span> : <St tone="q">{D.logPending}</St>}
            </div>
            {l.score ? (
              <p>{d === 0 ? D.logSame : D.logDelta(`${d > 0 ? '+' : '−'}${fmtNum(Math.abs(d), 1)}`)}</p>
            ) : null}
            <MacroTriple kcal={l.kcal} p={l.p} c={l.c} f={l.f} />
          </div>
        )
      })}
      <Note>{D.logsNote}</Note>
    </div>
  )
}
