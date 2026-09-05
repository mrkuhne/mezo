import { useNavigate } from 'react-router-dom'
import { useGoal, useGoalOverview } from '@/data/hooks'
import { GoalSegmentRail } from '@/features/me/components/GoalSegmentRail'
import { GoalDetailHero } from '@/features/me/components/GoalDetailHero'
import { hu1 } from '@/shared/lib/huNum'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export function GoalSegmentPage() {
  const navigate = useNavigate()
  const { goalId, pending: goalPending } = useGoal()
  const { overview, pending } = useGoalOverview(goalId)
  const loading = goalPending || pending
  const invalid = overview?.courseStatus === 'invalid'
  const segment = overview?.segment

  return <MozaikPage tone="gold" className="goal-detail-page goal-detail-segment-page">
    <PageHead onBack={() => navigate('/me/goals/weight')} label="‹ Cél" />
    {loading ? <div className="goal-detail-loading" role="status" aria-label="Betöltés…"><span /><span /><span /></div> : !overview || invalid ? (
      <EntranceGroup><PageHero icon="i-retegek" name="Aktuális szakasz" big="Céljavítás szükséges" /><PageBody><div className="goal-detail-notice rise">A szakasz csak koherens célhoz jeleníthető meg.</div></PageBody></EntranceGroup>
    ) : !segment?.available || !segment.label || segment.fromWeek == null || segment.toWeek == null ? (
      <EntranceGroup><PageHero icon="i-retegek" name="Aktuális szakasz" big="Nincs aktív szakasz" /><PageBody><div className="goal-detail-notice rise">A célhoz még nem készült szakaszolt terv.</div></PageBody></EntranceGroup>
    ) : <EntranceGroup>
      <PageBody principle="A szakasz a stratégiát rendezi, nem duplázza a mozgásból számolt energiát.">
        <GoalDetailHero
          tone="segment"
          icon="i-retegek"
          name="Aktuális szakasz"
          eyebrow={`Aktuális szakasz · W${segment.fromWeek}–${segment.toWeek}`}
          big={segment.label}
          description="A terhelési fázis a szakaszolást és a védőkorlátokat hangolja, az energiafelhasználást nem találja ki."
          stats={[
            { label: 'Hátra', value: segment.remainingDays == null ? '—' : `${segment.remainingDays} nap` },
            { label: 'Következő', value: segment.nextLabel ?? 'Nincs' },
            { label: 'Heti cél', value: overview.targetRateKgPerWeek == null ? '—' : `${overview.targetRateKgPerWeek < 0 ? '−' : '+'}${hu1(Math.abs(overview.targetRateKgPerWeek))} kg` },
          ]}
        />
        <div className="goal-detail-section-head rise"><span>A teljes ív</span><span>{overview.totalWeeks} hét</span></div>
        <GoalSegmentRail label={segment.label} fromWeek={segment.fromWeek} toWeek={segment.toWeek} nextLabel={segment.nextLabel} nextFromWeek={segment.nextFromWeek} nextChangeDate={segment.nextChangeDate} />
        <section className="goal-detail-card goal-segment-note rise"><div className="goal-detail-kicker">Mit változtat?</div><p>A fázis módosíthatja a védőkorlátokat és a szakaszolást, de önmagában nem becsül új kalóriaégetést.</p></section>
      </PageBody>
    </EntranceGroup>}
  </MozaikPage>
}
