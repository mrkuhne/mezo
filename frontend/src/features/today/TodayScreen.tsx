import { useState } from 'react'
import { useTodayScenario, useToday, useCheckins, resolveBriefing } from '@/data/hooks'
import { BrandRow } from '@/features/today/components/BrandRow'
import { RetaPhaseSection } from '@/features/today/components/RetaPhaseSection'
import { DateMesoHeader } from '@/features/today/components/DateMesoHeader'
import { BriefingCard } from '@/features/today/components/BriefingCard'
import { WorkoutTeaser } from '@/features/today/components/WorkoutTeaser'
import { VolleyballCard } from '@/features/today/components/VolleyballCard'
import { VulnerabilityCard } from '@/features/today/components/VulnerabilityCard'
import { FuelTimelinePreview } from '@/features/today/components/FuelTimelinePreview'
import { QuickStatsRow } from '@/features/today/components/QuickStatsRow'
import { InsightsTeaser } from '@/features/today/components/InsightsTeaser'
import { CheckInStrip } from '@/features/today/CheckInStrip'
import { CheckInSheet } from '@/features/today/CheckInSheet'
import { AnchorModeView } from '@/features/today/AnchorModeView'

export function TodayScreen() {
  const scenario = useTodayScenario()
  const { today, user, workout, volleyballSessions } = useToday()
  const { checkins, saveCheckIn } = useCheckins()
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)

  if (scenario.anchorMode) return <AnchorModeView />

  const todaySport = volleyballSessions.find(s => s.today)

  return (
    <>
      <BrandRow />
      <RetaPhaseSection day={scenario.retaDay} />
      <DateMesoHeader today={today} user={user} />
      <BriefingCard briefing={resolveBriefing(scenario.dayState)} />
      <CheckInStrip checkins={checkins} onCheckIn={setCheckInIdx} />
      <WorkoutTeaser workout={workout} niggle={scenario.niggle} />
      <VolleyballCard session={todaySport} />
      {scenario.vulnerable && <VulnerabilityCard />}
      <FuelTimelinePreview />
      <QuickStatsRow />
      <InsightsTeaser />
      {checkInIdx !== null && (
        <CheckInSheet
          slot={checkins[checkInIdx]}
          slotIdx={checkInIdx}
          onClose={() => setCheckInIdx(null)}
          onSave={data => saveCheckIn(checkInIdx, data)}
        />
      )}
    </>
  )
}
