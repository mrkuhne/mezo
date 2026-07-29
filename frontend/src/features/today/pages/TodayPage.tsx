// ============================================================
// Mezo · TodayPage — the Mai screen's composition root (mezo-j7u4).
// The screen has three sleep-anchored daypart faces (dayFace.ts); `?dp=` is the
// single source of truth for which one renders, derived from the URL and never
// mirrored into state — the TrainTodayPage `?day=` precedent, including its two
// traps: `params.get()` returns `null` when absent and `''` when blank, and both
// must mean "the current face" rather than falling through to a parsed value.
// Every source is normalized by todayItems.ts, so this file only wires hooks to
// faces and dispatches row actions; it holds no per-domain branching.
// ============================================================
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  useActivities, useCheckins, useCompanionNote, useDailyQuests, useFuelPreview, useHabitActions,
  useHabitDay, useQuickStats, useRitualDay, useSleepGoal, useToday,
  useTodayScenario, useWaterActions, resolveBriefing,
} from '@/data/hooks'
import { AppHero } from '@/features/progression/components/AppHero'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { GreetingHeader } from '@/features/today/components/GreetingHeader'
import { DayFaceStrip } from '@/features/today/components/DayFaceStrip'
import { FaceMorning } from '@/features/today/components/FaceMorning'
import { FaceDay, type DayHero } from '@/features/today/components/FaceDay'
import { FaceEvening } from '@/features/today/components/FaceEvening'
import { VulnerabilityCard } from '@/features/today/components/VulnerabilityCard'
import { AnchorModeView } from '@/features/today/pages/AnchorModeView'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { questAction } from '@/features/today/logic/questAction'
import { habitAction } from '@/features/today/logic/habitAction'
import { DAY_FACES, dayFace, type DayFace as Face } from '@/features/today/logic/dayFace'
import { buildTodayItems, itemsForFace, openCountByFace, type TodayItem } from '@/features/today/logic/todayItems'
import { sportOf, SPORT_EMOJI, SPORT_TAGS, SPORT_TITLES, SPORT_TONE } from '@/features/train/logic/sportKinds'
import { localDateString } from '@/shared/lib/dates'
import { Icon } from '@/shared/ui/Icon'
import type { DailyQuest } from '@/data/types'

const isFace = (v: string | null): v is Face => v !== null && (DAY_FACES as readonly string[]).includes(v)

export function TodayPage() {
  const date = localDateString()
  const scenario = useTodayScenario()
  const { today, user, workout, volleyballSessions, workoutTime, prediction, briefing, briefingDemo } = useToday()
  const { checkins, saveCheckIn } = useCheckins()
  const { goal: sleepGoal } = useSleepGoal()
  const { quests } = useDailyQuests(date)
  const { data: activities } = useActivities(date)
  const { habits } = useHabitDay(date)
  const { check } = useHabitActions(date)
  const { data: ritualDay } = useRitualDay(date)
  const { visible: fuelSlots } = useFuelPreview()
  const { logWater } = useWaterActions(date)
  const stats = useQuickStats()
  const companionNote = useCompanionNote()
  const { showLevelUp } = useLevelUp()
  const navigate = useNavigate()
  const [params, setSearchParams] = useSearchParams()
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)
  const [activityQuest, setActivityQuest] = useState<DailyQuest | null>(null)
  const [customOpen, setCustomOpen] = useState(false)

  const sportToday = volleyballSessions.find((s) => s.today)
  const items = useMemo(() => buildTodayItems({
    quests, habits, checkins, fuelSlots, ritual: ritualDay, goal: sleepGoal,
    sessions: [
      ...(workout ? [{
        id: 'gym', tone: 'gym' as const, emoji: '🏋️', tag: 'GYM', title: workout.title,
        time: workoutTime ?? null,
        facts: [`${workout.exercises.length} gyakorlat`, `~${workout.durationEst} perc`, prediction?.label],
        logged: false,
      }] : []),
      ...(sportToday ? [{
        id: 'sport', tone: SPORT_TONE[sportOf(sportToday)], emoji: SPORT_EMOJI[sportOf(sportToday)],
        tag: SPORT_TAGS[sportOf(sportToday)], title: SPORT_TITLES[sportOf(sportToday)],
        time: sportToday.time, facts: [`${sportToday.duration} perc`, sportToday.court, sportToday.role],
        logged: false,
      }] : []),
    ],
  }), [quests, habits, checkins, fuelSlots, ritualDay, sleepGoal, workout, workoutTime, prediction, sportToday])

  // The current face comes from the clock; `?dp=` overrides it. Absent (`null`) and
  // blank (`''`) both mean "current" — neither may fall through to a parsed value.
  const current = dayFace(new Date(), sleepGoal)
  const raw = params.get('dp')
  const selected: Face = isFace(raw) ? raw : current
  const selectFace = (face: Face) => {
    const next = new URLSearchParams(params)
    if (face === current) next.delete('dp')
    else next.set('dp', face)
    setSearchParams(next, { replace: true })
  }

  if (scenario.anchorMode) return <AnchorModeView />

  const { open, done } = itemsForFace(items, selected)
  const doneXp = done.reduce((s, i) => s + (i.xp ?? 0), 0)
  const dayXp = items.filter((i) => i.status === 'done').reduce((s, i) => s + (i.xp ?? 0), 0)
    + (activities ?? []).reduce((s, e) => s + e.xpAwarded, 0)

  // A row's action is dispatched through the SAME mappings the old cards used —
  // ADR 0010: nothing here ever self-completes a quest or a DERIVED habit.
  const act = (item: TodayItem) => {
    const a = item.action
    if (!a) return
    if (a.kind === 'checkin') return setCheckInIdx(a.slotIdx)
    if (a.kind === 'nav') return navigate(a.to)
    if (a.kind === 'quest') {
      const qa = questAction(a.quest)
      if (!qa) return
      if (qa.kind === 'water') return logWater(qa.amountMl)
      if (qa.kind === 'checkin') {
        const idx = checkins.findIndex((c) => c.state === 'now' || c.state === 'pending')
        return idx >= 0 ? setCheckInIdx(idx) : undefined
      }
      if (qa.kind === 'activity') return setActivityQuest(a.quest)
      return navigate(qa.to)
    }
    const ha = habitAction(a.habit)
    if (ha.kind === 'check') {
      check(a.habit.key).then((lu) => lu?.[0] && showLevelUp(lu[0]))
      return
    }
    if (ha.kind === 'nav') return navigate(ha.to)
  }

  const morningChain = habits.filter((h) => h.chain === 'MORNING')
  const chainItems = open.filter((i) => i.source === 'habit' && i.face === 'reggel')
  const chain = {
    done: morningChain.filter((h) => h.status === 'done').length,
    total: morningChain.length,
    next: chainItems[0] ?? null,
    rest: chainItems.slice(1).map((i) => i.title),
  }
  const later = items.filter((i) => i.face !== selected && i.face !== 'all' && i.status === 'open')

  const dayHero: DayHero | null = workout
    ? {
        tone: 'gym', emoji: '🏋️', tag: `GYM${workout.tag ? ` · ${workout.tag}` : ''}`, time: workoutTime ?? null,
        title: workout.title,
        facts: [`${workout.exercises.length} gyakorlat`, `~${workout.durationEst} perc`, prediction?.label],
        logged: false, ctaLabel: 'Indítsuk', onLog: () => navigate('/train'),
      }
    : sportToday
      ? {
          tone: SPORT_TONE[sportOf(sportToday)], emoji: SPORT_EMOJI[sportOf(sportToday)],
          tag: SPORT_TAGS[sportOf(sportToday)], time: sportToday.time,
          title: SPORT_TITLES[sportOf(sportToday)],
          facts: [`${sportToday.duration} perc`, sportToday.court, sportToday.role],
          logged: false, ctaLabel: 'Logold', onLog: () => navigate('/train'),
        }
      : null

  return (
    <>
      <AppHero
        utilities={<Link to="/insights" aria-label="Insights" className="icon-btn"><Icon name="sparkle" size={18} /></Link>}
      />
      <GreetingHeader today={today} user={user} retaDay={scenario.retaDay} />
      <DayFaceStrip
        selected={selected}
        current={current}
        counts={openCountByFace(items)}
        doneCounts={Object.fromEntries(DAY_FACES.map((f) => [f, itemsForFace(items, f).done.length])) as Record<Face, number>}
        onSelect={selectFace}
      />
      {scenario.vulnerable && <VulnerabilityCard />}

      {selected === 'reggel' && (
        <FaceMorning
          open={open} done={done} doneXp={doneXp} chain={chain}
          briefing={briefing ?? resolveBriefing(scenario.dayState)}
          briefingDemo={briefingDemo}
          briefingFacts={stats.map((s) => `${s.label} ${s.value}${s.unit ?? ''}`)}
          later={later} onAct={act} onFace={selectFace}
        />
      )}
      {selected === 'nap' && (
        <FaceDay
          open={open} done={done} doneXp={doneXp} hero={dayHero} note={companionNote}
          later={later.filter((i) => i.face === 'este')} onAct={act} onFace={selectFace}
          onCustom={() => setCustomOpen(true)}
        />
      )}
      {selected === 'este' && (
        <FaceEvening open={open} done={done} doneXp={doneXp} dayXp={dayXp} note={companionNote} onAct={act} />
      )}

      {checkInIdx !== null && (
        <CheckInSheet
          slot={checkins[checkInIdx]} slotIdx={checkInIdx}
          onClose={() => setCheckInIdx(null)}
          onSave={(data) => saveCheckIn(checkInIdx, data)}
        />
      )}
      {activityQuest && <ActivityLogSheet quest={activityQuest} onClose={() => setActivityQuest(null)} />}
      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
    </>
  )
}
