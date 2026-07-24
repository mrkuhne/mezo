import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTodayScenario, useToday, useCheckins, useCompanionNote, resolveBriefing } from '@/data/hooks'
import { AppHero } from '@/features/progression/components/AppHero'
import { Icon } from '@/shared/ui/Icon'
import { GreetingHeader } from '@/features/today/components/GreetingHeader'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { WindDownBanner } from '@/features/today/components/WindDownBanner'
import { DayArc } from '@/features/today/components/DayArc'
import { BriefingCard } from '@/features/today/components/BriefingCard'
import { WorkoutTeaser } from '@/features/today/components/WorkoutTeaser'
import { VolleyballCard } from '@/features/today/components/VolleyballCard'
import { VulnerabilityCard } from '@/features/today/components/VulnerabilityCard'
import { FuelTimelinePreview } from '@/features/today/components/FuelTimelinePreview'
import { QuickStatsRow } from '@/features/today/components/QuickStatsRow'
import { TodayQuestsCard } from '@/features/today/components/TodayQuestsCard'
import { RoutineCard } from '@/features/today/components/RoutineCard'
import { ZoneDivider } from '@/features/today/components/ZoneDivider'
import { CheckInStrip } from '@/features/today/components/CheckInStrip'
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { AnchorModeView } from '@/features/today/pages/AnchorModeView'

/**
 * Action-first zones (mezo-gj2y): Most (greeting + arc + hero) → Teendők ma (quests +
 * check-in) → A napod (briefing, notes, stats, fuel). The vulnerability card stays above
 * the action zone deliberately — tone lands before demands (ADR 0010 spirit).
 */
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
  const nextCheckinIdx = checkins.findIndex(c => c.state === 'now' || c.state === 'pending')

  return (
    <>
      <AppHero
        utilities={
          <>
            <button className="chip" aria-label="Keresés"><Icon name="search" size={12} /></button>
            <Link to="/insights" aria-label="Insights" className="icon-btn"><Icon name="sparkle" size={18} /></Link>
          </>
        }
      />
      <GreetingHeader today={today} user={user} retaDay={scenario.retaDay} />
      <IntentionBanner />
      <WindDownBanner />
      <DayArc checkins={checkins} workoutTime={workoutTime} />
      {workout ? (
        <WorkoutTeaser workout={workout} niggle={scenario.niggle} time={workoutTime} prediction={prediction} />
      ) : (
        todaySport && <VolleyballCard session={todaySport} note={volleyballNote} />
      )}
      {scenario.vulnerable && <VulnerabilityCard />}
      <ZoneDivider label="Teendők ma" />
      <TodayQuestsCard
        onCheckIn={nextCheckinIdx >= 0 ? () => setCheckInIdx(nextCheckinIdx) : undefined}
      />
      <RoutineCard />
      <CheckInStrip checkins={checkins} onCheckIn={setCheckInIdx} />
      <ZoneDivider label="A napod" />
      <BriefingCard briefing={briefing ?? resolveBriefing(scenario.dayState)} demo={briefingDemo} />
      {companionNote && <CompanionNoteCard note={companionNote} />}
      {workout && todaySport && <VolleyballCard session={todaySport} note={volleyballNote} />}
      <QuickStatsRow />
      <FuelTimelinePreview />
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
