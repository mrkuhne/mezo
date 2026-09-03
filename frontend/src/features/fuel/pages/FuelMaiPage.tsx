import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { EnergySection } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import type { FuelMeal, FuelSlot, MealSlot } from '@/data/types'
import {
  useDietSettings, useFuelDay, useFuelTimeline, useMedication, useRecipes, useStackDay, useWaterActions,
} from '@/data/hooks'
import { toMin } from '@/data/fuel/fuelConfig'
import { addDays, localDateString } from '@/shared/lib/dates'
import { pickHeroWindow } from '@/features/fuel/logic/heroWindow'
import { buildWindowRiver, type WindowRiverVM } from '@/features/fuel/logic/windowIslands'
import { buildKeretHero, deriveMealRole, doneMealRows } from '@/features/fuel/logic/keretHero'
import { matchMealsToStack } from '@/features/fuel/logic/matchMealsToStack'
import { Island } from '@/shared/ui/Island'
import { WindowIsland } from '@/features/fuel/components/WindowIsland'
import { KeretHero } from '@/features/fuel/components/KeretHero'
import { DoneWindowsCapsule, type DoneCapsuleRow } from '@/features/fuel/components/DoneWindowsCapsule'
import type { LogMealPrefill } from '@/features/fuel/sheets/LogMealSheet'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'
import { AiLogSheet } from '@/features/fuel/sheets/AiLogSheet'
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'
import { MealScoreSheet } from '@/features/fuel/sheets/MealScoreSheet'
import { EnergyBreakdownSheet } from '@/features/fuel/sheets/EnergyBreakdownSheet'

// Spec §8 empty-day state: no meal slots at all today → the sky shows this one static "üres nap"
// island instead of a river with nothing in it. Always big — there is no capsule state to select,
// there is nothing else on the sky to swap away from. Rides the same shared `Island` shell every
// other window/belt uses (`tone="fuel"`), the `is-word` hero idiom Today's now-retired `IslandDay`
// once used for its rest-day state (deleted with the daypart-tabs re-composition, ADR 0025).
function EmptyDayIsland({ onPlan }: { onPlan: () => void }) {
  return (
    <Island
      tone="fuel"
      big
      nowRing={false}
      capsule={{ emoji: '🍽️', title: 'Üres nap', essence: 'Nincs mai terv', count: '' }}
      ariaLabel="Üres nap · megnyitás"
      onSelect={() => {}}
    >
      <div className="isl-hero-v is-word">
        Üres nap
      </div>
      <div className="isl-hero-sub">Nincs mai terv — tervezz egyet.</div>
      <div className="isl-act">
        <button type="button" className="isl-cta cta-sage" onClick={onPlan}>＋ tervezz</button>
      </div>
    </Island>
  )
}

// Keret-hero recomposition (spec 2026-08-09, mezo-c9t5 — window-river iteration): the always-on
// Keret-öv retires in favor of a `KeretHero` sitting at the top of the page, above the sky (the
// retired `DayBudgetCard`'s content, hero-styled — remaining kcal count-up + segmented day-bar +
// 3 energy chips + 5 macro/rost/víz rings). Its water ring opens `WaterLogSheet` (→
// `useWaterActions`); its chips reopen `EnergyBreakdownSheet` (the retired page's wiring,
// restored). `KeretHero` carries no settings entry — that moved to `FuelSection`'s
// `SubNavDropdown` `extraAction` (the Me pattern), alongside every other Fuel sub-page.
//
// AI-score visszakötés (mezo-cs8b, solved here): the day's DONE windows no longer get their own
// per-window capsule — they merge into ONE expandable `DoneWindowsCapsule` (VM: `windowIslands.ts`'s
// `doneGroup`), sitting first in the sky (chronologically earliest). Each expanded row's `FuelMeal`
// role is derived here (`deriveMealRole` — no honest FE field exists, Task 1's finding); tapping a
// scored row reopens the existing `MealScoreSheet`, unchanged.
//
// Still-retired from the earlier window-river recomposition (mezo-jgh9 Task 5, unchanged by this
// pass): the `.pghead-np` header row + the medication D{n} link (medication leaks in as a FACT via the
// now-island's subtitle — `medPeak`), `medcycle-micro`, `NowWindowCard`, `MissedStrip`,
// `DayZoneCard`/`ZoneSlotRow`, the protocol-meta/Replan row.
//
// Scrolling (mezo-gllr): spec §2's "L0 nem görgethető" was written when the sky WAS the page
// (Today's model). With the KeretHero above it that no longer holds on a real phone — the sky
// carries `sky-flow`, so an island is never squeezed below its own content and the page scrolls
// when the day needs more room than the viewport gives it.
export function FuelMaiPage() {
  const navigate = useNavigate()
  const [params, setSearchParams] = useSearchParams()
  const { fuel } = useFuelDay()
  const { plan, budget, blocks, nowHHmm, energyBreakdown } = useFuelTimeline()
  const { cycle: medicationCycle } = useMedication()
  // Diet Plan slice 1 (mezo-xwgb): the fiber ring's target now comes from the user's own diet
  // settings instead of the static FIBER_TARGET_G default.
  const { settings: dietSettings } = useDietSettings()
  const { logWater } = useWaterActions()
  // The same stack/day composition FuelStackPage.tsx already uses, feeding matchMealsToStack —
  // buildWindowRiver takes EVERY today ('ma') verdict (one per zone) and each window picks the
  // ones matching its own slotKey, so a day with matches in multiple zones shows doses on every
  // matching window, not just one. A 'tegnap' verdict describes yesterday's zone and has no
  // honest home on today's sky, so it's filtered out here.
  const { slots: stackSlots } = useStackDay()
  const { recipes } = useRecipes()
  const yesterday = addDays(localDateString(), -1)
  const { fuel: yesterdayFuel } = useFuelDay(yesterday)

  const [logOpen, setLogOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiSlot, setAiSlot] = useState<MealSlot | undefined>(undefined)
  const [logPrefill, setLogPrefill] = useState<LogMealPrefill>(null)
  const [logInitialSlot, setLogInitialSlot] = useState<MealSlot | undefined>(undefined)
  const [waterOpen, setWaterOpen] = useState(false)
  const [energyOpen, setEnergyOpen] = useState<EnergySection | null>(null)
  const [scoreMeal, setScoreMeal] = useState<FuelMeal | null>(null)
  // Done-capsule kibontva — its own toggle, independent of `listOpen` below (a window's L1).
  const [doneOpen, setDoneOpen] = useState(false)
  // L1 open/closed — belongs to whichever WINDOW island is selected; a selection switch always closes it.
  const [listOpen, setListOpen] = useState(false)

  const heroResult = pickHeroWindow({
    slots: plan.slots, blocks, budget, consumed: { kcal: fuel.consumed.kcal, p: fuel.consumed.p }, nowHHmm,
  })
  // Honest gym-only signal straight off today's REAL blocks (deriveBlocks, already composed by
  // useFuelTimeline) — no second workoutTime hook, no invented source. Feeds both the window
  // subtitles (edzés-kapcsolat) and the done rows' MealRole derivation below.
  const workoutTime = blocks.find(b => b.kind === 'gym')?.time ?? null
  // The cycle's OWN current-day phaseKey (never a page-local re-hardcoded phase model) — 'peak'
  // is the one phase the design calls out as appetite-relevant (spec §3.2).
  const medPeak = medicationCycle.phaseKey === 'peak'
  const matchResult = matchMealsToStack(stackSlots, recipes, fuel.meals, yesterdayFuel.meals)
  const stackVerdicts = matchResult.verdicts.filter(v => v.dayLabel === 'ma')
  const river: WindowRiverVM = buildWindowRiver({
    plan, budget, hero: heroResult, stackVerdicts, workoutTime, medPeak, nowHHmm, meals: fuel.meals,
  })

  // Same filter+sort `buildWindowRiver` uses internally (its own `islandKey` isn't exported —
  // sight-unseen import contract, windowIslands.ts) so island key ↔ source FuelSlot stay in sync.
  const mealSlots = plan.slots
    .filter((s): s is FuelSlot & { slotKey: MealSlot } => s.slotKey != null)
    .sort((a, z) => toMin(a.time) - toMin(z.time))
  const slotByKey = new Map(mealSlots.map(s => [`${s.time}-${s.label}`, s]))

  // Static-fallback energy (real mode, no BMR): base equals the FULL segment kcal and
  // activity/balance are 0, so the breakdown chips would be meaningless — hide them (the retired
  // `DayBudgetCard`'s `staticEnergy` rule, same source signal, now feeding `buildKeretHero`).
  const staticEnergy = plan.energy.activity === 0 && plan.energy.balance === 0
  const keretHeroVm = buildKeretHero({
    budget, staticEnergy, consumed: fuel.consumed, meals: fuel.meals,
    water: { currentMl: fuel.consumed.water, targetMl: fuel.targets.water },
    slots: plan.slots, nowHHmm, fiberTargetG: dietSettings.fiberG,
  })

  // Done-capsule rows: `doneMealRows` joins each done slot's own meal (role always null there — no
  // honest FE field, per Task 1) — `deriveMealRole` fills it in here from today's workout time.
  // `clickable` mirrors `MealScoreSheet`'s own guard (it renders null without `meal.breakdown`) so
  // a breakdown-less row never offers a dead tap.
  const doneRows: DoneCapsuleRow[] = doneMealRows(fuel.meals, plan.slots).map((row) => {
    const meal = fuel.meals.find(m => m.id === row.mealId)
    return {
      mealId: row.mealId,
      name: row.name,
      time: row.time,
      kcal: row.kcal,
      proteinG: row.proteinG,
      role: deriveMealRole(row.time, workoutTime),
      scorePct: row.scorePct,
      clickable: meal?.breakdown != null,
    }
  })

  // `?w=` is the single source of truth for which WINDOW island is big — mirrors TodayPage's `?dp=`
  // rules (replace: true, delete on default, null/''/unknown all fall back). The retired `keret`
  // selection key is gone with the belt (mezo-c9t5) — a stale `?w=keret` link now simply falls back
  // to the default, exactly like any other unknown key.
  const validKeys = new Set<string>(river.islands.map(i => i.key))
  const raw = params.get('w')
  const selected = raw != null && validKeys.has(raw) ? raw : river.defaultKey
  const selectWindow = (key: string) => {
    setListOpen(false)
    const next = new URLSearchParams(params)
    if (key === river.defaultKey) next.delete('w')
    else next.set('w', key)
    setSearchParams(next, { replace: true })
  }

  const openLog = (prefill: LogMealPrefill = null, slot?: MealSlot) => {
    setLogPrefill(prefill)
    setLogInitialSlot(slot)
    setLogOpen(true)
  }
  // A log opened FROM a window always carries that window's slotKey — both branches (mezo-bnsf).
  // `buildDayPlan` files logged meals by slotKey alone (`loggedByKey[w.slotKey]`, never by
  // timestamp), so seeding the sheet from the wall clock instead — which the recipe-suggestion
  // branch used to do by omitting `initialSlot` — filled a DIFFERENT window and left this one
  // `missed`, still offering the same Pótold for a meal already logged.
  const handleLogMeal = (slot: FuelSlot) => {
    const slotKey = slot.slotKey ?? 'snack'
    if (slot.suggestedRecipeId) openLog({ source: 'recipe', recipeId: slot.suggestedRecipeId }, slotKey)
    else openLog(null, slotKey)
  }
  const handleAiLog = (slot: FuelSlot) => {
    setAiSlot(slot.slotKey)
    setAiOpen(true)
  }
  const openScoreForMeal = (mealId: string) => {
    const meal = fuel.meals.find(m => m.id === mealId)
    if (meal) setScoreMeal(meal)
  }

  return (
    <>
      <KeretHero vm={keretHeroVm} onChip={(section) => setEnergyOpen(section)} onWaterRing={() => setWaterOpen(true)} />

      {/* `sky-flow`: this page carries the KeretHero above the sky, so the islands must never
          be squeezed below their own content — the page scrolls instead (mezo-gllr). Today's
          plain `.sky-islands` keeps the viewport-fill model. */}
      <div className="sky-islands sky-flow">
        {mealSlots.length === 0 && <EmptyDayIsland onPlan={() => navigate('/fuel/plan')} />}
        {river.doneGroup && (
          <DoneWindowsCapsule
            group={river.doneGroup}
            rows={doneRows}
            open={doneOpen}
            onToggle={() => setDoneOpen((o) => !o)}
            onRowSelect={openScoreForMeal}
          />
        )}
        {river.islands.map((vm) => (
          <WindowIsland
            key={vm.key}
            vm={vm}
            big={selected === vm.key}
            nowRing={vm.key === river.nowKey}
            open={selected === vm.key && listOpen}
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
        ))}

        {/* Standing log row (mezo-66te) — the page's always-available meal-log entry. The
            Logold/AI CTAs live on the big window-island, which vanishes once every window is
            done; the + FAB's Étkezés tile only navigates here (QuickInputSheet is
            navigation-only, S1). Without this row an all-done evening has zero log paths. */}
        <div className="mai-logrow">
          <button type="button" className="isl-more" onClick={() => openLog()}>＋ Logolás</button>
          <button
            type="button"
            className="isl-more"
            onClick={() => { setAiSlot(undefined); setAiOpen(true) }}
          >
            ✨ AI naplózás
          </button>
        </div>
      </div>

      {logOpen && <LogMealSheet prefill={logPrefill} initialSlot={logInitialSlot} onClose={() => setLogOpen(false)} />}
      {waterOpen && (
        <WaterLogSheet
          currentMl={fuel.consumed.water}
          targetMl={fuel.targets.water}
          onLog={(ml) => logWater(ml)}
          onClose={() => setWaterOpen(false)}
        />
      )}
      {scoreMeal && <MealScoreSheet meal={scoreMeal} onClose={() => setScoreMeal(null)} />}
      {energyOpen && energyBreakdown && (
        <EnergyBreakdownSheet breakdown={energyBreakdown} initial={energyOpen} onClose={() => setEnergyOpen(null)} />
      )}
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
