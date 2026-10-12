import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { EXPENDITURE_HISTORY_KEY, useExpenditureHistory, useExpenditureWeeklyCard, useIntakeDays } from '@/data/fuel/expenditureHooks'
import { useWeight } from '@/data/hooks'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { addDays, localDateString, mondayOf } from '@/shared/lib/dates'
import { Btn, Card, FrameBack, Hero, Level, Page, Section, useFrameTitle } from '@/shared/ui/folyadek'
import { LearningHistoryChart } from '@/features/fuel/components/LearningHistoryChart'
import { LearningDaysList, type LearningMode } from '@/features/fuel/components/LearningDaysList'
import { WeeklyLearningDot } from '@/features/fuel/components/WeeklyLearningDot'
import { LearnedBaseExplainer } from '@/features/fuel/sheets/LearnedBaseExplainer'
import { WeeklyLearningSheet } from '@/features/fuel/sheets/WeeklyLearningSheet'
import { CONFIDENCE_WORD, learningModeOf, round10 } from '@/features/fuel/sheets/learnedBaseFormat'
import { BandG } from '@/features/fuel/sheets/tanulasPieces'

// ============================================================
// Mezo · LearningPage — „Hogy tanultam?” at /fuel/tanulas (mezo-3n2so, learned expenditure part 2,
// spec §5.3). Folyadék (mezo-n4wf5.5): build target docs/design_2.0/prototypes/vilagos/fuel.js
// `tanulas()` — the hero is the learned base in its ± band, the verdict under it:
//   Tanul          the base with its σ̂ and the formula as a tick; with a weekly summary the hero's
//                  button opens the „Heti tanulás” sheet (a drop marks it; hollow when the week held)
//   Még nincs adat no reviewed week yet: the two conditions as levels, no chart, no six steps
//   Kikapcsolva    the frame comes from the formula; it says what it quietly learned meanwhile
//   loading / error the empty level with the sentence; the error offers „Újrapróbálom"
// Then the numbered sections: „Hétről hétre” (the chart), „Az utolsó 14 nap” (the day switches —
// always, even with no data) and „A legutóbbi hét részletei” (the six steps, each behind a row).
// Opened from the energy sheet's row, the weekly sheet and the bell.
// ============================================================

/** What the first learned week needs (spec §4) — the two levels of the empty hero. */
const NEED_LOGGED_DAYS = 10
const NEED_WEIGH_INS = 2

export function LearningPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const M = useM()
  const T = M.fuelTanulas.page
  const { data: history, isPending, isError } = useExpenditureHistory()
  const { card } = useExpenditureWeeklyCard()
  const [weeklyOpen, setWeeklyOpen] = useState(false)
  useFrameTitle({ title: T.title, eyebrow: T.eyebrow })
  // Back to wherever it was opened from (energy sheet, weekly sheet, bell); a deep link has no
  // in-app history (react-router's `idx` is 0), so it falls back to Fuel Mai.
  const back = <FrameBack className="fo-backpill" history fallback="/fuel">‹</FrameBack>

  const weeks = history?.weeks ?? []
  const last = weeks.length > 0 ? weeks[weeks.length - 1] : null
  const on = history?.learningEnabled !== false
  const mode: LearningMode = learningModeOf(history)

  if (!history) {
    const failed = !isPending && isError
    return (
      <Page className="ft-page">
        {back}
        <Hero
          label={T.heroLabel}
          verdict={failed ? T.error : T.loading}
          role={failed ? 'alert' : 'status'}
          actions={failed ? <Btn sm onClick={() => qc.invalidateQueries({ queryKey: EXPENDITURE_HISTORY_KEY })}>{T.retry}</Btn> : undefined}
          graphic={<div className="ft-need ft-hg"><span><Level pct={0} height={18} /></span></div>}
        >
        </Hero>
      </Page>
    )
  }

  const sd = last ? round10(last.posteriorSdKcal) : 0
  const hold = card?.status === 'holding'
  let n = 0

  return (
    <Page className="ft-page">
      {back}
      {!last ? (
        <Hero
          label={T.heroLabel} verdict={T.emptyVerdict} sub={T.emptySub}
          actions={<Btn sm onClick={() => navigate('/fuel/log/uj')}>{T.logMeal}</Btn>}
          graphic={<EmptyNeed />}
        >
        </Hero>
      ) : on ? (
        <Hero
          label={T.heroLabelSure(CONFIDENCE_WORD[last.confidence], String(sd))}
          verdict={T.verdict(fmtGrouped(last.appliedBaseKcal))}
          sub={(last.status === 'holding' ? T.formulaSaysHeld : T.formulaSays)(fmtGrouped(last.formulaBaseKcal))}
          actions={card ? (
            <Btn onClick={() => setWeeklyOpen(true)} aria-label={hold ? `${T.weekly} · ${T.weeklyHeld}` : `${T.weekly} · ${T.weeklyNew}`}>
              {T.weekly}<WeeklyLearningDot hold={hold} />
            </Btn>
          ) : undefined}
          graphic={<div className="ft-hg">
            <BandG
              value={last.appliedBaseKcal} sd={sd} valueLabel={M.fuelTanulas.chart.kcal(fmtGrouped(last.appliedBaseKcal))}
              tick={last.formulaBaseKcal} tickLabel={T.bandFormula(fmtGrouped(last.formulaBaseKcal))}
              label={T.bandAria(fmtGrouped(last.appliedBaseKcal), String(sd), fmtGrouped(last.formulaBaseKcal))}
            />
          </div>}
        >
        </Hero>
      ) : (
        <Hero
          label={T.offLabel}
          verdict={T.offVerdict(fmtGrouped(last.formulaBaseKcal))}
          sub={T.offSub(fmtGrouped(last.posteriorBaseKcal), String(sd))}
          actions={<Btn onClick={() => navigate('/settings/fuel')}>{T.turnOn}</Btn>}
          graphic={<div className="ft-hg">
            <BandG
              value={last.posteriorBaseKcal} sd={sd} valueLabel={M.fuelTanulas.chart.kcal(fmtGrouped(last.posteriorBaseKcal))}
              tick={last.formulaBaseKcal} tickLabel={T.bandFormula(fmtGrouped(last.formulaBaseKcal))}
              label={T.bandAria(fmtGrouped(last.posteriorBaseKcal), String(sd), fmtGrouped(last.formulaBaseKcal))}
            />
          </div>}
        >
        </Hero>
      )}

      {last && (
        <>
          <Section n={++n} title={T.secWeeks(weeksSpan(weeks))} />
          <Card className="ft-weeks-card"><LearningHistoryChart weeks={weeks} /></Card>
        </>
      )}

      <Section n={++n} title={T.secDays} />
      <Card className="ft-days"><LearningDaysList mode={mode} /></Card>

      {last && (
        <>
          <Section n={++n} title={T.secDetails} />
          <Card className="ft-details"><LearnedBaseExplainer /></Card>
        </>
      )}

      {weeklyOpen && card && <WeeklyLearningSheet card={card} onClose={() => setWeeklyOpen(false)} />}
    </Page>
  )
}

/** The empty hero's graphic: how far the two conditions of a first learned week stand (prototype: „SZÁMOLHATÓ" —
 *  `useIntakeDays` over the last 28 days + this week's weigh-ins from the weight log; both existing reads). */
function EmptyNeed() {
  const T = useM().fuelTanulas.page
  const [today] = useState(() => localDateString())
  const { days } = useIntakeDays(addDays(today, -28), addDays(today, -1))
  const { weightLog } = useWeight()
  const logged = days.filter(d => d.status !== 'unlogged').length
  const monday = mondayOf(today)
  const weighIns = new Set(weightLog.map(w => w.date.slice(0, 10)).filter(d => d >= monday && d <= today)).size
  const pct = (have: number, need: number) => Math.min(100, (have / need) * 100)
  return (
    <div className="ft-need ft-hg">
      <span><small>{T.needDays}</small><Level pct={pct(logged, NEED_LOGGED_DAYS)} height={18} value={T.needValue(logged, NEED_LOGGED_DAYS)} /></span>
      <span><small>{T.needWeighIns}</small><Level pct={pct(weighIns, NEED_WEIGH_INS)} height={18} value={T.needValue(weighIns, NEED_WEIGH_INS)} /></span>
    </div>
  )
}

/** Calendar weeks the chart spans, gaps included (its x axis). */
function weeksSpan(weeks: { weekStart: string }[]): number {
  const first = Date.parse(weeks[0].weekStart)
  const lastStart = Date.parse(weeks[weeks.length - 1].weekStart)
  return Math.round((lastStart - first) / (7 * 86_400_000)) + 1
}
