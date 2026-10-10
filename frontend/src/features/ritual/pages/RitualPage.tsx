import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrivalStep } from '@/features/ritual/components/ArrivalStep'
import { DayStoryStep } from '@/features/ritual/components/DayStoryStep'
import { HarvestStep } from '@/features/ritual/components/HarvestStep'
import { LoopsStep } from '@/features/ritual/components/LoopsStep'
import { ReflectionStep } from '@/features/ritual/components/ReflectionStep'
import { ReleaseStep } from '@/features/ritual/components/ReleaseStep'
import { RitualExitContext } from '@/features/ritual/components/RitualFoot'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { ringsOf } from '@/features/today/logic/needsInputs'
import { localDateString } from '@/shared/lib/dates'
import { Dots, Page } from '@/shared/ui/folyadek'
import { useCheckins, useDayRecap, useHabitActions, useHabitDay, useRitualActions, useRitualDay } from '@/data/hooks'

const ACT_COUNT = 6

/** The six acts by name — what the step dots announce to a screen reader („2 / 6 · A napod íve"). */
const ACT_NAME = ['Indulás', 'A napod íve', 'A szavaid', 'Nyitott hurkok', 'A mai termés', 'Lezárva']

/**
 * Full-screen Napzárás flow (/ritual, spec §4, mezo-ilsj) — a 6-act state machine on a chrome-free
 * route (train/session idiom: AppLayout hides the title bar, the bottom bar and the FAB here).
 * Folyadék (mezo-n4wf5.2, owner decision, prototype `napzaras.1…6`): the flow is LIGHT; the evening
 * mood is the deeper „dusk" liquid (`<Page tone="dusk">`), not a dark screen. The page draws only
 * the six step dots on top; each act renders its hero, its numbered cards and its own foot bar
 * (`RitualFoot`: „Kilépés" on the left — handed down through `RitualExitContext` — and the act's
 * primary button), so the act keeps owning its advance.
 *
 * The ONLY write before the Harvest act is the optional prose reflection in act 3
 * (`ReflectionStep`, W1.2) — an idempotent upsert that cannot conflict with the close, which
 * only stamps `closed_at`. The „Kilépés" exit stays consequence-free otherwise: entering act 5 is
 * still the close — a `closedRef` guard fires `useRitualActions(date).close()` exactly once,
 * then silently drops any habit levelUps accrued earlier today (see the effect below) — the
 * Harvest stage IS the celebration, so the global LevelUpProvider overlay must never fire a
 * second one back on /nap.
 *
 * Act 4 (LoopsStep) only SIGNALS (onOpenCheckIn/onOpenJournal) — the reused sheets
 * (CheckInSheet, ActivityLogSheet) are mounted HERE, at the page level: this page keeps its own
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
        // ritual's own celebration, so consume (silently drop) it here, so the routine's
        // effect doesn't fire the global LevelUpScreen a second time once the user lands
        // back on /nap.
        consumeLevelUps()
      })
    }
  }, [act, close, consumeLevelUps, needsPending, states])

  const exit = useCallback(() => navigate('/nap'), [navigate])
  const checkinsDone = checkins.filter((c) => c.state === 'done').length

  return (
    <RitualExitContext.Provider value={exit}>
      {/* `has-foot`: the act's own `RitualFoot` is this page's foot bar (see the doc comment). */}
      <Page tone="dusk" nonav className="has-foot nrz" data-act={act}>
        <Dots count={ACT_COUNT} at={act - 1} label={`${act} / ${ACT_COUNT} · ${ACT_NAME[act - 1]}`} />

        {act === 1 && <ArrivalStep onNext={() => setAct(2)} checkinsDone={checkinsDone} checkinsTotal={checkins.length} />}
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
            onFinish={() => navigate('/nap/rutin?dp=este')}
          />
        )}
      </Page>

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
    </RitualExitContext.Provider>
  )
}
