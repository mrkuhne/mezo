import { useNavigate } from 'react-router-dom'
import { useGoal, useGoalOverview } from '@/data/hooks'
import { GoalDietWeekCard } from '@/features/me/components/GoalDietWeekCard'
import { GoalDetailHero } from '@/features/me/components/GoalDetailHero'
import { dietExplanation } from '@/features/me/logic/goalOverviewCopy'
import { huInt } from '@/shared/lib/huNum'
import { MCells, MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const DAY_TYPE = { training: 'Edzésnap', rest: 'Pihenőnap', uniform: 'Egységes keret', unavailable: 'Nem elérhető' } as const
const DAY_COPY = {
  training: 'A heti keretből ma több energia jut az edzés köré, miközben a heti átlag változatlan marad.',
  rest: 'A pihenőnap alacsonyabb kerete a regenerációt követi, miközben a heti átlag változatlan marad.',
  uniform: 'Ma is az egységes napi keret érvényes; nincs külön edzés- és pihenőnapi elosztás.',
  unavailable: 'A napi keret jelenleg nem számolható.',
} as const

export function GoalDietPage() {
  const navigate = useNavigate()
  const { goalId, pending: goalPending } = useGoal()
  const { overview, pending } = useGoalOverview(goalId)
  const loading = goalPending || pending
  const invalid = overview?.courseStatus === 'invalid' || overview?.diet.todayDayType === 'unavailable'

  return <MozaikPage tone="sage" className="goal-detail-page goal-detail-diet-page">
    <PageHead onBack={() => navigate('/me/goals/weight')} label="‹ Cél" />
    {loading ? <div className="goal-detail-loading" role="status" aria-label="Betöltés…"><span /><span /><span /></div> : !overview || invalid ? (
      <EntranceGroup><PageHero icon="i-fuel" name="Mai étrendi keret" big="Céljavítás szükséges" /><PageBody><div className="goal-detail-notice rise">A kalóriakeret csak koherens célból számolható újra.</div></PageBody></EntranceGroup>
    ) : <EntranceGroup>
      <PageBody principle="A napi szám mögött mindig látható marad a heti logika.">
        <GoalDetailHero
          tone="nutrition"
          icon="i-fuel"
          name="Mai étrendi keret"
          eyebrow={`Ma · ${DAY_TYPE[overview.diet.todayDayType]}`}
          big={overview.diet.todayKcal == null ? '—' : `${huInt(overview.diet.todayKcal)} kcal`}
          description={DAY_COPY[overview.diet.todayDayType]}
          stats={[
            { label: 'Heti átlag', value: overview.diet.weekAverageKcal == null ? '—' : huInt(overview.diet.weekAverageKcal) },
            { label: 'Edzésnap', value: overview.diet.trainingDayKcal == null ? '—' : huInt(overview.diet.trainingDayKcal) },
            { label: 'Pihenőnap', value: overview.diet.restDayKcal == null ? '—' : huInt(overview.diet.restDayKcal) },
          ]}
        />
        <div className="goal-detail-section-head rise"><span>Mai makrók</span><span>célérték</span></div>
        <MCells className="goal-detail-macros rise" cells={[
          { label: 'Fehérje', value: overview.diet.proteinG == null ? '—' : `${huInt(overview.diet.proteinG)} g`, tone: 'coral' },
          { label: 'Szénhidrát', value: overview.diet.carbsG == null ? '—' : `${huInt(overview.diet.carbsG)} g`, tone: 'gold' },
          { label: 'Zsír', value: overview.diet.fatG == null ? '—' : `${huInt(overview.diet.fatG)} g`, tone: 'lav' },
        ]} />
        <div className="goal-detail-section-head rise"><span>Heti ritmus</span></div>
        <GoalDietWeekCard trainingDayKcal={overview.diet.trainingDayKcal} restDayKcal={overview.diet.restDayKcal} weekAverageKcal={overview.diet.weekAverageKcal} />
        <section className="goal-provenance rise"><span>{overview.diet.basis === 'adaptive' ? 'Adaptív terv' : 'Formula-alap'}</span><p>{dietExplanation(overview.diet.explanationCode)}</p></section>
      </PageBody>
    </EntranceGroup>}
  </MozaikPage>
}
