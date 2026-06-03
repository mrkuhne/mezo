import { useState } from 'react'
import { useTodayScenario, useToday, useCheckins, resolveBriefing } from '@/data/hooks'
import { BrandRow } from './components/BrandRow'
import { RetaPhaseSection } from './components/RetaPhaseSection'
import { DateMesoHeader } from './components/DateMesoHeader'
import { BriefingCard } from './components/BriefingCard'
import { WorkoutTeaser } from './components/WorkoutTeaser'
import { VolleyballCard } from './components/VolleyballCard'
import { VulnerabilityCard } from './components/VulnerabilityCard'
import { FuelTimelinePreview } from './components/FuelTimelinePreview'
import { QuickStatsRow } from './components/QuickStatsRow'
import { InsightsTeaser } from './components/InsightsTeaser'
import { CheckInStrip } from './CheckInStrip'
import { CheckInSheet } from './CheckInSheet'
import { AnchorModeView } from './AnchorModeView'

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
