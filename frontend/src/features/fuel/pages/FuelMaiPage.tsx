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
//   the shell fejléc (app/AppHeader.tsx, mezo-atry)
//   keret-hero — ONE number, the kcal consumed today; day-bar + gold now-marker;
//     Alap/Mozgás/Cél chips that VANISH on static energy; 5 rings, víz = a button
//   Logolás hero tile — ONE live door to /fuel/log (mezo-byo1; the swimlane dissolved)
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
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EnergySection } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import {
  useDietSettings, useFuelDay, useFuelTimeline, useFuelWeek, useMedication, usePantry, useRecipes,
  useStackDay, useWaterActions,
} from '@/data/hooks'
import { toMin } from '@/data/fuel/fuelConfig'
import { buildKeretHero, aiAverage } from '@/features/fuel/logic/keretHero'
import { buildWindowLane, asPastDayLane } from '@/features/fuel/logic/fuelSwimlane'
import { buildKamraItems } from '@/features/fuel/logic/kamraItems'
import { addDays, localDateString, huMonthDay } from '@/shared/lib/dates'
import { ClayIcon } from '@/shared/ui/clay'
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { KeretHero } from '@/features/fuel/components/KeretHero'
import { FuelLogHeroTile } from '@/features/fuel/components/FuelLogHeroTile'
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'
import { EnergyBreakdownSheet } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import { FuelSettingsSheet } from '@/features/fuel/sheets/FuelSettingsSheet'

export function FuelMaiPage() {
  const navigate = useNavigate()
  const { fuel } = useFuelDay()
  const { plan, budget, nowHHmm, energyBreakdown } = useFuelTimeline()
  // Diet Plan slice 1 (mezo-xwgb): the fiber ring's target now comes from the user's own diet
  // settings instead of the static FIBER_TARGET_G default.
  const { settings: dietSettings } = useDietSettings()
  const { logWater } = useWaterActions()

  const [waterOpen, setWaterOpen] = useState(false)
  const [energyOpen, setEnergyOpen] = useState<EnergySection | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // ── keret-hero (unchanged VM, v3 face) ────────────────────────────────
  // Static-fallback energy (real mode, no BMR): base equals the FULL segment kcal and
  // activity/balance are 0, so the breakdown chips would be meaningless — the whole chip
  // row vanishes (the retired DayBudgetCard's `staticEnergy` rule, kept verbatim).
  const staticEnergy = plan.energy.activity === 0 && plan.energy.balance === 0
  const keretHeroVm = buildKeretHero({
    budget, staticEnergy, consumed: fuel.consumed, meals: fuel.meals,
    water: { currentMl: fuel.consumed.water, targetMl: fuel.targets.water },
    slots: plan.slots, nowHHmm, fiberTargetG: dietSettings.fiberG,
  })

  // ── the Logolás hero tile's VM (the /fuel/log page reads the same lane) ─
  const lane = buildWindowLane({ slots: plan.slots, budget, meals: fuel.meals })

  // ── hub-csali chip: tegnap pótolható ablakok (mezo-1j3z) — past-normalized lane,
  // ONE live door into `/fuel/log?d=<tegnap>`; hides itself when nothing is missed.
  const yesterday = addDays(localDateString(), -1)
  const { fuel: fuelY, isPending: yPending } = useFuelDay(yesterday)
  const { plan: planY, budget: budgetY } = useFuelTimeline(yesterday)
  const laneY = asPastDayLane(buildWindowLane({ slots: planY.slots, budget: budgetY, meals: fuelY.meals }))
  const yMissed = laneY.tiles.filter(t => t.state === 'missed').length

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

  return (
    <div className="fh-hub">
      <EntranceGroup className="mz-panel-stack">
        <div className="fh-hero rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          <KeretHero
            vm={keretHeroVm}
            onChip={(section) => setEnergyOpen(section)}
            onWaterRing={() => setWaterOpen(true)}
          />
        </div>

        {/* The window swimlane dissolved (mezo-byo1): the whole day's logging lives on
            /fuel/log, and the hub carries ONE live door to it — the Logolás hero tile. */}
        <div className="rise" style={{ '--d': '70ms' } as React.CSSProperties} data-kalauz-anchor="fuel-log">
          <FuelLogHeroTile vm={lane} onOpen={() => navigate('/fuel/log')}
            pastHint={!yPending && yMissed > 0 ? {
              dateLabel: `${huMonthDay(yesterday).toLowerCase()}.`,
              count: yMissed,
              onOpen: () => navigate(`/fuel/log?d=${yesterday}`),
            } : null} />
        </div>

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

      {waterOpen && (
        <WaterLogSheet
          currentMl={fuel.consumed.water}
          targetMl={fuel.targets.water}
          onLog={(ml) => logWater(ml)}
          onClose={() => setWaterOpen(false)}
        />
      )}
      {energyOpen && energyBreakdown && (
        <EnergyBreakdownSheet breakdown={energyBreakdown} initial={energyOpen} onClose={() => setEnergyOpen(null)} />
      )}
      {settingsOpen && <FuelSettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
