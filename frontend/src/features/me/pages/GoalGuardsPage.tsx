import { useNavigate } from 'react-router-dom'
import { useGoal, useGoalOverview } from '@/data/hooks'
import { GoalGuardCard } from '@/features/me/components/GoalGuardCard'
import { GoalDetailHero } from '@/features/me/components/GoalDetailHero'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const ISSUE: Record<string, string> = {
  strength_breached: 'Az erővédelem jelzett — nézd át a terhelést és a célütemet.',
  muscle_below_maintenance: 'Van izomcsoport a fenntartó volumen alatt.',
  rate_cap_exceeded: 'A célütem az izomvédő plafon fölé került.',
  protein_unmonitored: 'A fehérjecél még nincs Fuel-adattal ellenőrizve.',
}

export function GoalGuardsPage() {
  const navigate = useNavigate()
  const { goalId, pending: goalPending } = useGoal()
  const { overview, pending } = useGoalOverview(goalId)
  const loading = goalPending || pending
  const invalid = overview?.courseStatus === 'invalid'
  const status = overview?.guards.status

  return <MozaikPage tone="lav" className="goal-detail-page goal-detail-guards-page">
    <PageHead onBack={() => navigate('/me/goals/weight')} label="‹ Cél" />
    {loading ? <div className="goal-detail-loading" role="status" aria-label="Betöltés…"><span /><span /><span /></div> : !overview || invalid ? (
      <EntranceGroup><PageHero icon="i-eletjel" name="Védőkorlátok" big="Céljavítás szükséges" /><PageBody><div className="goal-detail-notice rise">A védőkorlátok a cél javítása után értékelhetők újra.</div></PageBody></EntranceGroup>
    ) : <EntranceGroup>
      <PageBody principle="A védőkorlát lassít vagy jelez; nem büntet és nem diagnosztizál.">
        <GoalDetailHero
          tone="guards"
          icon="i-eletjel"
          name="Védőkorlátok"
          eyebrow="Célbiztonság"
          big={`${overview.guards.healthyCount} / ${overview.guards.totalCount}`}
          description="A cél az erőt, az izomvolument és a tartható ütemet együtt figyeli; ami bizonytalan, azt külön jelzi."
          stats={[
            { label: 'Rendben', value: `${overview.guards.healthyCount} jel` },
            { label: 'Figyelendő', value: `${Math.max(0, overview.guards.totalCount - overview.guards.healthyCount)} jel` },
            { label: 'Összesen', value: `${overview.guards.totalCount} jel` },
          ]}
        />
        <div className="goal-detail-section-head rise"><span>Állapotok</span></div>
        {overview.guards.topIssueCode && <div className="goal-guard-warning rise">{ISSUE[overview.guards.topIssueCode] ?? 'Az egyik védőkorlát figyelmet kér.'}</div>}
        {status ? <div className="goal-guard-grid">
          <GoalGuardCard kind="strength" status={status.strength} />
          <GoalGuardCard kind="muscle" status={status.muscle} />
        </div> : <div className="goal-detail-notice rise">Még nincs értékelhető guard állapot.</div>}
      </PageBody>
    </EntranceGroup>}
  </MozaikPage>
}
