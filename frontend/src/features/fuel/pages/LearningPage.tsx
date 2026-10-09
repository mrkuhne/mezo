import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExpenditureHistory, useExpenditureWeeklyCard } from '@/data/fuel/expenditureHooks'
import { huInt } from '@/shared/lib/huNum'
import { addDays } from '@/shared/lib/dates'
import { ContentIcon } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { LearningHistoryChart } from '@/features/fuel/components/LearningHistoryChart'
import { LearningDaysList, type LearningMode } from '@/features/fuel/components/LearningDaysList'
import { WeeklyLearningDot } from '@/features/fuel/components/WeeklyLearningDot'
import { LearnedBaseExplainer } from '@/features/fuel/sheets/LearnedBaseExplainer'
import { WeeklyLearningSheet } from '@/features/fuel/sheets/WeeklyLearningSheet'
import { CONFIDENCE_WORD, huWeekRange, learningModeOf, nf, round10 } from '@/features/fuel/sheets/learnedBaseFormat'
import { FrameBack } from '@/shared/ui/folyadek'

// ============================================================
// Mezo · LearningPage — „Hogy tanultam?” at /fuel/tanulas (mezo-3n2so, learned expenditure part 2,
// spec §5.3). Build target: docs/design_2.0/prototypes/elo/fuel.html `tanulas()` — three states:
//   Tanul          the learned base (frameless sage halo hero) with its σ̂ and the formula aside;
//                  with a weekly summary the status row is ONE full-width button (dot + „· heti
//                  összegző ›”, owner round 2) that opens the „Heti tanulás” sheet
//   Még nincs adat no reviewed week yet: one honest dashed line, no chart, no six sections
//   Kikapcsolva    the frame comes from the formula; it says what it quietly learned meanwhile
// Then „Hétről hétre” (the chart, one glass card), „Az utolsó 14 nap” (the day switches, one glass
// card — always, even with no data) and „A legutóbbi hét részletei” (the six-section explainer,
// unchanged). Opened from the energy sheet's „Részletek ›”, the weekly sheet and the bell.
// ============================================================

export function LearningPage() {
  const navigate = useNavigate()
  const { data: history, isPending, isError } = useExpenditureHistory()
  const { card } = useExpenditureWeeklyCard()
  const [weeklyOpen, setWeeklyOpen] = useState(false)
  // Back to wherever it was opened from (energy sheet, weekly sheet, bell); a deep link has no
  // in-app history (react-router's `idx` is 0), so it falls back to Fuel Mai.

  const weeks = history?.weeks ?? []
  const last = weeks.length > 0 ? weeks[weeks.length - 1] : null
  const on = history?.learningEnabled !== false
  const mode: LearningMode = learningModeOf(history)
  const certainty = last ? `Tanult alap · ${CONFIDENCE_WORD[last.confidence]} · ±${round10(last.posteriorSdKcal)} kcal` : ''
  const hold = card?.status === 'holding'

  let i = 0
  const rise = () => ({ '--i': ++i } as CSSProperties)

  return (
    <div className="fmx-page fln-page">
      <EntranceGroup>
        <div className="fmx-subhead rise">
          <FrameBack className="glass is-round" history fallback="/fuel" label="Vissza">‹</FrameBack>
          <span>
            <small>Fuel · energiaigény</small>
            <h1 className="fkx-title">Hogy tanultam?</h1>
          </span>
        </div>

        {!history ? (
          <p className="fln-state rise">{isPending ? 'Betöltöm, hogyan tanultam…' : isError ? 'Most nem sikerült betölteni, hogyan tanultam.' : null}</p>
        ) : !last ? (
          <div className="fln-empty uv-empty rise" style={rise()}>
            <ContentIcon name="t-lens" size={40} />
            <p><b>Még nem tanultam</b> — ehhez legalább 10 felírt nap kell az utolsó 4 hétből és heti 2 mérlegelés.</p>
          </div>
        ) : on ? (
          <section className="fln-hero uv-halo rise" style={{ '--c': 'var(--dv-sage)', '--c2': 'var(--dv-lav)', ...rise() } as CSSProperties}>
            <span className="uv-eyebrow">Tanult alap</span>
            <div className="fln-num">{nf(last.appliedBaseKcal)}<small>kcal</small></div>
            {card ? (
              <button type="button" className="fln-line fln-tap" aria-label={`${certainty} — heti összegző megnyitása`} onClick={() => setWeeklyOpen(true)}>
                {certainty}
                <WeeklyLearningDot hold={hold} />
                <span className="fln-more">· heti összegző ›</span>
              </button>
            ) : (
              <p className="fln-line">{certainty}</p>
            )}
            <p className="fln-sub">A képlet {huInt(last.formulaBaseKcal)} kcal-t mondana.</p>
          </section>
        ) : (
          <section className="fln-hero uv-halo rise" style={{ '--c': 'var(--dv-amber)', '--c2': 'var(--dv-sage)', ...rise() } as CSSProperties}>
            <span className="uv-eyebrow">Most nem használom</span>
            <p className="fln-off">A keret a képletből jön · <b>{huInt(last.formulaBaseKcal)} kcal</b></p>
            <p className="fln-muted">Közben csendben tovább tanultam: {huInt(last.posteriorBaseKcal)} ± {round10(last.posteriorSdKcal)} kcal</p>
            <button type="button" className="fln-flat" onClick={() => navigate('/settings/fuel')}>Bekapcsolás a Fuel beállításokban</button>
          </section>
        )}

        {last && (
          <>
            <div className="fmx-section fmx-section-row fln-sec rise" style={rise()}>
              <h2>Hétről hétre</h2>
              <small>{weeksSpan(weeks)} hét</small>
            </div>
            <div className="fln-card glass rise" style={{ '--c': 'var(--dv-sage)', ...rise() } as CSSProperties}>
              <LearningHistoryChart weeks={weeks} />
            </div>
          </>
        )}

        {(history || !isPending) && (
          <>
            <div className="fmx-section fmx-section-row fln-sec rise" style={rise()}>
              <h2>Az utolsó 14 nap</h2>
              <small>A mai nem számít</small>
            </div>
            <div className="fln-card fln-days glass rise" style={{ '--c': 'var(--dv-lav)', ...rise() } as CSSProperties}>
              <LearningDaysList mode={mode} />
            </div>
          </>
        )}

        {last && (
          <>
            <div className="fmx-section fmx-section-row fln-sec rise" style={rise()}>
              <h2>A legutóbbi hét részletei</h2>
              <small>{huWeekRange(last.weekStart, addDays(last.weekStart, 6))}</small>
            </div>
            <div className="fln-explainer rise" style={rise()}>
              <LearnedBaseExplainer />
            </div>
          </>
        )}
      </EntranceGroup>

      {weeklyOpen && card && <WeeklyLearningSheet card={card} onClose={() => setWeeklyOpen(false)} />}
    </div>
  )
}

/** Calendar weeks the chart spans, gaps included (its x axis). */
function weeksSpan(weeks: { weekStart: string }[]): number {
  const first = Date.parse(weeks[0].weekStart)
  const lastStart = Date.parse(weeks[weeks.length - 1].weekStart)
  return Math.round((lastStart - first) / (7 * 86_400_000)) + 1
}
