import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FuelMeal, FuelSlot, MealSlot } from '@/data/types'
import {
  useFuelDay, useFuelTimeline, useMealCoach, useProtocol, useReplanScenarios, useTodayScenario, useWaterActions,
} from '@/data/hooks'
import { toMin } from '@/data/fuel/fuelConfig'
import { buildDayZones, isMealSlot } from '@/features/fuel/logic/dayZones'
import { pickHeroWindow } from '@/features/fuel/logic/heroWindow'
import { NowWindowCard } from '@/features/fuel/components/NowWindowCard'
import { MissedStrip } from '@/features/fuel/components/MissedStrip'
import { DayBudgetCard } from '@/features/fuel/components/DayBudgetCard'
import { DayZoneCard } from '@/features/fuel/components/DayZoneCard'
import { ZoneSlotRow } from '@/features/fuel/components/ZoneSlotRow'
import type { LogMealPrefill } from '@/features/fuel/sheets/LogMealSheet'
import { Icon } from '@/shared/ui/Icon'
import { MealScoreSheet } from '@/features/fuel/sheets/MealScoreSheet'
import { ReplanSheet } from '@/features/fuel/sheets/ReplanSheet'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'
import { AiLogSheet } from '@/features/fuel/sheets/AiLogSheet'
import { FuelSettingsSheet } from '@/features/fuel/sheets/FuelSettingsSheet'
import { EnergyBreakdownSheet, type EnergySection } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import { localDateString } from '@/shared/lib/dates'

// Guided recomposition (spec 2026-07-28, mezo-rrtj): one-line header + Reta micro-strip → the
// NowWindowCard hero (the day's single open decision) → MissedStrip → DayBudgetCard (remaining kcal,
// "honnan a napi cél" chips, named macro rows incl. water) → napszak DayZoneCards → protocol footer.
// Retired here: the "Mai cél" card + KcalGauge (they printed the SAME number twice), the static-seed
// PacingCard prose and the static-seed weekly micronutrients, and the flat FuelTimeline/SlotCard
// chain (its behaviour lives in ZoneSlotRow). Nothing that had a real source was dropped.
const RETA_PHASE_CLS = ['pk', 'pk', 'pk', 'stb', 'stb', 'tr', 'tr'] as const

export function FuelMaiPage() {
  const navigate = useNavigate()
  const { fuel } = useFuelDay()
  const { plan, budget, blocks, weightKg, energyBreakdown, wake, bed, nowHHmm, getScoredMeal } = useFuelTimeline()
  // Coach verdicts ride a SEPARATE request so the deterministic day never waits on an LLM
  // roundtrip; `isPending` is what makes that expensive call visible (mezo-rrtj).
  const { verdicts, isPending: coachPending } = useMealCoach(localDateString())
  const { protocol } = useProtocol()
  const { retaDay } = useTodayScenario()
  const { logWater } = useWaterActions()
  // Honest-empty in real mode (replan engine is P8) — no scenarios, no Replan CTA (mezo-t16y.4).
  const { scenarios: replanScenarios } = useReplanScenarios()

  const [scoreMeal, setScoreMeal] = useState<FuelMeal | null>(null)
  const [replanOpen, setReplanOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiSlot, setAiSlot] = useState<MealSlot | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [energyOpen, setEnergyOpen] = useState<EnergySection | null>(null)
  const [logPrefill, setLogPrefill] = useState<LogMealPrefill>(null)
  const [logInitialSlot, setLogInitialSlot] = useState<MealSlot | undefined>(undefined)

  const zones = buildDayZones({ slots: plan.slots, wake, bed, blocks, weightKg })
  const { hero, missed } = pickHeroWindow({
    slots: plan.slots, blocks, budget, consumed: { kcal: fuel.consumed.kcal, p: fuel.consumed.p },
  })
  const windows = plan.slots.filter(isMealSlot)
  const doneWindows = windows.filter(s => s.state === 'done')
  // Static-fallback energy (real mode, no BMR): base equals the FULL segment kcal and
  // activity/balance are 0, so the breakdown chips would be meaningless — hide them.
  const staticEnergy = plan.energy.activity === 0 && plan.energy.balance === 0
  const daySpan = Math.max(1, (toMin(bed) <= toMin(wake) ? toMin(bed) + 1440 : toMin(bed)) - toMin(wake))
  const nowFrac = Math.min(1, Math.max(0, (toMin(nowHHmm) - toMin(wake)) / daySpan))

  const getTagline = (slot: FuelSlot) => {
    const meal = getScoredMeal(slot)
    return meal ? (verdicts[meal.id]?.tagline ?? null) : null
  }

  const openLog = (prefill: LogMealPrefill = null, slot?: MealSlot) => {
    setLogPrefill(prefill)
    setLogInitialSlot(slot)
    setLogOpen(true)
  }
  const handleLogMeal = (slot: FuelSlot) => {
    if (slot.suggestedRecipeId) openLog({ source: 'recipe', recipeId: slot.suggestedRecipeId })
    else openLog(null, slot.slotKey ?? 'snack')
  }
  const handleLogOther = (slot: FuelSlot) => openLog(null, slot.slotKey ?? 'snack')
  const handleAiLog = (slot: FuelSlot) => {
    setAiSlot(slot.slotKey)
    setAiOpen(true)
  }

  return (
    <>
      {/* Header — one row; the Reta phase is the link to the medication page */}
      <div className="pghead-np sage">
        <div>
          <button
            type="button"
            className="over"
            aria-label="Reta ciklus megnyitása"
            onClick={() => navigate('/fuel/gyogyszer')}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
          >
            Fuel · Reta D{retaDay} ›
          </button>
          <h1>A mai nap</h1>
        </div>
        <div className="row gap-xs" style={{ flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => { setAiSlot(undefined); setAiOpen(true) }}
            className="pgact-np np-press"
            aria-label="AI naplózás"
            style={{ background: 'var(--wash-lav)', color: 'var(--lav-deep)' }}
          >
            <Icon name="sparkle" size={12} /> AI
          </button>
          <button
            type="button"
            onClick={() => openLog()}
            className="pgact-np np-press"
            aria-label="Logolás"
            style={{ background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}
          >
            <Icon name="plus" size={12} /> Log
          </button>
        </div>
      </div>

      <div className="retamicro" role="img" aria-label={`Reta ciklus — ${retaDay}. nap`}>
        {RETA_PHASE_CLS.map((cls, i) => (
          <i key={i} className={`${cls}${i + 1 === retaDay ? ' cur' : ''}`} />
        ))}
      </div>

      <NowWindowCard
        hero={hero}
        onLogMeal={handleLogMeal}
        onAiLog={handleAiLog}
        onLogOther={handleLogOther}
        onLogEmpty={() => openLog()}
      />

      <MissedStrip slots={missed} onLogMeal={handleLogMeal} />

      <DayBudgetCard
        consumed={fuel.consumed}
        budget={budget}
        waterTarget={fuel.targets.water}
        energy={plan.energy}
        staticEnergy={staticEnergy}
        loggedKcals={doneWindows.map(s => s.kcal ?? 0)}
        doneCount={doneWindows.length}
        totalCount={windows.length}
        nowFrac={hero.kind === 'open' ? nowFrac : null}
        onOpenEnergy={(section) => energyBreakdown && setEnergyOpen(section)}
        onLogWater={logWater}
      />

      {zones.map((zone, zi) => (
        <DayZoneCard key={zone.key} zone={zone} index={zi}>
          {zone.slots.map((slot, si) => (
            <ZoneSlotRow
              key={`${zone.key}-${si}`}
              slot={slot}
              scoredMeal={getScoredMeal(slot)}
              tagline={getTagline(slot)}
              coachPending={coachPending}
              burnKcal={zone.burnKcal}
              anchored={hero.kind === 'open' && slot === hero.slot}
              onOpenScore={setScoreMeal}
              onLogMeal={handleLogMeal}
              onAiLog={handleAiLog}
              onOpenStack={() => navigate('/fuel/stack')}
            />
          ))}
        </DayZoneCard>
      ))}

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

      {scoreMeal && <MealScoreSheet meal={scoreMeal} onClose={() => setScoreMeal(null)} />}
      {replanOpen && <ReplanSheet onClose={() => setReplanOpen(false)} />}
      {logOpen && <LogMealSheet prefill={logPrefill} initialSlot={logInitialSlot} onClose={() => setLogOpen(false)} />}
      {settingsOpen && <FuelSettingsSheet onClose={() => setSettingsOpen(false)} />}
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
