import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoal, useGoalOverview } from '@/data/hooks'
import { EditGoalSheet } from '@/features/me/sheets/EditGoalSheet'
import { TRAJECTORY_LABEL } from '@/features/me/logic/goalLabels'
import { huMonthDay } from '@/shared/lib/dates'
import { hu1 } from '@/shared/lib/huNum'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export function GoalSettingsPage() {
  const navigate = useNavigate()
  const { goal, goalResponse, goalId, pending: goalPending } = useGoal()
  const { overview, pending } = useGoalOverview(goalId)
  const [editing, setEditing] = useState(false)
  const loading = goalPending || pending
  const invalid = overview?.courseStatus === 'invalid'

  const rate = overview?.targetRateKgPerWeek
  const rateLabel = rate == null ? '—' : `${rate < 0 ? '−' : '+'}${hu1(Math.abs(rate))} kg/hét`
  const target = overview?.targetWeightKg
  const guardStatus = overview?.guards.status

  return <MozaikPage tone="rose">
    <PageHead onBack={() => navigate('/me/goals/weight')} label="‹ Cél" />
    {loading ? <div className="goal-detail-loading" role="status" aria-label="Betöltés…"><span /><span /><span /></div> : !overview || invalid ? (
      <EntranceGroup><PageHero icon="i-beallitas" name="Cél beállításai" big="Céljavítás szükséges" /><PageBody><div className="goal-detail-notice rise">Nyisd meg a szerkesztőt az ellentmondó céladatok javításához.</div>{goal && goalResponse && goalId && <button className="goal-settings-edit np-press rise" type="button" onClick={() => setEditing(true)}>Cél szerkesztése</button>}</PageBody></EntranceGroup>
    ) : <EntranceGroup>
      <PageHero icon="i-beallitas" name="Cél beállításai" big={TRAJECTORY_LABEL[overview.trajectory]} sub={overview.title} />
      <PageBody principle="Az archiválás és törlés a szerkesztőn belül, másodlagos művelet marad.">
        <section className="goal-settings-grid rise">
          <div><small>Irány</small><strong>{TRAJECTORY_LABEL[overview.trajectory]}</strong></div>
          <div><small>Súlyút</small><strong>{hu1(overview.currentWeightKg)} kg → {target == null ? 'tartás' : `${hu1(target)} kg`}</strong></div>
          <div><small>Célablak</small><strong>W{overview.currentWeek} / {overview.totalWeeks}</strong></div>
          <div><small>Céltempó</small><strong>{rateLabel}</strong></div>
          <div className="goal-settings-wide"><small>Várható céldátum</small><strong>{overview.projectedTargetDate ? huMonthDay(overview.projectedTargetDate) : 'Még nincs biztos becslés'}</strong></div>
        </section>
        <div className="goal-settings-guards rise">
          <span className={guardStatus?.strength.active ? 'is-on' : ''}>Erővédelem</span>
          <span className={guardStatus?.muscle.active ? 'is-on' : ''}>Izomvédelem</span>
        </div>
        {goal && goalResponse && goalId && <button className="goal-settings-edit np-press rise" type="button" onClick={() => setEditing(true)}>Cél szerkesztése</button>}
      </PageBody>
    </EntranceGroup>}
    {editing && goal && goalResponse && goalId && <EditGoalSheet goal={goal} goalResponse={goalResponse} goalId={goalId} onClose={() => setEditing(false)} />}
  </MozaikPage>
}
