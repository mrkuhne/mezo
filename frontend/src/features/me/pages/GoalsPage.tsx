import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBiometricProfile, useGoal, useGoalOverview } from '@/data/hooks'
import { GoalCourseHero } from '@/features/me/components/GoalCourseHero'
import { GoalGate } from '@/features/me/components/GoalGate'
import GoalsSkeleton from '@/features/me/pages/GoalsSkeleton'
import { TRAJECTORY_LABEL } from '@/features/me/logic/goalLabels'
import { Icon3D } from '@/shared/ui/clay'
import { MozaikPage, Mosaic, PageBody, PageHead, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { hu1 } from '@/shared/lib/huNum'

const DAY_TYPE = {
  training: 'Edzésnap',
  rest: 'Pihenőnap',
  uniform: 'Egységes keret',
  unavailable: 'Nem elérhető',
} as const

function kcal(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value).toLocaleString('hu-HU')} kcal`
}

function TileLine({ value, meta }: { value: ReactNode; meta: string }) {
  return <span className="goal-tile-copy"><strong>{value}</strong><small>{meta}</small><em>Részletek ›</em></span>
}

export function GoalsPage() {
  const navigate = useNavigate()
  const { goal, goalResponse, goalId, pending: goalPending } = useGoal()
  const { overview, pending: overviewPending } = useGoalOverview(goalId)
  const { isComplete: biometricComplete } = useBiometricProfile()
  const [gateOpen, setGateOpen] = useState(false)

  const startNewGoal = () => {
    if (biometricComplete) navigate('/me/goals/weight/new')
    else setGateOpen(true)
  }

  if (goalPending || overviewPending) return <GoalsSkeleton />

  if (!goal || !goalResponse || !goalId || !overview) {
    return (
      <MozaikPage tone="coral" className="goal-hub-page goal-hub-empty">
        <PageHead glass onBack={() => navigate('/me')} label="Én" />
        <PageBody className="goal-empty-body">
          {/* Üveg empty state (mezo-me75u.6): a frameless halo + ONE dashed free tile — never glass */}
          <div className="goal-empty-hero uv-halo">
            <Icon3D name="t-weight" size={84} className="goal-empty-art uv-float" />
            <p>Még nincs aktív célod — hozz létre egyet, és a Mezo köré szervezi a terveket.</p>
          </div>
          <button type="button" className="goal-empty-new uv-empty np-press" onClick={startNewGoal}>
            <Icon3D name="t-down" size={40} />
            <strong>＋ Új cél</strong>
          </button>
        </PageBody>
        {gateOpen && <GoalGate onClose={() => setGateOpen(false)} onComplete={() => navigate('/me/goals/weight/new')} />}
      </MozaikPage>
    )
  }

  const dietAvailable = overview.courseStatus !== 'invalid' && overview.diet.todayKcal != null
  const segmentRange = overview.segment.available && overview.segment.fromWeek != null && overview.segment.toWeek != null
    ? `W${overview.segment.fromWeek}–${overview.segment.toWeek} · még ${overview.segment.remainingDays ?? '—'} nap`
    : 'Még nincs aktív szakasz'
  const macroLine = dietAvailable
    ? `${DAY_TYPE[overview.diet.todayDayType]} · P ${overview.diet.proteinG ?? '—'} · C ${overview.diet.carbsG ?? '—'} · F ${overview.diet.fatG ?? '—'}`
    : 'A cél beállítása után számolható'

  return (
    <MozaikPage tone="coral" className="goal-hub-page">
      <PageHead glass onBack={() => navigate('/me')} label="Én">
        <button type="button" className="pgact goal-new-pill np-press" onClick={startNewGoal}>＋ Új cél</button>
      </PageHead>
      <EntranceGroup>
        <PageBody className="goal-hub-body">
          <div className="goal-hub-title rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            <span className="mz-eyebrow">{overview.title} · aktív</span>
            <h2>A célod ma</h2>
          </div>

          <GoalCourseHero
            overview={overview}
            onOpenWeight={() => navigate('/me/weight')}
            onRepair={() => navigate('/me/goals/weight/settings')}
          />

          <Mosaic className="goal-hub-mosaic">
            <Tile
              wash="sage" art="t-bowl" className="glass" iconSize={40} eyebrow="Mai étrendi keret" delayMs={80}
              aria-label={`Mai étrendi keret, ${dietAvailable ? kcal(overview.diet.todayKcal) : 'Céljavítás szükséges'}`}
              onClick={() => navigate('/me/goals/weight/diet')}
              line={<TileLine value={dietAvailable ? kcal(overview.diet.todayKcal) : 'Céljavítás szükséges'} meta={macroLine} />}
            />
            <Tile
              wash="gold" art="t-peak" className="glass" iconSize={40} eyebrow="Aktuális szakasz" delayMs={140}
              aria-label={`Aktuális szakasz, ${overview.segment.label ?? 'nincs'}`}
              onClick={() => navigate('/me/goals/weight/segment')}
              line={<TileLine value={overview.segment.label ?? '—'} meta={segmentRange} />}
            />
            <Tile
              wash="sky" art="t-calendar" className="glass" iconSize={40} eyebrow="Tervkapcsolatok" delayMs={200}
              aria-label={`Tervkapcsolatok, ${overview.plans.activeLinkCount} aktív`}
              onClick={() => navigate('/me/goals/weight/plans')}
              line={<TileLine value={`${overview.plans.activeLinkCount} aktív`} meta={overview.plans.uncoveredWeekCount > 0 ? `${overview.plans.uncoveredWeekCount} hét még fedezetlen` : 'A teljes célablak lefedve'} />}
            />
            <Tile
              wash="lav" art="t-shield" className="glass" iconSize={40} eyebrow="Védőkorlátok" delayMs={260}
              aria-label={`Védőkorlátok, ${overview.guards.healthyCount} a ${overview.guards.totalCount}-ből rendben`}
              onClick={() => navigate('/me/goals/weight/guards')}
              line={<TileLine value={`${overview.guards.healthyCount}/${overview.guards.totalCount}`} meta={overview.guards.topIssueCode ? 'Van egy figyelendő jel' : 'Minden aktív védelem rendben'} />}
            />
            {overview.openSuggestionCount > 0 && overview.latestSuggestionId && (
              <Tile
                wash="coral" art="t-note" className="glass goal-tile-badged" iconSize={40} eyebrow="Új javaslat" badge={overview.openSuggestionCount} delayMs={320}
                aria-label={`Új javaslat, ${overview.openSuggestionCount} áttekintésre vár`}
                onClick={() => navigate(`/me/goals/weight/suggestions/${overview.latestSuggestionId}`)}
                line={<TileLine value={`${overview.openSuggestionCount} javaslat`} meta="Változások áttekintése" />}
              />
            )}
            <Tile
              wash="white" art="t-gear" className="glass" iconSize={40} eyebrow="Cél beállításai" delayMs={380}
              aria-label="Cél beállításai"
              onClick={() => navigate('/me/goals/weight/settings')}
              line={<TileLine value={overview.targetWeightKg == null ? TRAJECTORY_LABEL[overview.trajectory] : `${hu1(overview.targetWeightKg)} kg`} meta={`${TRAJECTORY_LABEL[overview.trajectory]} · W${overview.currentWeek}/${overview.totalWeeks}`} />}
            />
          </Mosaic>
        </PageBody>
      </EntranceGroup>
      {gateOpen && <GoalGate onClose={() => setGateOpen(false)} onComplete={() => navigate('/me/goals/weight/new')} />}
    </MozaikPage>
  )
}
