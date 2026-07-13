import { useState } from 'react'
import { useTodayScenario, useToday, useCheckins, useCompanionNote, resolveBriefing } from '@/data/hooks'
import { BrandRow } from '@/features/today/components/BrandRow'
import { GreetingHeader } from '@/features/today/components/GreetingHeader'
import { DayArc } from '@/features/today/components/DayArc'
import { BriefingCard } from '@/features/today/components/BriefingCard'
import { WorkoutTeaser } from '@/features/today/components/WorkoutTeaser'
import { VolleyballCard } from '@/features/today/components/VolleyballCard'
import { VulnerabilityCard } from '@/features/today/components/VulnerabilityCard'
import { FuelTimelinePreview } from '@/features/today/components/FuelTimelinePreview'
import { QuickStatsRow } from '@/features/today/components/QuickStatsRow'
import { GrowthTodayRow } from '@/features/today/components/GrowthTodayRow'
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
      <GreetingHeader today={today} user={user} retaDay={scenario.retaDay} />
      <DayArc checkins={checkins} workoutTime={workoutTime} />
      {workout ? (
        <WorkoutTeaser workout={workout} niggle={scenario.niggle} time={workoutTime} prediction={prediction} />
      ) : (
        todaySport && <VolleyballCard session={todaySport} note={volleyballNote} />
      )}
      <BriefingCard briefing={briefing ?? resolveBriefing(scenario.dayState)} demo={briefingDemo} />
      {companionNote && <CompanionNoteCard note={companionNote} />}
      {scenario.vulnerable && <VulnerabilityCard />}
      <CheckInStrip checkins={checkins} onCheckIn={setCheckInIdx} />
      {workout && todaySport && <VolleyballCard session={todaySport} note={volleyballNote} />}
      <QuickStatsRow />
      <FuelTimelinePreview />
      <GrowthTodayRow />
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
