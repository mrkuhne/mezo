import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoal, useGoalActions, useGoalOverview } from '@/data/hooks'
import { GoalConnectionTimeline } from '@/features/me/components/GoalConnectionTimeline'
import { GoalDetailHero } from '@/features/me/components/GoalDetailHero'
import { AttachPlanSheet, type AttachPlanType } from '@/features/me/sheets/AttachPlanSheet'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export function GoalPlansPage() {
  const navigate = useNavigate()
  const { goalId, pending: goalPending } = useGoal()
  const { overview, pending } = useGoalOverview(goalId)
  const { detachPlan, pending: writePending } = useGoalActions()
  const [attachType, setAttachType] = useState<AttachPlanType | null>(null)
  const loading = goalPending || pending
  const invalid = overview?.courseStatus === 'invalid'

  return <MozaikPage tone="sky" className="goal-detail-page goal-detail-plans-page">
    <PageHead onBack={() => navigate('/me/goals/weight')} label="‹ Cél" />
    {loading ? <div className="goal-detail-loading" role="status" aria-label="Betöltés…"><span /><span /><span /></div> : !overview || invalid ? (
      <EntranceGroup><PageHero icon="i-meso" name="Tervkapcsolatok" big="Céljavítás szükséges" /><PageBody><div className="goal-detail-notice rise">A kapcsolati idővonal a cél javítása után áll helyre.</div></PageBody></EntranceGroup>
    ) : <EntranceGroup>
      <PageBody principle="A mesociklus önmagában nem emeli a kalóriát: a szakaszokat és a guardokat adja. Az edzőtermi/sport heti rend és a futóterv sessionjei módosítják az EAT-et.">
        <GoalDetailHero
          tone="plans"
          icon="i-meso"
          name="Tervkapcsolatok"
          eyebrow="Cél alatt futó tervek"
          big={`${overview.plans.activeLinkCount} aktív`}
          description="A célablak egy helyen mutatja a kapcsolt edzésterveket, a heti sportot és a lefedetlen részeket."
          stats={[
            { label: 'Lefedve', value: `${Math.max(0, overview.totalWeeks - overview.plans.uncoveredWeekCount)} hét` },
            { label: 'Fedezetlen', value: `${overview.plans.uncoveredWeekCount} hét` },
            { label: 'Sport', value: `${overview.plans.sportSchedule.length} időpont` },
          ]}
        />
        <div className="goal-detail-section-head rise"><span>Cél alatt fut</span><span>{overview.totalWeeks} hét</span></div>
        <GoalConnectionTimeline plans={overview.plans} totalWeeks={overview.totalWeeks} onDetach={goalId && !writePending ? (linkId) => { void detachPlan(goalId, linkId) } : undefined} />
        <section className="goal-attach-card rise">
          <div><span className="goal-detail-kicker">Kapcsolatok bővítése</span><strong>Adj tervet a célablakhoz</strong></div>
          <div className="goal-attach-actions">
            <button type="button" className="np-press" onClick={() => setAttachType('mesocycle')}>＋ Mesociklus csatolása</button>
            <button type="button" className="np-press" onClick={() => setAttachType('running_block')}>＋ Futóblokk csatolása</button>
          </div>
        </section>
      </PageBody>
    </EntranceGroup>}
    {attachType && goalId && <AttachPlanSheet planType={attachType} goalId={goalId} onClose={() => setAttachType(null)} />}
  </MozaikPage>
}
