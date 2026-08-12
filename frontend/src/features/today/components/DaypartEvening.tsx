// ============================================================
// Mezo · DaypartEvening — the evening daypart's view (mezo-puci), the
// IslandEvening successor. ONE hero slot whose content swaps by the
// windDown phase (normál → ráhangolódás → leállás → éjszaka) with a
// soft cross-slide; the hero number is always the countdown to
// lights-out. The winddown phase carries the wind_down habit's Pipa
// (same ['habitDay', date] cache), the CTA is the Napzárás entry
// (?ritual= override wins, the ?day= precedent), and night darkens
// the whole VIEW — there is no card any more, so `DaypartPanel`'s
// `night` prop darkens the view itself instead of a card.
// The ritual row + the evening_ritual habit row are filtered out of
// the list — the hero owns those acts (the FaceEvening rule,
// mezo-mvb4.1); the wind_down row only while THIS view offers its
// own Pipa (the „offered exactly once" rule).
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useHabitActions, useHabitDay, useRitualDay, useTodayScenario } from '@/data/hooks'
import type { CompanionNote } from '@/data/types'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import type { ChainCelebrationInput } from '@/features/today/components/ChainCelebrations'
import { ChainCelebrations } from '@/features/today/components/ChainCelebrations'
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { DayGroups } from '@/features/today/components/DayGroups'
import { DaypartHero, DaypartPanel } from '@/features/today/components/DaypartPanel'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { TodayStats } from '@/features/today/components/TodayStats'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { IslandFact } from '@/features/today/logic/islandFacts'
import { bedCountdown } from '@/features/today/logic/islandFacts'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { useWindDownPhase } from '@/features/today/logic/useWindDownPhase'
import { ritualWindowState } from '@/features/ritual/logic/ritualWindow'
import { localDateString } from '@/shared/lib/dates'

const OWNED_BY_RITUAL_HERO = new Set(['habit:evening_ritual'])
const WIND_DOWN_ID = 'habit:wind_down'

const REM_FACT: IslandFact = {
  label: 'REM hűvösben',
  value: '+18',
  unit: '%',
  delta: { text: '18 °C-os szobában — Walker mérése', tone: 'muted' },
}

export interface DaypartEveningProps {
  open: TodayItem[]
  done: TodayItem[]
  dayXp: number
  /** [dayBalance, sleepOutlook] — the dim phase swaps the first cell for the REM evidence. */
  facts: IslandFact[]
  note: CompanionNote | null
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}

export function DaypartEvening({
  open, done, dayXp, facts,
  note, celebrations, growth, habitPending, onAct,
}: DaypartEveningProps) {
  const date = localDateString()
  const { phase, now, goal } = useWindDownPhase()
  const { data: ritualDay } = useRitualDay(date)
  const { ritual } = useTodayScenario()
  const { habits } = useHabitDay(date)
  const { check, pending } = useHabitActions(date)
  const { showLevelUp } = useLevelUp()
  const navigate = useNavigate()

  const ph = phase ?? 'none'
  // The hero CTA owns the Napzárás act and the winddown Pipa owns wind_down while shown —
  // neither may appear as a list row at the same time (the „offered exactly once" rule).
  const visibleOpen = open.filter(
    (i) =>
      i.source !== 'ritual' &&
      !OWNED_BY_RITUAL_HERO.has(i.id) &&
      !(ph === 'winddown' && i.id === WIND_DOWN_ID),
  )

  const hero = bedCountdown(now, goal)
  const { opensAt, bedTime } = ritualDay.window
  const ritualState = ritual ?? (ritualDay.closed ? 'done' : ritualWindowState(now, ritualDay.window))

  if (ph === 'night') {
    return (
      <DaypartPanel tone="este" night key="night">
        <DaypartHero value={hero.value} unit={hero.unit} sub="minden várhat reggelig — jó éjt" />
        <a
          className="dv-nightrow"
          href="/me/sleep/night"
          onClick={(e) => { e.preventDefault(); navigate('/me/sleep/night') }}
        >
          🌙 Éjszakai mód megnyitása<span className="dv-nightrow-arr" aria-hidden="true">›</span>
        </a>
      </DaypartPanel>
    )
  }

  const sub =
    ph === 'dim'
      ? 'ráhangolódás: fény 30 lux alá · szoba ~18 °C'
      : ph === 'winddown'
        ? `villanyoltás ${bedTime} · képernyők le`
        : `napzárás ${opensAt}-től · villanyoltás ${bedTime}`
  const phaseFacts = ph === 'dim' ? [REM_FACT, ...facts.filter((f) => f.label === 'Alvás-kilátás')] : facts

  const windDownHabit = habits.find((h) => h.key === 'wind_down')
  const wdDone = windDownHabit?.status === 'done'
  const wdCheckable = ph === 'winddown' && !!windDownHabit && !wdDone && !pending
  const doWindDown = () => {
    check('wind_down').then((lu) => lu?.[0] && showLevelUp(lu[0]))
  }

  return (
    <DaypartPanel tone="este" key={ph}>
      <ChainCelebrations chains={celebrations} />
      <DaypartHero value={hero.value} unit={hero.unit} sub={sub} />
      <TodayStats facts={phaseFacts} />
      {ritualState === 'open' && (
        <button type="button" className="td-cta is-lav np-press" onClick={() => navigate('/ritual')}>
          Zárjuk le a napot
        </button>
      )}
      {ritualState === 'waiting' && (
        <button type="button" className="td-ghost np-press" onClick={() => navigate('/ritual')}>
          Napzárás {opensAt}-kor nyílik
        </button>
      )}
      {wdCheckable && (
        <button type="button" className="td-ghost np-press" onClick={doWindDown}>
          Leállás megvolt ✓
        </button>
      )}
      {ph === 'winddown' && wdDone && <div className="td-foot">Leállás megvolt ✓</div>}
      {ritualState === 'done' && <div className="td-foot">Napzárás kész ✓</div>}
      <DayGroups
        open={visibleOpen}
        done={done}
        doneLabel={`Ahogy a nap telt · ${done.length} tétel`}
        dayXp={dayXp}
        head={note ? <CompanionNoteCard note={note} /> : undefined}
        focus={<IntentionBanner variant="reflect" />}
        growth={growth}
        habitPending={habitPending}
        onAct={onAct}
      />
    </DaypartPanel>
  )
}
