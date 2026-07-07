import { useState } from 'react'
import { useTodayScenario, useToday, useCheckins, useCompanionNote, resolveBriefing } from '@/data/hooks'
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
import { CheckInStrip } from '@/features/today/components/CheckInStrip'
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { AnchorModeView } from '@/features/today/pages/AnchorModeView'

export function TodayPage() {
  const scenario = useTodayScenario()
  const {
    today, user, workout, volleyballSessions,
    workoutTime, prediction, volleyballNote, briefing, briefingDemo,
  } = useToday()
  const { checkins, saveCheckIn } = useCheckins()
  const companionNote = useCompanionNote()
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)

  if (scenario.anchorMode) return <AnchorModeView />

  const todaySport = volleyballSessions.find(s => s.today)

  return (
    <>
      <BrandRow />
      <RetaPhaseSection day={scenario.retaDay} />
      <DateMesoHeader today={today} user={user} />
      <BriefingCard briefing={briefing ?? resolveBriefing(scenario.dayState)} demo={briefingDemo} />
      <CheckInStrip checkins={checkins} onCheckIn={setCheckInIdx} />
      {companionNote && <CompanionNoteCard note={companionNote} />}
      {workout && (
        <WorkoutTeaser workout={workout} niggle={scenario.niggle} time={workoutTime} prediction={prediction} />
      )}
      <VolleyballCard session={todaySport} note={volleyballNote} />
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
