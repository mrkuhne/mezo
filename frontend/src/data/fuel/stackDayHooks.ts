// Fuel · Stack — the shared day-projection hook (mezo-vx9v Task 8).
//
// One composition, both modes: the living protocol's occurrences (Task 5) + today's real
// anchors/blocks feed Task 6's pure `projectStackDay`, giving the Stack page (and any future
// consumer) the zoned `StackDaySlot[]` timeline in one call. Mirrors `timelineHooks.ts`'s
// composition style — EVERY source hook below is called UNCONDITIONALLY in both modes (React
// rules of hooks); mock sources serve their seeds, so the same `projectStackDay` composition
// yields a deterministic demo timeline.
//
// weightKg deliberately comes from `useWeight()` (`GET /api/biometrics/weight`), NOT `useGoal()`
// — the Stack page has never fetched `/api/goals` (mezo-4nu decouple, guarded by
// FuelStackPage.test.tsx), and `useWeight()`'s raw weight-log gives the same "latest weigh-in"
// figure `useFuelTimeline` derives via `useGoal().goal.currentWeight` without that coupling. It
// only feeds `projectStackDay`'s peri-workout-snack kcal threshold (mezo-1oy5) — 0 while
// unresolved is a benign "no snack yet" default, never a fabricated number.
import { localDateString } from '@/shared/lib/dates'
import { toMin } from '@/data/fuel/fuelConfig'
import { useProtocol, useStack, useIntakes } from '@/data/fuel/stackHooks'
import { useWeight } from '@/data/me/weightHooks'
import { useSleepGoal } from '@/data/me/sleepHooks'
import { useTrain } from '@/data/train/trainHooks'
import { useRunning } from '@/data/train/runningHooks'
import { useFuelSettings } from '@/data/fuel/fuelSettingsHooks'
import { deriveBlocks } from '@/features/fuel/logic/buildProtocol'
import { projectStackDay, type StackDaySlot } from '@/features/fuel/logic/projectStackDay'
import type { ProtocolOccurrence, SupplementStashItem } from '@/data/types'

export function useStackDay(date: string = localDateString()): {
  slots: StackDaySlot[]
  occurrences: ProtocolOccurrence[]
  stash: SupplementStashItem[]
  dayType: { training: boolean; firstBlockTime: string | null }
  wake: string
  bed: string
} {
  const { occurrences } = useProtocol()
  const { stash } = useStack()
  const intakes = useIntakes(date)
  const { goal: sleepGoal } = useSleepGoal()
  const { gymSchedule, sport, sportSlotSkips } = useTrain()
  const { activeRunningBlock } = useRunning()
  const { settings } = useFuelSettings()
  const { weightLog } = useWeight()

  const wake = sleepGoal.wakeTime
  const bed = sleepGoal.bedTime
  const weightKg = weightLog.length ? weightLog[weightLog.length - 1].value : 0

  const blocks = deriveBlocks(gymSchedule, sport, activeRunningBlock, sportSlotSkips)
  const firstBlockTime = blocks.length
    ? [...blocks].sort((a, b) => toMin(a.time) - toMin(b.time))[0].time
    : null

  const slots = projectStackDay({
    occurrences, stash, intakes, wake, bed, mealsPerDay: settings.mealsPerDay, blocks, weightKg,
  })

  return {
    slots,
    occurrences,
    stash,
    dayType: { training: blocks.length > 0, firstBlockTime },
    wake,
    bed,
  }
}
