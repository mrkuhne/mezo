// ============================================================
// Mezo · FuelMaiPage — the Fuel tab's hub Mozaik face (Design 2.0 F3.1, mezo-d20.4.1)
// Source of truth: docs/design_2.0/prototypes/src/fuel-body.html hub section (values
// ×1.18) + docs/design_2.0/2026-08-27-fuel-design-iterations.md §§1-2, whose v3
// declutter overrides the first-ship prototype where they differ.
//
// The Fuel shell (AppHero + SubNavDropdown + its ⚙️ Fuel-beállítások action) dissolves:
// this page IS the /fuel index, the former sub-tabs are full-page siblings on their
// stable routes — the idiom the Mezo (mezo-d20.5.1) and Én (mezo-d20.6.1) tabs took.
// The settings entry the dropdown owned moves onto this hub's Fuel-beállítások band.
//
// Anatomy top→bottom:
//   header recipe (date · bell · avatar)
//   keret-hero — ONE number, the kcal consumed today; day-bar + gold now-marker;
//     Alap/Mozgás/Cél chips that VANISH on static energy; 5 rings, víz = a button
//   window swimlane — one scroll-snap tile per eating window, no header (iterations §1)
//   Mezo banner — only the counter; the voice lives on /fuel/uzenetek (iterations §2)
//   6-tile mosaic: Terv · Stack · Receptek · Kamra · Gyógyszer · Napló
//   Fuel-beállítások band (→ FuelSettingsSheet → /fuel/slots)
//
// The data layer is untouched: the same composed day (useFuelDay/useFuelTimeline),
// the same mutations, the same sheets. Honest states are the contract — a tile line
// vanishes rather than fabricating a number, an unscored meal reads "✨ folyamatban",
// a missed window says "Pótold", never shame.
//
// Retired and DELETED in F8 (mezo-d20.9.1): DoneWindowsCapsule,
// WindowIsland + the `?w=` selection URL state, EmptyDayIsland, the `.mai-logrow`
// standing row (absorbed by the lane's trailing out-of-window tile), the sky shell.
// ============================================================
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EnergySection } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import type { FuelMeal, MealSlot } from '@/data/types'
import {
  useFuelDay, useFuelTimeline, useFuelWeek, useMedication, usePantry, useRecipes,
  useStackDay, useToday, useTodayScenario, useWaterActions, useCompanionFeed, resolveBriefing,
} from '@/data/hooks'
import { useNotificationFeed } from '@/data/notification/feedHooks'
import { toMin } from '@/data/fuel/fuelConfig'
import { buildKeretHero, aiAverage } from '@/features/fuel/logic/keretHero'
import { buildWindowLane, type WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import { fuelMezoMessages } from '@/features/fuel/logic/fuelMezoMessages'
import { buildKamraItems } from '@/features/fuel/logic/kamraItems'
import { buildMezoMessages } from '@/features/today/logic/mezoMessages'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { KeretHero } from '@/features/fuel/components/KeretHero'
import { WindowLane } from '@/features/fuel/components/WindowLane'
import type { LogFlowPrefill } from '@/features/fuel/pages/LogFlowPage'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'
import { MealScoreSheet } from '@/features/fuel/sheets/MealScoreSheet'
import { EnergyBreakdownSheet } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import { FuelSettingsSheet } from '@/features/fuel/sheets/FuelSettingsSheet'

export function FuelMaiPage() {
  const navigate = useNavigate()
  const { today } = useToday()
  const { fuel } = useFuelDay()
  const { plan, budget, nowHHmm, energyBreakdown } = useFuelTimeline()
  const { logWater } = useWaterActions()
  const { items: notifications } = useNotificationFeed()

  const [logOpen, setLogOpen] = useState(false)
  // The AI path is no longer a separate sheet (mezo-d20.4.2): it opens the SAME unified
  // log flow with its ✨ AI panel armed, so photo/text estimates and manual pantry/recipe
  // lines can ride in one meal.
  const [logAiOnMount, setLogAiOnMount] = useState(false)
  const [logPrefill, setLogPrefill] = useState<LogFlowPrefill>(null)
  const [logInitialSlot, setLogInitialSlot] = useState<MealSlot | undefined>(undefined)
  const [waterOpen, setWaterOpen] = useState(false)
  const [energyOpen, setEnergyOpen] = useState<EnergySection | null>(null)
  const [scoreMeal, setScoreMeal] = useState<FuelMeal | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ntfOpen, setNtfOpen] = useState(false)

  // ── keret-hero (unchanged VM, v3 face) ────────────────────────────────
  // Static-fallback energy (real mode, no BMR): base equals the FULL segment kcal and
  // activity/balance are 0, so the breakdown chips would be meaningless — the whole chip
  // row vanishes (the retired DayBudgetCard's `staticEnergy` rule, kept verbatim).
  const staticEnergy = plan.energy.activity === 0 && plan.energy.balance === 0
  const keretHeroVm = buildKeretHero({
    budget, staticEnergy, consumed: fuel.consumed, meals: fuel.meals,
    water: { currentMl: fuel.consumed.water, targetMl: fuel.targets.water },
    slots: plan.slots, nowHHmm,
  })

  // ── window swimlane ───────────────────────────────────────────────────
  const lane = buildWindowLane({ slots: plan.slots, budget, meals: fuel.meals })

  // ── Mezo banner: the counter only, never the voice (iterations §2) ─────
  const scenario = useTodayScenario()
  const feed = useCompanionFeed()
  const fuelMsgs = useMemo(
    () => fuelMezoMessages(buildMezoMessages({ feed, demoBriefing: resolveBriefing(scenario.dayState) })),
    [feed, scenario.dayState],
  )

  // ── tile lines — each from its own page's hook, honest while unresolved ──
  const { weeklyStats } = useFuelWeek()
  const tervLine = `Protein ${weeklyStats.proteinHitDays}/7 nap`

  const { slots: stackSlots } = useStackDay()
  const stackEntries = stackSlots.flatMap(s => s.entries.filter(e => !e.skippedToday))
  const stackTaken = stackEntries.filter(e => e.taken).length
  // "köv." is the next zone still AHEAD on the clock — a still-untaken morning zone is a
  // gap to catch up, not the next thing coming; fall back to the earliest untaken one when
  // the day has no upcoming zone left.
  const untakenZones = stackSlots.filter(s => s.entries.some(e => !e.skippedToday && !e.taken))
  const nextZone = untakenZones.find(s => toMin(s.time) >= toMin(nowHHmm)) ?? untakenZones[0]
  const stackLine = stackEntries.length === 0
    ? undefined
    : `${stackTaken}/${stackEntries.length} ma${nextZone ? ` · köv. ${nextZone.time}` : ''}`

  const { recipes } = useRecipes()
  const starred = recipes.filter(r => r.starred).length
  const recipeLine = recipes.length === 0
    ? undefined
    : `${recipes.length}${starred > 0 ? ` · ${starred} csillagos` : ''}`

  // The Kamra page's own item composition (ingredients + stash), so the tile counts
  // exactly what the page lists — not a second, drifting definition of "tétel".
  const { ingredients, stash } = usePantry()
  const pantryCount = buildKamraItems(ingredients, stash).length
  const kamraLine = pantryCount === 0 ? undefined : `${pantryCount} tétel`

  const { cycle } = useMedication()
  const medLine = cycle.cycleDay > 0 ? `D${cycle.cycleDay} · ${cycle.phaseLabel}` : undefined

  // Napló: today's own AI average off the logged meals — no fabricated 0 when nothing
  // is scored yet (`aiAverage` returns null and the line vanishes).
  const todayAvg = aiAverage(fuel.meals.map(m => (m.score != null ? Math.round(m.score * 100) : null)))
  const naploLine = todayAvg == null ? undefined : `AI-átlag ${todayAvg}`

  const unreadNtf = notifications.filter(n => n.readAt === null).length

  // ── actions ───────────────────────────────────────────────────────────
  const openLog = (prefill: LogFlowPrefill = null, slot?: MealSlot) => {
    setLogPrefill(prefill)
    setLogInitialSlot(slot)
    setLogOpen(true)
  }
  // A log opened FROM a window always carries that window's slotKey (mezo-bnsf):
  // `buildDayPlan` files logged meals by slotKey alone, so seeding from the wall clock
  // would fill a DIFFERENT window and leave this one missed.
  const logFromTile = (tile: WindowTileVM) => {
    const slot = plan.slots.find(s => `${s.time}-${s.label}` === tile.key)
    if (slot?.suggestedRecipeId) openLog({ source: 'recipe', recipeId: slot.suggestedRecipeId }, tile.slotKey)
    else openLog(null, tile.slotKey)
  }
  const aiFromTile = (tile: WindowTileVM) => {
    setLogAiOnMount(true)
    openLog(null, tile.slotKey)
  }
  const openScoreForMeal = (mealId: string) => {
    const meal = fuel.meals.find(m => m.id === mealId)
    if (meal) setScoreMeal(meal)
  }

  return (
    <div className="fh-hub">
      <div className="nap-head">
        <div className="nap-head-grow">
          <span className="mz-eyebrow">{today.dayLabel} · {today.dateLabel}</span>
        </div>
        <div className="nap-dpwrap">
          <button type="button" className="nap-roundbtn" aria-expanded={ntfOpen}
            aria-label={unreadNtf > 0 ? `Értesítések, ${unreadNtf} olvasatlan` : 'Értesítések'}
            onClick={() => setNtfOpen(o => !o)}>
            <ClayIcon name="i-ertesites" size={21} />
            {unreadNtf > 0 && <span className="nap-badge">{unreadNtf}</span>}
          </button>
          {ntfOpen && (
            <div className="nap-ntfmenu" role="menu">
              <span className="mz-eyebrow">Értesítések · ma</span>
              {notifications.slice(0, 3).map(n => (
                <button key={n.id} type="button" role="menuitem" className="nap-ntfrow"
                  onClick={() => { setNtfOpen(false); if (n.deeplink) navigate(n.deeplink) }}>
                  <span className="nap-ntf-t">{n.title}</span>
                  <span className="nap-ntf-x">{n.body}</span>
                </button>
              ))}
              <button type="button" role="menuitem" className="nap-ntffoot"
                onClick={() => { setNtfOpen(false); navigate('/me/ertesitesek') }}>
                Összes értesítés ›
              </button>
            </div>
          )}
        </div>
        <button type="button" className="nap-avatar" aria-label="Profil" onClick={() => navigate('/me')}>
          <ClayIcon name="i-mezo" size={19} />
        </button>
      </div>

      <EntranceGroup className="mz-panel-stack">
        <div className="fh-hero rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          <KeretHero
            vm={keretHeroVm}
            onChip={(section) => setEnergyOpen(section)}
            onWaterRing={() => setWaterOpen(true)}
          />
        </div>

        <div className="rise" style={{ '--d': '70ms' } as React.CSSProperties}>
          <WindowLane
            vm={lane}
            emptyDay={lane.tiles.length === 0}
            onPlanDay={() => navigate('/fuel/plan')}
            onLog={logFromTile}
            onAiLog={aiFromTile}
            onFreeLog={() => openLog()}
            onFreeAiLog={() => { setLogAiOnMount(true); openLog() }}
            onScore={openScoreForMeal}
          />
        </div>

        {/* The companion voice left the hero: the banner carries only the counter, the
            messages themselves live on /fuel/uzenetek. No fuel-context message today →
            the band stays a door, without a fabricated "0 új üzenet" count. */}
        <button type="button" className="fh-mezotile rise" style={{ '--d': '110ms' } as React.CSSProperties}
          aria-label="Mezo Fuel-üzenetek" onClick={() => navigate('/fuel/uzenetek')}>
          <ClaySpot name="s-orb" size={31} />
          <span className="txt">
            <b>Mezo</b>{fuelMsgs.length > 0 ? ` · ${fuelMsgs.length} új Fuel-üzenet ma` : ' · Fuel-üzenetek'}
          </span>
          {fuelMsgs.length > 0 && <span className="fh-mzdot" aria-hidden="true" />}
          <span className="chev" aria-hidden="true">›</span>
        </button>

        <Mosaic>
          <Tile wash="white" icon="i-rend" eyebrow="Terv" delayMs={160}
            line={tervLine} onClick={() => navigate('/fuel/plan')} aria-label="Terv" />
          <Tile wash="sage" icon="i-stack" eyebrow="Stack" delayMs={200} className="fh-eb-sage"
            line={stackLine} onClick={() => navigate('/fuel/stack')} aria-label="Stack" />
          <Tile wash="coral" icon="i-recept" eyebrow="Receptek" delayMs={240} className="fh-eb-coral"
            line={recipeLine} onClick={() => navigate('/fuel/recipes')} aria-label="Receptek" />
          <Tile wash="gold" icon="i-kamra" eyebrow="Kamra" delayMs={280} className="fh-eb-gold"
            line={kamraLine} onClick={() => navigate('/fuel/kamra')} aria-label="Kamra" />
          <Tile wash="lav" icon="i-injekcio" eyebrow="Gyógyszer" delayMs={320} className="fh-eb-lav"
            line={medLine} onClick={() => navigate('/fuel/gyogyszer')} aria-label="Gyógyszer" />
          <Tile wash="sky" icon="i-naplo" eyebrow="Napló" delayMs={360} className="fh-eb-sky"
            line={naploLine} onClick={() => navigate('/fuel/naplo')} aria-label="Napló" />
        </Mosaic>

        {/* The retired SubNavDropdown's ⚙️ Fuel-beállítások extra action, re-homed onto the
            hub (the Én hub's Beállítások band precedent) — it is also the ONLY route to the
            meal-window editor at /fuel/slots. */}
        <button type="button" className="fh-band rise" style={{ '--d': '400ms' } as React.CSSProperties}
          aria-label="Fuel-beállítások" onClick={() => setSettingsOpen(true)}>
          <ClayIcon name="i-beallitas" size={26} />
          <span className="txt"><b>Fuel-beállítások</b> · étkezési ablakok, koffein-stop</span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
      </EntranceGroup>

      {logOpen && <LogFlowPage prefill={logPrefill} initialSlot={logInitialSlot} aiPanelOpenOnMount={logAiOnMount} onClose={() => { setLogOpen(false); setLogAiOnMount(false) }} />}
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
      {settingsOpen && <FuelSettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
