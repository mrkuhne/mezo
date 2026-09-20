import { useSettingsOrigin } from '@/features/settings/components/SettingsFrame'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoal, useGoalOverview } from '@/data/hooks'
import { EditGoalSheet } from '@/features/me/sheets/EditGoalSheet'
import { GoalSettingsEditor } from '@/features/me/components/GoalSettingsEditor'
import { GoalDetailHero } from '@/features/me/components/GoalDetailHero'
import { TRAJECTORY_LABEL } from '@/features/me/logic/goalLabels'
import { huMonthDay } from '@/shared/lib/dates'
import { hu1 } from '@/shared/lib/huNum'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export function GoalSettingsPage() {
  const navigate = useNavigate()
  const origin = useSettingsOrigin()
  const { goal, goalResponse, goalId, pending: goalPending, isError: goalError } = useGoal()
  const { overview, pending, isError: overviewError } = useGoalOverview(goalId)
  const [editing, setEditing] = useState(false)
  const loading = goalPending || pending
  const invalid = overview?.courseStatus === 'invalid'

  if (goalError || overviewError) return <MozaikPage tone="rose"><PageHead onBack={() => navigate('/settings/me', { state: origin.state })} label="‹ Én beállításai" /><PageBody><p role="alert">A súlycél nem tölthető be. Próbáld újra később.</p></PageBody></MozaikPage>
  if (!goalPending && !goal) return <MozaikPage tone="rose"><PageHead onBack={() => navigate('/settings/me', { state: origin.state })} label="‹ Én beállításai" /><PageBody><PageHero icon="i-beallitas" name="Súlycél" big="Még nincs aktív cél" /><button className="cta-primary" onClick={() => navigate('/me/goals/weight')}>Cél beállítása</button></PageBody></MozaikPage>

  const rate = overview?.targetRateKgPerWeek
  const rateLabel = rate == null ? '—' : `${rate < 0 ? '−' : '+'}${hu1(Math.abs(rate))} kg/hét`
  const target = overview?.targetWeightKg

  return <MozaikPage tone="rose" className="goal-detail-page goal-detail-settings-page">
    <PageHead onBack={() => navigate('/settings/me', { state: origin.state })} label="‹ Én beállításai" />
    {loading ? <div className="goal-detail-loading" role="status" aria-label="Betöltés…"><span /><span /><span /></div> : !overview || invalid ? (
      <EntranceGroup><PageHero icon="i-beallitas" name="Cél beállításai" big="Céljavítás szükséges" /><PageBody><div className="goal-detail-notice rise">Módosítsd a célsúlyt és a tempót az ellentmondó céladatok javításához.</div>{goal && goalResponse && <GoalSettingsEditor key={goalResponse.id} goal={goalResponse} currentWeight={goal.currentWeight} />}{goal && goalResponse && goalId && <button className="goal-settings-edit np-press rise" type="button" onClick={() => setEditing(true)}>Cél szerkesztése</button>}</PageBody></EntranceGroup>
    ) : <EntranceGroup>
      <PageBody principle="Az archiválás és törlés a szerkesztőn belül, másodlagos művelet marad.">
        <GoalDetailHero
          tone="settings"
          icon="i-beallitas"
          name="Cél beállításai"
          eyebrow={`${overview.title} · aktív`}
          big={target == null ? TRAJECTORY_LABEL[overview.trajectory] : `${hu1(target)} kg`}
          description={`${hu1(overview.currentWeightKg)} kg-ról indulva, ${TRAJECTORY_LABEL[overview.trajectory].toLocaleLowerCase('hu-HU')} iránnyal.`}
          stats={[
            { label: 'Most', value: `${hu1(overview.currentWeightKg)} kg` },
            { label: 'Hátra', value: overview.remainingKg == null ? '—' : `${hu1(overview.remainingKg)} kg` },
            { label: 'Teljesült', value: overview.completionPct == null ? '—' : `${Math.round(overview.completionPct)}%` },
          ]}
        />
        {goalResponse && <GoalSettingsEditor key={goalResponse.id} goal={goalResponse} currentWeight={overview.currentWeightKg} />}
        <div className="goal-detail-section-head rise"><span>Jelenleg mentett cél</span></div>
        <section className="goal-settings-grid rise">
          <div><small>Irány</small><strong>{TRAJECTORY_LABEL[overview.trajectory]}</strong></div>
          <div><small>Súlyút</small><strong>{hu1(overview.currentWeightKg)} kg → {target == null ? 'tartás' : `${hu1(target)} kg`}</strong></div>
          <div><small>Célablak</small><strong>W{overview.currentWeek} / {overview.totalWeeks}</strong></div>
          <div><small>Céltempó</small><strong>{rateLabel}</strong></div>
          <div className="goal-settings-wide"><small>Várható céldátum</small><strong>{overview.projectedTargetDate ? huMonthDay(overview.projectedTargetDate) : 'Még nincs biztos becslés'}</strong></div>
        </section>
        <div className="goal-settings-guards rise">
          <span className={goalResponse?.guards.includes('strength') ? 'is-on' : ''}>Erővédelem</span>
          <span className={goalResponse?.guards.includes('muscle') ? 'is-on' : ''}>Izomvédelem</span>
        </div>
        {goal && goalResponse && goalId && <button className="goal-settings-edit np-press rise" type="button" onClick={() => setEditing(true)}>Cél szerkesztése</button>}
      </PageBody>
    </EntranceGroup>}
    {editing && goal && goalResponse && goalId && <EditGoalSheet goal={goal} goalResponse={goalResponse} goalId={goalId} onClose={() => setEditing(false)} />}
  </MozaikPage>
}
