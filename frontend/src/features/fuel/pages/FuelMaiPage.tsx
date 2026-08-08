import { Fragment, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { FuelSlot, MealSlot } from '@/data/types'
import {
  useFuelDay, useFuelTimeline, useMedication, useProtocol, useReplanScenarios, useWaterActions,
} from '@/data/hooks'
import { toMin } from '@/data/fuel/fuelConfig'
import { pickHeroWindow } from '@/features/fuel/logic/heroWindow'
import { buildWindowRiver, type WindowRiverVM } from '@/features/fuel/logic/windowIslands'
import { WindowIsland } from '@/features/fuel/components/WindowIsland'
import { KeretBelt } from '@/features/fuel/components/KeretBelt'
import type { LogMealPrefill } from '@/features/fuel/sheets/LogMealSheet'
import { Icon } from '@/shared/ui/Icon'
import { ReplanSheet } from '@/features/fuel/sheets/ReplanSheet'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'
import { AiLogSheet } from '@/features/fuel/sheets/AiLogSheet'
import { FuelSettingsSheet } from '@/features/fuel/sheets/FuelSettingsSheet'
import { localDateString } from '@/shared/lib/dates'

// Ablak-folyam recomposition (spec 2026-08-08, mezo-jgh9): the Mai screen becomes a non-scrolling
// sky of window-islands (one per meal slot, chronological) with the always-visible Keret-öv
// sitting right after the NOW-island — Today's three-islands language (`shared/ui/Island`) applied
// to Fuel's own unit, the eating window. `?w=` is the single source of truth for which island is
// big (no param → river.defaultKey), mirroring TodayPage's `?dp=` rules exactly (replace: true,
// delete on default, null/''/unknown all fall back).
//
// Retired here (mezo-jgh9 Task 5 — actual file deletion is Task 6's job): the `.pghead-np` header
// row + the Reta D{n} link (Reta now leaks in as a FACT, via the now-island's subtitle —
// `retaPeak`), `retamicro`, `NowWindowCard` (its `pickHeroWindow` projection survives, just feeds
// `buildWindowRiver` now), `MissedStrip` (a missed window is just an island in the `missed` state),
// `DayZoneCard`/`ZoneSlotRow` (zones retire — every meal slot is its own island), `DayBudgetCard`
// (its content lives in the Keret-öv's kibontott view now). The meal-coach tagline/score-chip
// surface (`useMealCoach`, `MealScoreSheet`, `getScoredMeal`) rode ONLY on the retired
// `ZoneSlotRow` — `WindowIsland` has no equivalent slot, so it has no home here anymore (P8 scope
// per spec §8: the window island's own day-score fact cell stays null until a per-window score
// feed exists). Likewise `EnergyBreakdownSheet`'s drill-down chips: the Keret-öv's kibontott view
// already prints the full breakdown inline, so there is no "honnan a cél" chip left to open it.
export function FuelMaiPage() {
  const navigate = useNavigate()
  const [params, setSearchParams] = useSearchParams()
  const { fuel } = useFuelDay()
  const { plan, budget, blocks, nowHHmm } = useFuelTimeline()
  const { protocol } = useProtocol()
  const { cycle: medicationCycle } = useMedication()
  const { logWater } = useWaterActions()
  // Honest-empty in real mode (replan engine is P8) — no scenarios, no Replan CTA (mezo-t16y.4).
  const { scenarios: replanScenarios } = useReplanScenarios()

  const [replanOpen, setReplanOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiSlot, setAiSlot] = useState<MealSlot | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logPrefill, setLogPrefill] = useState<LogMealPrefill>(null)
  const [logInitialSlot, setLogInitialSlot] = useState<MealSlot | undefined>(undefined)
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
  // Stack-dose badges inside a window need `matchMealsToStack`'s live day composition
  // (useStackDay + today's/yesterday's logged meals) — out of this task's hook list; wiring it is
  // future work, so every island's stack-dose group stays empty for now (never a fabricated dose).
  const river: WindowRiverVM = buildWindowRiver({
    plan, budget, hero: heroResult, stackVerdict: null, workoutTime, retaPeak, nowHHmm,
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
  // window (every window done) it lands after the last island instead.
  const beltAfterKey = river.nowKey ?? river.islands.at(-1)?.key ?? null
  const keretBelt = (
    <KeretBelt
      big={selected === 'keret'}
      budget={budget}
      consumed={fuel.consumed}
      water={{ currentMl: fuel.consumed.water, targetMl: fuel.targets.water, onAdd250: () => logWater(250) }}
      activityLabel={activityLabel}
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
              onStackDose={() => navigate('/fuel/stack')}
            />
            {vm.key === beltAfterKey && keretBelt}
          </Fragment>
        ))}
        {beltAfterKey === null && keretBelt}
      </div>

      {/* Kitchen close / caffeine cutoff — reference data, at the end of the day it belongs to */}
      <div className="zrow" style={{ margin: '0 24px 9px', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--np-shadow-row)' }}>
        <span className="zf" role="img" aria-label="Konyha" style={{ background: 'var(--warm)' }}>🍽</span>
        <div className="zt">
          <div className="a">Konyha zár · {plan.kitchenClose}</div>
          <div className="b"><span>kávé cutoff {plan.caffeineCutoff}</span></div>
        </div>
        <button
          type="button" className="chip" aria-label="Fuel beállítások"
          onClick={() => setSettingsOpen(true)} style={{ fontSize: 9, padding: '3px 8px' }}
        >
          szerkeszt
        </button>
      </div>

      {/* Protocol meta — hidden when there is no active protocol yet (real-mode ghost, v0) */}
      {protocol.version > 0 && (
        <div className="zrow" style={{ margin: '0 24px 16px', background: 'var(--warm)', borderRadius: 20 }}>
          <Icon name="sparkle" size={11} color="var(--sage-deep)" />
          <div className="zt">
            <div className="a" style={{ fontSize: 11, color: 'var(--sage-deep)' }}>
              Stack · v{protocol.version} · {protocol.builtAt}
            </div>
            <div className="b">
              <span>
                {protocol.lastReplanReason
                  ? '↳ ' + protocol.lastReplanReason
                  : protocol.itemCount + ' item · conf ' + (protocol.confidence * 100).toFixed(0) + '%'}
              </span>
            </div>
          </div>
          {replanScenarios.length > 0 && (
            <button
              type="button" onClick={() => setReplanOpen(true)} className="chx"
              style={{ background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}
            >
              <Icon name="tool" size={10} /> Replan
            </button>
          )}
        </div>
      )}

      {replanOpen && <ReplanSheet onClose={() => setReplanOpen(false)} />}
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
