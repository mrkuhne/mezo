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
import { fmtGrouped, fmtNum } from '@/shared/lib/format'
import { Bub, Empty, Note, St } from '@/shared/ui/folyadek'
import { MACRO_COLOR } from '@/features/fuel/components/folyadek'

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const pad = (n: number) => String(n).padStart(2, '0')

/** „ma 07:15" from an ISO instant (the list is today's only); a ready string prints unchanged. */
function whenLabel(loggedAt: string): string {
  if (!ISO.test(loggedAt)) return loggedAt
  const d = new Date(loggedAt)
  if (Number.isNaN(d.getTime())) return loggedAt
  return m().fuelRecept.common.today(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
}

/** A slot key becomes its label; a stored name stays as written. */
function slotLabel(slot: string): string {
  const labels = m().fuelLogika.slot as Record<string, string>
  return labels[slot.toLowerCase()] ?? slot
}

export function RecipeLogsList({ logs, baselineScore }: { logs?: RecipeLog[]; baselineScore: number }) {
  const M = useM()
  const D = M.fuelRecept.detail
  const K = M.fuelKozos.macroShort
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
        const cells: Array<[string, string, string]> = [
          ['kcal', 'var(--dom)', fmtGrouped(l.kcal)],
          [K.protein, MACRO_COLOR.protein, `${fmtNum(l.p)} g`],
          [K.carbs, MACRO_COLOR.carbs, `${fmtNum(l.c)} g`],
          [K.fat, MACRO_COLOR.fat, `${fmtNum(l.f)} g`],
        ]
        return (
          <div key={i} className="fc-log">
            <div className="fc-log-top">
              <Bub icon="t-plate" size={38} />
              <span className="g"><strong>{slotLabel(l.slot)}</strong><small>{whenLabel(l.loggedAt)}</small></span>
              {l.score ? <span className="v">{fmtNum(l.score * 10, 1)}</span> : <St tone="q">{D.logPending}</St>}
            </div>
            {l.score ? (
              <p>{d === 0 ? D.logSame : D.logDelta(`${d > 0 ? '+' : '−'}${fmtNum(Math.abs(d), 1)}`)}</p>
            ) : null}
            <span className="fx-lnm">
              {cells.map(([label, color, value]) => (
                <span key={label} style={{ ['--c' as string]: color }}><b>{value}</b><small>{label}</small></span>
              ))}
            </span>
          </div>
        )
      })}
      <Note>{D.logsNote}</Note>
    </div>
  )
}
