import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLifeGoalToday } from '@/data/hooks'
import { ARROW_CLASS, ARROW_GLYPH, DIMENSIONS } from '@/features/me/logic/lifegoalLabels'
import { goalWeekSentence } from '@/features/me/logic/goalWeekSentence'

// Heti hub cél-szekció (mezo-iizd.9, prototípus celok-body.html #page-heti `.qcard` + `.wgrow`):
// célonként nyíl · cím + dimenzió-chip · egy mondat, alul a Célok hubra vivő CTA.
//
// A hub-idióma szerint a kártya feloldatlan/hibás lekérésnél és aktív cél nélkül egyaránt
// NEM renderel — egy „0 cél" szekció-fejléc üres funkciót hirdetne (WeekHubPage honest-states).
export function WeekGoalsCard() {
  const navigate = useNavigate()
  const { today, isPending, isError } = useLifeGoalToday()
  if (isPending || isError || today.goals.length === 0) return null

  return (
    <div className="lg-wcard rise" style={{ '--d': '210ms' } as CSSProperties}>
      <div className="lg-wcard-top">
        <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>Célok · a hét iránya</span>
        <span className="lg-wcard-cnt">{today.goals.length} cél</span>
      </div>
      {today.goals.map((g) => {
        const dim = DIMENSIONS[g.dimension]
        return (
          <div key={g.goalId} className={`lg-wgrow ${dim.cls}`}>
            <span className={`lg-arrow ${ARROW_CLASS[g.arrow]}`}><span className="g">{ARROW_GLYPH[g.arrow]}</span></span>
            <div className="grow">
              <div className="nm">
                {g.title}
                <span className="lg-goalchip"><i />{dim.label}</span>
              </div>
              <div className="x">{goalWeekSentence(g)}</div>
            </div>
          </div>
        )
      })}
      <button type="button" className="lg-wcard-cta" onClick={() => navigate('/me/goals')}>
        Célok · nyisd ki ›
      </button>
    </div>
  )
}
