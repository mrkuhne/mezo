import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrivalStep } from '@/features/ritual/components/ArrivalStep'
import { DayStoryStep } from '@/features/ritual/components/DayStoryStep'
import { HarvestStep } from '@/features/ritual/components/HarvestStep'
import { LoopsStep } from '@/features/ritual/components/LoopsStep'
import { ReflectionStep } from '@/features/ritual/components/ReflectionStep'
import { ReleaseStep } from '@/features/ritual/components/ReleaseStep'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { ringsOf } from '@/features/today/logic/needsInputs'
import { localDateString } from '@/shared/lib/dates'
import { useTheme } from '@/app/ThemeProvider'
import { useCheckins, useDayRecap, useHabitActions, useHabitDay, useRitualActions, useRitualDay } from '@/data/hooks'

const ACT_COUNT = 6

// Index-derived star positions (mezo-d20.8.1.1). Deliberately NOT Math.random: /ritual carries
// visual goldens, and a re-rolled sky would fail every one of them for no design reason. The
// prime-ish multipliers just keep the grid from reading as a lattice.
const STARS = Array.from({ length: 16 }, (_, i) => ({
  left: `${((i * 37) % 96) + 2}%`,
  top: `${((i * 53) % 88) + 3}%`,
  delay: `${((i * 7) % 30) / 10}s`,
}))

function StarField() {
  return (
    <div className="rz-stars" aria-hidden="true">
      {STARS.map((s) => (
        <i key={s.left + s.top} style={{ left: s.left, top: s.top, '--tw': s.delay } as CSSProperties} />
      ))}
    </div>
  )
}

/** Past acts are lavender clay beads, the current one gold — reporting progress, never navigable. */
function beadClass(i: number, act: number) {
  if (i + 1 === act) return 'rz-dot cur'
  return i + 1 < act ? 'rz-dot on' : 'rz-dot'
}

/**
 * Full-screen Napzárás flow (/ritual, spec §4, mezo-ilsj) — a 6-act state machine over a
 * forced-dark surface (train/session idiom: AppLayout hides the tab bar for this route).
 * The ONLY write before the Harvest act is the optional prose reflection in act 3
 * (`ReflectionStep`, W1.2) — an idempotent upsert that cannot conflict with the close, which
 * only stamps `closed_at`. The ✕ exit stays consequence-free otherwise: entering act 5 is
 * still the close — a `closedRef` guard fires `useRitualActions(date).close()` exactly once,
 * then silently drops any habit levelUps accrued earlier today (see the effect below) — the
 * Harvest stage IS the celebration, so the global LevelUpProvider overlay must never fire a
 * second one on /today.
 *
 * Act 4 (LoopsStep) only SIGNALS (onOpenCheckIn/onOpenJournal) — the reused sheets
 * (CheckInSheet, ActivityLogSheet) are mounted HERE, at the page level, exactly like
 * TodayPage.tsx mounts CheckInSheet (TodayPage.tsx:37-42/76-83): this page keeps its own
 * `useCheckins` + the same next-open-slot `findIndex` predicate so it can resolve
 * onOpenCheckIn to a concrete slot index without LoopsStep needing to know or pass it.
 */
export function RitualPage() {
  const navigate = useNavigate()
  const date = localDateString()
  const { data } = useRitualDay(date)
  const { closingNote } = useDayRecap(date)
  const { checkins, saveCheckIn } = useCheckins()
  const { close } = useRitualActions(date)
  const { consumeLevelUps } = useHabitActions(date)
  // mezo-dhzk (Task 9): a stable `now` for the whole flow — the needs snapshot sent to
  // close() is a single instant, not a value that should shift mid-ritual as the ring sim
  // decays in real time.
  const [tickNow] = useState(() => new Date())
  const { states, isPending: needsPending } = useNeeds(tickNow)
  // mezo-ywz1: mount an active observer on ['habitDay', date] — with none, close()'s
  // invalidateQueries(['habitDay', date]) only marks the key stale and never actually
  // refetches, so the server-derived evening_ritual completion (+10 XP + level_up_event,
  // produced ONLY by GET /api/habit/day) never lands in the cache. useHabitDay uses
  // staleTime:0 in real mode, so this mount is exactly what makes that invalidation refetch.
  // The return value is unused; mounting the hook IS the fix. On first mount this fires one
  // harmless GET (ritual_closed=false → evening_ritual stays pending, no completion yet).
  useHabitDay(date)

  // mezo-tr5v: the ritual is a dark-takeover surface (rz-screen is hard-dark regardless of
  // theme), but the sheets it portals (CheckInSheet, ActivityLogSheet) and any XP-award overlay
  // (LevelUpScreen) are theme-aware and would render light for a light-mode user — clashing.
  // Force data-theme=dark for the whole flow so everything is consistent, then revert to the
  // user's real theme on exit. This does NOT touch the persisted preference (setForceTheme).
  const { setForceTheme } = useTheme()
  useEffect(() => {
    setForceTheme('dark')
    return () => setForceTheme(null)
  }, [setForceTheme])

  const [act, setAct] = useState(1)
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)
  const [journalOpen, setJournalOpen] = useState(false)

  const nextCheckinIdx = checkins.findIndex((c) => c.state === 'now' || c.state === 'pending')

  const closedRef = useRef(false)
  useEffect(() => {
    if (act === 5 && !closedRef.current) {
      closedRef.current = true
      // Fix-wave review finding: if useNeeds' composite read is still pending at act 5 (an
      // unlucky timing window — every other act gives the reads time to resolve, but nothing
      // guarantees it), `states` would be the empty-events zero snapshot. The close endpoint
      // is idempotent PER DATE, so persisting that snapshot would silently freeze the day's
      // ring readout — never send an under-reported one; skip the rings payload entirely.
      close(needsPending ? undefined : ringsOf(states)).then(() => {
        // mezo-ywz1: in real mode close() now awaits the ['habitDay', date] refetch (see
        // useRitualActions), so by the time this runs the ritual's own +10/level_up_event is
        // already sitting in the habitDay cache — not just an earlier-in-the-day one. The
        // Harvest act (HarvestStep, Task 6) already displays today's XP/coins/streak as the
        // ritual's own celebration, so consume (silently drop) it here, so RoutineCard's
        // effect doesn't fire the global LevelUpScreen a second time once the user lands
        // back on /today.
        consumeLevelUps()
      })
    }
  }, [act, close, consumeLevelUps, needsPending, states])

  return (
    <div className="rz-screen" data-act={act}>
      <StarField />
      <div className="rz-top">
        <div className="rz-dots" aria-hidden="true">
          {Array.from({ length: ACT_COUNT }, (_, i) => (
            <span key={i} className={beadClass(i, act)} />
          ))}
        </div>
        <button className="rz-exit" aria-label="Kilépés" onClick={() => navigate('/nap')}>✕</button>
      </div>

      {act === 1 && <ArrivalStep onNext={() => setAct(2)} />}
      {act === 2 && <DayStoryStep onNext={() => setAct(3)} />}
      {act === 3 && <ReflectionStep onNext={() => setAct(4)} />}
      {act === 4 && (
        <LoopsStep
          onNext={() => setAct(5)}
          onOpenCheckIn={() => setCheckInIdx(nextCheckinIdx)}
          onOpenJournal={() => setJournalOpen(true)}
        />
      )}
      {act === 5 && <HarvestStep onNext={() => setAct(6)} />}
      {act === 6 && (
        <ReleaseStep
          prepStartsAt={data.window.prepStartsAt}
          bedTime={data.window.bedTime}
          closingNote={closingNote}
          onFinish={() => navigate('/nap')}
        />
      )}

      {/* checkInIdx >= 0 guards a -1 findIndex miss (nextCheckinIdx) from rendering CheckInSheet with an undefined slot. */}
      {checkInIdx !== null && checkInIdx >= 0 && (
        <CheckInSheet
          slot={checkins[checkInIdx]}
          slotIdx={checkInIdx}
          onClose={() => setCheckInIdx(null)}
          onSave={(data) => saveCheckIn(checkInIdx, data)}
        />
      )}
      {journalOpen && <ActivityLogSheet onClose={() => setJournalOpen(false)} />}
    </div>
  )
}
