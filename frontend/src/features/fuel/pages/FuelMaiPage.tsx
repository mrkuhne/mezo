import { Fragment, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { FuelSlot, MealSlot } from '@/data/types'
import {
  useFuelDay, useFuelTimeline, useMedication, useRecipes, useStackDay, useWaterActions,
} from '@/data/hooks'
import { toMin } from '@/data/fuel/fuelConfig'
import { addDays, localDateString } from '@/shared/lib/dates'
import { pickHeroWindow } from '@/features/fuel/logic/heroWindow'
import { buildWindowRiver, type WindowRiverVM } from '@/features/fuel/logic/windowIslands'
import { matchMealsToStack } from '@/features/fuel/logic/matchMealsToStack'
import { WindowIsland } from '@/features/fuel/components/WindowIsland'
import { KeretBelt } from '@/features/fuel/components/KeretBelt'
import type { LogMealPrefill } from '@/features/fuel/sheets/LogMealSheet'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'
import { AiLogSheet } from '@/features/fuel/sheets/AiLogSheet'
import { FuelSettingsSheet } from '@/features/fuel/sheets/FuelSettingsSheet'

// Ablak-folyam recomposition (spec 2026-08-08, mezo-jgh9): the Mai screen becomes a non-scrolling
// sky of window-islands (one per meal slot, chronological) with the always-visible Keret-öv
// sitting right after the NOW-island — Today's three-islands language (`shared/ui/Island`) applied
// to Fuel's own unit, the eating window. `?w=` is the single source of truth for which island is
// big (no param → river.defaultKey), mirroring TodayPage's `?dp=` rules exactly (replace: true,
// delete on default, null/''/unknown all fall back). Per spec §2 "L0 nem görgethető": the sky IS
// the page — nothing renders below it except sheets (review fix, mezo-jgh9 Task 5 round 2).
//
// Retired here (mezo-jgh9 Task 5 — actual file deletion is Task 6's job): the `.pghead-np` header
// row + the Reta D{n} link (Reta now leaks in as a FACT, via the now-island's subtitle —
// `retaPeak`), `retamicro`, `NowWindowCard` (its `pickHeroWindow` projection survives, just feeds
// `buildWindowRiver` now), `MissedStrip` (a missed window is just an island in the `missed` state),
// `DayZoneCard`/`ZoneSlotRow` (zones retire — every meal slot is its own island), `DayBudgetCard`
// (its content lives in the Keret-öv's kibontott view now), the kitchen-close/caffeine-cutoff row
// (folded into `KeretBelt`'s `note` footer line), and the protocol-meta/Replan row (Stack's own
// page is its home — no below-sky rows on Mai). The meal-coach tagline/score-chip surface
// (`useMealCoach`, `MealScoreSheet`, `getScoredMeal`) rode ONLY on the retired `ZoneSlotRow` —
// `WindowIsland` has no equivalent slot, so it has no home here anymore (P8 scope per spec §8: the
// window island's own day-score fact cell stays null until a per-window score feed exists).
// Likewise `EnergyBreakdownSheet`'s drill-down chips: the Keret-öv's kibontott view already prints
// the full breakdown inline, so there is no "honnan a cél" chip left to open it. The retired row's
// "szerkeszt" chip (the only `FuelSettingsSheet` trigger in the app) is restored as a quiet
// "szerkeszt ›" ghost button on the Keret-öv's note row (`KeretBelt`'s `onEditSettings`, Today's
// `.isl-grouph-go` idiom) — review fix round 3.
export function FuelMaiPage() {
  const navigate = useNavigate()
  const [params, setSearchParams] = useSearchParams()
  const { fuel } = useFuelDay()
  const { plan, budget, blocks, nowHHmm } = useFuelTimeline()
  const { cycle: medicationCycle } = useMedication()
  const { logWater } = useWaterActions()
  // The same stack/day composition FuelStackPage.tsx already uses, feeding matchMealsToStack —
  // today's window-islands need only ONE representative verdict (buildWindowRiver's contract is
  // `MealMatchVerdict | null`, singular), so this page picks the first TODAY ('ma') verdict; a
  // 'tegnap' verdict describes yesterday's zone and has no honest home on today's sky.
  const { slots: stackSlots } = useStackDay()
  const { recipes } = useRecipes()
  const yesterday = addDays(localDateString(), -1)
  const { fuel: yesterdayFuel } = useFuelDay(yesterday)

  const [logOpen, setLogOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiSlot, setAiSlot] = useState<MealSlot | undefined>(undefined)
  const [logPrefill, setLogPrefill] = useState<LogMealPrefill>(null)
  const [logInitialSlot, setLogInitialSlot] = useState<MealSlot | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // L1 open/closed — belongs to whichever island is selected; a selection switch always closes it.
  const [listOpen, setListOpen] = useState(false)

  const heroResult = pickHeroWindow({
    slots: plan.slots, blocks, budget, consumed: { kcal: fuel.consumed.kcal, p: fuel.consumed.p }, nowHHmm,
  })
  // Honest gym-only signal straight off today's REAL blocks (deriveBlocks, already composed by
  // useFuelTimeline) — no second workoutTime hook, no invented source.
  const workoutTime = blocks.find(b => b.kind === 'gym')?.time ?? null
  // The cycle's OWN current-day phaseKey (never a page-local re-hardcoded phase model) — 'peak'
  // is the one phase the design calls out as appetite-relevant (spec §3.2).
  const retaPeak = medicationCycle.phaseKey === 'peak'
  const matchResult = matchMealsToStack(stackSlots, recipes, fuel.meals, yesterdayFuel.meals)
  const stackVerdict = matchResult.verdicts.find(v => v.dayLabel === 'ma') ?? null
  const river: WindowRiverVM = buildWindowRiver({
    plan, budget, hero: heroResult, stackVerdict, workoutTime, retaPeak, nowHHmm,
  })

  // Same filter+sort `buildWindowRiver` uses internally (its own `islandKey` isn't exported —
  // sight-unseen import contract, windowIslands.ts) so island key ↔ source FuelSlot stay in sync.
  const mealSlots = plan.slots
    .filter((s): s is FuelSlot & { slotKey: MealSlot } => s.slotKey != null)
    .sort((a, z) => toMin(a.time) - toMin(z.time))
  const slotByKey = new Map(mealSlots.map(s => [`${s.time}-${s.label}`, s]))

  // "Pull A + lépések" | "lépések" — today's training blocks (already composed by
  // useFuelTimeline) joined with the always-on steps tag.
  const activityLabel = [...blocks.map(b => b.label), 'lépések'].join(' + ')

  const validKeys = new Set<string>([...river.islands.map(i => i.key), 'keret'])
  const raw = params.get('w')
  const selected = raw != null && validKeys.has(raw) ? raw : river.defaultKey
  const selectWindow = (key: string) => {
    setListOpen(false)
    const next = new URLSearchParams(params)
    if (key === river.defaultKey) next.delete('w')
    else next.set('w', key)
    setSearchParams(next, { replace: true })
  }

  const doneSummaryText = river.doneSummary.count > 0
    ? [
        `✓ ${river.doneSummary.count} ablak kész ma`,
        `${river.doneSummary.kcal} kcal`,
        river.doneSummary.avgScore != null ? `átlag ${river.doneSummary.avgScore} pont` : null,
      ].filter(Boolean).join(' · ')
    : null

  const openLog = (prefill: LogMealPrefill = null, slot?: MealSlot) => {
    setLogPrefill(prefill)
    setLogInitialSlot(slot)
    setLogOpen(true)
  }
  const handleLogMeal = (slot: FuelSlot) => {
    if (slot.suggestedRecipeId) openLog({ source: 'recipe', recipeId: slot.suggestedRecipeId })
    else openLog(null, slot.slotKey ?? 'snack')
  }
  const handleAiLog = (slot: FuelSlot) => {
    setAiSlot(slot.slotKey)
    setAiOpen(true)
  }

  // The Keret-öv sits DOM-fixed right after the NOW-island (spec §2 sky diagram); with no now
  // window it lands after the last DONE island instead — NOT blindly the chronologically last
  // island, which may be `missed` (review fix #4: a trailing missed window must not pull the
  // belt past every window that's actually finished).
  const doneKeys = river.islands.filter((i) => i.state === 'done').map((i) => i.key)
  const beltAfterKey = river.nowKey ?? doneKeys.at(-1) ?? river.islands.at(-1)?.key ?? null
  // Kitchen close / caffeine cutoff — a quiet informational footer on the Keret-öv's kibontott
  // view (review fix #2a): the sky IS the page now, so there is no below-sky row left to host it.
  const keretNote = `Konyha zár · ${plan.kitchenClose} · kávé cutoff ${plan.caffeineCutoff}`
  const keretBelt = (
    <KeretBelt
      big={selected === 'keret'}
      budget={budget}
      consumed={fuel.consumed}
      water={{ currentMl: fuel.consumed.water, targetMl: fuel.targets.water, onAdd250: () => logWater(250) }}
      activityLabel={activityLabel}
      note={keretNote}
      onEditSettings={() => setSettingsOpen(true)}
      onSelect={() => selectWindow('keret')}
      onAdHocLog={() => openLog()}
    />
  )

  return (
    <>
      <div className="sky-islands">
        {river.islands.map((vm) => (
          <Fragment key={vm.key}>
            <WindowIsland
              vm={vm}
              big={selected === vm.key}
              nowRing={vm.key === river.nowKey}
              open={selected === vm.key && listOpen}
              doneSummary={vm.key === river.nowKey ? doneSummaryText : null}
              onSelect={() => selectWindow(vm.key)}
              onToggleOpen={() => setListOpen((o) => !o)}
              onLog={() => { const slot = slotByKey.get(vm.key); if (slot) handleLogMeal(slot) }}
              onAiLog={() => { const slot = slotByKey.get(vm.key); if (slot) handleAiLog(slot) }}
              onSwap={() => navigate('/fuel/recipes')}
              // stackDoses here come from a MealMatchVerdict (matchMealsToStack), which carries no
              // pantryItemId/occurrence id — there is no honest per-dose "check" action reachable
              // from this data shape (useStackActions().logIntake needs a real stack occurrence),
              // so this stays a deep-link to the page that actually owns dose-ticking.
              onStackDose={() => navigate('/fuel/stack')}
            />
            {vm.key === beltAfterKey && keretBelt}
          </Fragment>
        ))}
        {beltAfterKey === null && keretBelt}
      </div>

      {logOpen && <LogMealSheet prefill={logPrefill} initialSlot={logInitialSlot} onClose={() => setLogOpen(false)} />}
      {settingsOpen && <FuelSettingsSheet onClose={() => setSettingsOpen(false)} />}
      {aiOpen && (
        <AiLogSheet
          date={localDateString()}
          initialSlot={aiSlot}
          onClose={() => setAiOpen(false)}
          onManualFallback={() => { setAiOpen(false); openLog() }}
        />
      )}
    </>
  )
}
