// ============================================================
// Mezo · IslandEvening — the evening island's big view (mezo-euze).
// ONE hero slot whose content swaps by the windDown phase (normál →
// ráhangolódás → leállás → éjszaka) with a soft cross-slide; the hero
// number is always the countdown to lights-out. The WindDownBanner +
// RitualCard successors: the winddown phase carries the wind_down
// habit's Pipa (same ['habitDay', date] cache), the CTA is the
// Napzárás entry (?ritual= override wins, the ?day= precedent), and
// night darkens the whole island (the shell's `night` prop is driven
// by TodayPage off the same useWindDownPhase derivation).
// The ritual row + the evening_ritual habit row are filtered out of
// L1 — the hero owns those acts (the FaceEvening rule, mezo-mvb4.1);
// the wind_down row only while THIS view offers its own Pipa.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useHabitActions, useHabitDay, useRitualDay, useTodayScenario } from '@/data/hooks'
import type { CompanionNote } from '@/data/types'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import type { ChainCelebrationInput } from '@/features/today/components/ChainCelebrations'
import { ChainCelebrations } from '@/features/today/components/ChainCelebrations'
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { IslandFactsStrip } from '@/features/today/components/IslandFactsStrip'
import { IslandList } from '@/features/today/components/IslandList'
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

export interface IslandEveningProps {
  open: TodayItem[]
  done: TodayItem[]
  dayXp: number
  /** [dayBalance, sleepOutlook] — the dim phase swaps the first cell for the REM evidence. */
  facts: IslandFact[]
  listOpen: boolean
  onToggleList: (open: boolean) => void
  note: CompanionNote | null
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}

export function IslandEvening({
  open, done, dayXp, facts, listOpen, onToggleList,
  note, celebrations, growth, habitPending, onAct,
}: IslandEveningProps) {
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
  // neither may appear as an L1 row at the same time (the „offered exactly once" rule).
  const visibleOpen = open.filter(
    (i) =>
      i.source !== 'ritual' &&
      !OWNED_BY_RITUAL_HERO.has(i.id) &&
      !(ph === 'winddown' && i.id === WIND_DOWN_ID),
  )

  if (listOpen) {
    return (
      <>
        <ChainCelebrations chains={celebrations} />
        <div className="isl-openhead">🌙 Este</div>
        <IslandList
          open={visibleOpen}
          done={done}
          doneHeading="Ahogy a nap telt"
          dayXp={dayXp}
          head={note ? <CompanionNoteCard note={note} /> : undefined}
          focus={<IntentionBanner variant="reflect" />}
          growth={growth}
          habitPending={habitPending}
          onAct={onAct}
          onClose={() => onToggleList(false)}
        />
      </>
    )
  }

  const hero = bedCountdown(now, goal)
  const { opensAt, bedTime } = ritualDay.window
  const ritualState = ritual ?? (ritualDay.closed ? 'done' : ritualWindowState(now, ritualDay.window))

  if (ph === 'night') {
    return (
      <div className="isl-phase" key="night">
        <div className="isl-hero-v">
          {hero.value}
          <span className="isl-hero-u">{hero.unit}</span>
        </div>
        <div className="isl-hero-sub">minden várhat reggelig — jó éjt</div>
        <a
          className="isl-nightrow"
          href="/me/sleep/night"
          onClick={(e) => { e.preventDefault(); navigate('/me/sleep/night') }}
        >
          🌙 Éjszakai mód megnyitása<span className="isl-nightrow-arr" aria-hidden="true">›</span>
        </a>
      </div>
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
    <div className="isl-phase" key={ph}>
      <ChainCelebrations chains={celebrations} />
      <div className="isl-hero-v">
        {hero.value}
        <span className="isl-hero-u">{hero.unit}</span>
      </div>
      <div className="isl-hero-sub">{sub}</div>
      <IslandFactsStrip facts={phaseFacts} />
      <div className="isl-act">
        {ritualState === 'open' && (
          <button type="button" className="isl-cta is-lav np-press" onClick={() => navigate('/ritual')}>
            Zárjuk le a napot
          </button>
        )}
        {ritualState === 'waiting' && (
          <button type="button" className="isl-more" onClick={() => navigate('/ritual')}>
            Napzárás {opensAt}-kor nyílik
          </button>
        )}
        {wdCheckable && (
          <button type="button" className="isl-more" onClick={doWindDown}>
            Leállás megvolt ✓
          </button>
        )}
        {visibleOpen.length > 0 && (
          <button type="button" className="isl-more" onClick={() => onToggleList(true)}>
            még {visibleOpen.length} ›
          </button>
        )}
      </div>
      {ph === 'winddown' && wdDone && <div className="isl-doneline">Leállás megvolt ✓</div>}
      {ritualState === 'done' && <div className="isl-doneline">Napzárás kész ✓</div>}
      {done.length > 0 && (
        <button type="button" className="isl-doneline" onClick={() => onToggleList(true)}>
          Ahogy a nap telt · {done.length} tétel ›
        </button>
      )}
    </div>
  )
}
