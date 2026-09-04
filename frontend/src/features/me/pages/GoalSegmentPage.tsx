import { useNavigate } from 'react-router-dom'
import { useGoal, useGoalOverview } from '@/data/hooks'
import { GoalSegmentRail } from '@/features/me/components/GoalSegmentRail'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export function GoalSegmentPage() {
  const navigate = useNavigate()
  const { goalId, pending: goalPending } = useGoal()
  const { overview, pending } = useGoalOverview(goalId)
  const loading = goalPending || pending
  const invalid = overview?.courseStatus === 'invalid'
  const segment = overview?.segment

  return <MozaikPage tone="gold">
    <PageHead onBack={() => navigate('/me/goals/weight')} label="‹ Cél" />
    {loading ? <div className="goal-detail-loading" role="status" aria-label="Betöltés…"><span /><span /><span /></div> : !overview || invalid ? (
      <EntranceGroup><PageHero icon="i-retegek" name="Aktuális szakasz" big="Céljavítás szükséges" /><PageBody><div className="goal-detail-notice rise">A szakasz csak koherens célhoz jeleníthető meg.</div></PageBody></EntranceGroup>
    ) : !segment?.available || !segment.label || segment.fromWeek == null || segment.toWeek == null ? (
      <EntranceGroup><PageHero icon="i-retegek" name="Aktuális szakasz" big="Nincs aktív szakasz" /><PageBody><div className="goal-detail-notice rise">A célhoz még nem készült szakaszolt terv.</div></PageBody></EntranceGroup>
    ) : <EntranceGroup>
      <PageHero icon="i-retegek" name="Aktuális szakasz" big={segment.label} sub={`W${segment.fromWeek}–${segment.toWeek}${segment.remainingDays != null ? ` · ${segment.remainingDays} nap hátra` : ''}`} />
      <PageBody principle="A szakasz a stratégiát rendezi, nem duplázza a mozgásból számolt energiát.">
        <GoalSegmentRail label={segment.label} fromWeek={segment.fromWeek} toWeek={segment.toWeek} nextLabel={segment.nextLabel} nextFromWeek={segment.nextFromWeek} nextChangeDate={segment.nextChangeDate} />
        <section className="goal-detail-card goal-segment-note rise"><div className="goal-detail-kicker">Mit változtat?</div><p>A fázis módosíthatja a védőkorlátokat és a szakaszolást, de önmagában nem becsül új kalóriaégetést.</p></section>
      </PageBody>
    </EntranceGroup>}
  </MozaikPage>
}
