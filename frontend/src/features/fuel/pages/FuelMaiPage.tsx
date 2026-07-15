import { useState } from 'react'
import type { FuelMeal, FuelSlot, MealSlot } from '@/data/types'
import { useFuelDay, useFuelTimeline, useProtocol, useReplanScenarios, useTodayScenario, useWaterActions } from '@/data/hooks'
import { slotKeyOfLabel } from '@/data/fuel/fuelConfig'
import type { LogMealPrefill } from '@/features/fuel/sheets/LogMealSheet'
import { Icon } from '@/shared/ui/Icon'
import { RetaPhaseBar } from '@/shared/ui/RetaPhaseBar'
import { ProgressBar } from '@/shared/ui/ProgressBar'
import { pct } from '@/shared/lib/pct'
import { KcalGauge } from '@/features/fuel/components/KcalGauge'
import { FuelTimeline } from '@/features/fuel/components/FuelTimeline'
import { PacingCard } from '@/features/fuel/components/PacingCard'
import { MealScoreSheet } from '@/features/fuel/sheets/MealScoreSheet'
import { ReplanSheet } from '@/features/fuel/sheets/ReplanSheet'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'

// Napiv Mai recomposition (spec §4.4, mezo-8141): pghead-np sage header → RetaPhaseBar →
// gauge card (KcalGauge + fuelchips + macro soft bars) → aistrip (PacingCard) → timeline
// (secthead-np + protocol meta + FuelTimeline, unchanged mount) → NEW water .slot →
// micronutrients. The retired context-strip card's gym/vb data lives on in the timeline's
// workout/sport blocks; its coffee/kitchen cells moved into .fuelchips. MacroHero unmounted
// here (kcal → gauge, macro cells → .macror, water → the water slot) — file kept, S8 decides
// deletion once its last consumer (this page) drops it; see task-4 report for the orphan check.
export function FuelMaiPage() {
  const { fuel } = useFuelDay()
  const { plan, getScoredMeal } = useFuelTimeline()
  const { protocol } = useProtocol()
  const { retaDay } = useTodayScenario()
  const { logWater } = useWaterActions()
  // Honest-empty in real mode (replan engine is P8) — no scenarios, no Replan CTA (mezo-t16y.4).
  const { scenarios: replanScenarios } = useReplanScenarios()

  const [scoreMeal, setScoreMeal] = useState<FuelMeal | null>(null)
  const [replanOpen, setReplanOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [logPrefill, setLogPrefill] = useState<LogMealPrefill>(null)
  const [logInitialSlot, setLogInitialSlot] = useState<MealSlot | undefined>(undefined)

  const doneCount = plan.slots.filter(s => s.state === 'done').length
  const waterPct = pct(fuel.consumed.water, fuel.targets.water)

  // Tap-to-log a planner slot: a recipe suggestion prefills the sheet from that recipe; a budget-only
  // window opens the sheet on its mapped slot (label → MealSlot) so the user just picks items.
  const openLog = (prefill: LogMealPrefill = null, slot?: MealSlot) => {
    setLogPrefill(prefill)
    setLogInitialSlot(slot)
    setLogOpen(true)
  }
  const handleLogMeal = (slot: FuelSlot) => {
    if (slot.suggestedRecipeId) openLog({ source: 'recipe', recipeId: slot.suggestedRecipeId })
    else openLog(null, slotKeyOfLabel(slot.label))
  }

  return (
    <>
      {/* Header */}
      <div className="pghead-np sage">
        <div>
          <div className="over">Fuel · Reta D{retaDay} · kcal floor 2500</div>
          <h1>Mai pacing</h1>
        </div>
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

      {/* Reta phase context */}
      <RetaPhaseBar day={retaDay} />

      {/* Gauge card — kcal gauge + coffee/kitchen chips + macro soft bars */}
      <div style={{ padding: '16px 24px 12px' }}>
        <div className="card notch-12" style={{ padding: 18 }}>
          <KcalGauge consumed={fuel.consumed.kcal} target={fuel.targets.kcal} />

          <div className="fuelchips">
            <span className="chx" style={{ background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}>
              kávé cutoff {plan.caffeineCutoff}
            </span>
            <span className="chx" style={{ background: 'var(--wash-lav)', color: 'var(--lav-deep)' }}>
              konyha zár {plan.kitchenClose}
            </span>
          </div>

          <div className="macror">
            <div className="mac">
              <span className="k">Fehérje</span>
              <span className="bar"><i style={{ width: pct(fuel.consumed.p, fuel.targets.p) + '%', background: 'var(--sage)' }} /></span>
              <span className="v">{fuel.consumed.p} / {fuel.targets.p} g</span>
            </div>
            <div className="mac">
              <span className="k">Szénhidrát</span>
              <span className="bar"><i style={{ width: pct(fuel.consumed.c, fuel.targets.c) + '%', background: 'var(--amber)' }} /></span>
              <span className="v">{fuel.consumed.c} / {fuel.targets.c} g</span>
            </div>
            <div className="mac">
              <span className="k">Zsír</span>
              <span className="bar"><i style={{ width: pct(fuel.consumed.f, fuel.targets.f) + '%', background: 'var(--lav)' }} /></span>
              <span className="v">{fuel.consumed.f} / {fuel.targets.f} g</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pacing insight */}
      <PacingCard pacing={fuel.pacing} />

      {/* Timeline — meals + supplements + workout/sport blocks (gym/vb context now lives here) */}
      <div style={{ padding: '16px 24px 8px' }}>
        <div className="secthead-np">
          <h3>Mai timeline</h3>
          <span>{doneCount}/{plan.slots.length} slot</span>
        </div>
        {/* Protocol meta row — hidden when there is no active protocol yet (real-mode ghost, v0) */}
        {protocol.version > 0 && (
          <div
            className="row gap-sm"
            style={{
              padding: '8px 10px',
              marginBottom: 12,
              borderRadius: 14,
              background: 'var(--warm)',
              alignItems: 'center',
            }}
          >
            <Icon name="sparkle" size={11} color="var(--sage-deep)" />
            <div className="col flex-1" style={{ minWidth: 0 }}>
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--sage-deep)' }}>
                Stack · v{protocol.version} · {protocol.builtAt}
              </span>
              <span className="label-mono text-tertiary" style={{ fontSize: 8, marginTop: 1 }}>
                {protocol.lastReplanReason
                  ? '↳ ' + protocol.lastReplanReason
                  : protocol.itemCount + ' item · conf ' + (protocol.confidence * 100).toFixed(0) + '%'}
              </span>
            </div>
            {replanScenarios.length > 0 && (
              <button
                type="button"
                onClick={() => setReplanOpen(true)}
                className="chx"
                style={{ background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}
              >
                <Icon name="tool" size={10} /> Replan
              </button>
            )}
          </div>
        )}
        <FuelTimeline slots={plan.slots} getScoredMeal={getScoredMeal} onOpenScore={setScoreMeal} onLogMeal={handleLogMeal} />
      </div>

      {/* Water — NEW dedicated slot (replaces MacroHero's water row) */}
      <div style={{ padding: '0 24px 8px' }}>
        <div className="slot">
          <span className="fav" role="img" aria-label="Víz" style={{ background: 'var(--wash-run)' }}>💧</span>
          <div className="tx">
            <div className="t1">Víz · {fuel.consumed.water} / {fuel.targets.water} ml</div>
            <div className="mrow">{waterPct.toFixed(0)}% · cél</div>
          </div>
          <div className="row gap-xs" style={{ flexShrink: 0 }}>
            {[250, 500].map(ml => (
              <button
                key={ml}
                type="button"
                className="chx"
                aria-label={`Víz +${ml} ml`}
                style={{ background: 'var(--wash-run)', color: 'var(--tag-run)' }}
                onClick={() => logWater(ml)}
              >
                +{ml}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Micronutrients */}
      <div style={{ padding: '16px 24px 24px' }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Mikrotápanyagok · heti</div>
        <div className="card notch-4" style={{ padding: 14 }}>
          <div className="col gap-md">
            {fuel.micronutrients.map((n, i) => (
              <div key={i} className="row gap-md">
                <span
                  className="label-mono"
                  style={{ width: 36, color: n.pct < 70 ? 'var(--warning)' : 'var(--text-primary)' }}
                >
                  {n.name}
                </span>
                <ProgressBar className="flex-1" value={n.pct} tone={n.pct < 70 ? 'warning' : 'glow'} />
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-tertiary)', width: 56, textAlign: 'right' }}>
                  {n.pct}% · {n.target}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {scoreMeal && <MealScoreSheet meal={scoreMeal} onClose={() => setScoreMeal(null)} />}
      {replanOpen && <ReplanSheet onClose={() => setReplanOpen(false)} />}
      {logOpen && <LogMealSheet prefill={logPrefill} initialSlot={logInitialSlot} onClose={() => setLogOpen(false)} />}
    </>
  )
}
