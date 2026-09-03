// ============================================================
// Mezo · PrepHetiZonaPage — the prep mosaic's Heti zóna tile opened into its
// own page (mezo-d20.3.8). Source: session-body.html #page-zona. Compact
// hero (done/planned workout count) + stat strip + the existing WeekZoneCard
// bars (done → today → plan segments over the optimal zone) reused verbatim —
// the live weekly zone context is unchanged, only its frame moves off the hub.
// ============================================================
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { WeekZoneCard } from '@/features/train/components/WeekZoneCard'
import type { WeekZoneRow } from '@/features/train/logic/weekZone'

export function PrepHetiZonaPage({ rows, doneWorkouts, planWorkouts, onBack }: {
  rows: WeekZoneRow[]
  doneWorkouts: number
  planWorkouts: number
  onBack: () => void
}) {
  const doneSets = rows.reduce((s, r) => s + r.doneSets, 0)
  const todaySets = rows.reduce((s, r) => s + r.todaySets, 0)
  const plannedSets = rows.reduce((s, r) => s + r.plannedSets, 0)
  return (
    <MozaikPage tone="gold">
      <PageHead label="‹ Indítás" onBack={onBack} />
      <PageHero icon="i-edzes" big={`${doneWorkouts}/${planWorkouts}`} name="Heti zóna" />
      <PageBody principle="A zóna sosem büntet: ami a sáv alatt van, az csak információ — a terv is tud alkalmazkodni.">
        <StatStrip className="mt-sm">
          <StatCell value={doneSets} label="kész szett" />
          {todaySets > 0 && <StatCell value={`+${todaySets}`} label="ma jön" />}
          <StatCell value={plannedSets} label="heti terv" />
        </StatStrip>
        <div className="mt-md">
          <WeekZoneCard rows={rows} doneWorkouts={doneWorkouts} planWorkouts={planWorkouts} />
        </div>
      </PageBody>
    </MozaikPage>
  )
}
