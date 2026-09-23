// ============================================================
// Mezo · RecipeLogsList
// Today's logs of this recipe: slot, loggedAt, actual score,
// delta vs baseline, macros. Empty-state copy when none.
// ============================================================
import type { RecipeLog } from '@/data/types'
import { ContentIcon } from '@/shared/ui/clay'

// Üveg U2 (mezo-me75u.2, prototype `SH.reclogs`): the sheet is the surface, so every log is a
// FLAT cell (no glass in the glass sheet) with the plate icon, and the score a flat
// lavender-lit pill. The empty state is dashed; the footnote stays a quiet line.
export function RecipeLogsList({ logs, baselineScore }: { logs?: RecipeLog[]; baselineScore: number }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="fkx-rlog-empty uv-empty">
        <ContentIcon name="t-journal" size={40} />
        <strong>Még nem logoltad ezt a receptet ezen a héten.</strong>
        <p>
          Amint logolod a mai étkezésekbe, a Mezo kontextusra futtatja és látod itt a tényleges score-okat.
        </p>
      </div>
    )
  }
  return (
    <div className="fkx-rlogs">
      {logs.map((l, i) => {
        // delta vs the recipe's live mezo-fit baseline (mezo-yta); the seed's authored delta is
        // the fallback for mock logs whose baseline is still the pending null → 0.
        const delta = baselineScore > 0 && l.score ? l.score - baselineScore : l.delta
        return (
        <div key={i} className="fkx-rlog uv-flat">
          <div className="fkx-rlog-top">
            <ContentIcon name="t-plate" size={30} />
            <div className="fkx-rlog-when">
              <strong>{l.slot}</strong>
              <small>{l.loggedAt}</small>
            </div>
            <div className="fkx-rlog-score">
              {l.score ? (
                <>
                  <span className="fmx-score">
                    <ContentIcon name="t-score" size={22} /><b>{(l.score * 100).toFixed(0)}</b>
                  </span>
                  <small className={delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : undefined}>
                    {delta > 0 ? '+' : ''}{(delta * 100).toFixed(0)} vs baseline
                  </small>
                </>
              ) : (
                <span className="fmx-score is-pending">
                  <ContentIcon name="t-other" size={22} /><b>pending</b>
                </span>
              )}
            </div>
          </div>
          <div className="fkx-rlog-macros">
            <span>kcal <b>{l.kcal}</b></span>
            <span>P <b>{l.p}</b></span>
            <span>C <b>{l.c}</b></span>
            <span>F <b>{l.f}</b></span>
          </div>
        </div>
        )
      })}

      <p className="fkx-rlog-foot">
        Csak a mai naptári logok látszanak itt. Heti / havi nézet az Insights tabon.
      </p>
    </div>
  )
}
