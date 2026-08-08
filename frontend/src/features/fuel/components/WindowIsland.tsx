// ============================================================
// Mezo · WindowIsland — a single meal-window's bigview + L1 (mezo-jgh9,
// Fuel window-river Task 4). Rides the shared `Island` shell (`tone="fuel"`)
// the same way KeretBelt (Task 3) rides `tone="keret"`: L0 is hero (window
// time + name) + meal-chip + 1–2 DS delta-fact cells + action row, mirroring
// Today's `IslandMorning` idiom. `open` mutually exclusive-swaps L0 for the
// L1 groups (ablak étkezése / csere / AI / stack-adagok), the same shape
// `IslandList` uses on Today, but in the `ItemRow` language directly (no
// `TodayItem` — this is Fuel's own VM).
// Design: docs/superpowers/specs/2026-08-08-fuel-window-river-design.md §3.
// ============================================================
import { Island, type IslandCapsule } from '@/shared/ui/Island'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { WindowIslandVM, WindowFacts } from '@/features/fuel/logic/windowIslands'

export interface WindowIslandProps {
  vm: WindowIslandVM
  big: boolean
  nowRing: boolean
  /** L1 nyitva. */
  open: boolean
  /** "✓ 2 ablak kész ma · 840 kcal · átlag 90 pont" — csak a now-szigeten. */
  doneSummary: string | null
  onSelect: () => void
  onToggleOpen: () => void
  /** LogMealSheet a slotra. */
  onLog: () => void
  /** AiLogSheet. */
  onAiLog: () => void
  /** Csere → /fuel/recipes szűrve (nav). */
  onSwap: () => void
  /** Adag-pipa. */
  onStackDose: (name: string) => void
}

type Meal = NonNullable<WindowIslandVM['meal']>

interface FactCell {
  value: string
  unit: string
  label: string
  delta: { text: string; tone: 'good' | 'warn' }
}

// A "real" meal idea exists unless the vm carries none, or it's the budget-only fallback
// (windowIslands.buildMeal falls back name → the slot label when there's no plan/log source).
function isGhostMeal(vm: WindowIslandVM): boolean {
  return vm.meal == null || (!vm.meal.fromPlan && vm.meal.name === vm.title)
}

// "a tervből · 650 kcal · 42 g P" — parts that HAVE a source only, no `—` fabrication.
function mealMetaParts(meal: Meal): string[] {
  const parts: string[] = []
  if (meal.fromPlan) parts.push('a tervből')
  if (meal.kcal != null) parts.push(`${meal.kcal} kcal`)
  if (meal.p != null) parts.push(`${meal.p} g P`)
  return parts
}

function buildFactCells(facts: WindowFacts): FactCell[] {
  const cells: FactCell[] = []
  if (facts.proteinJump) {
    const { addG, fromG, toG, pctOfTarget } = facts.proteinJump
    cells.push({
      value: `+${addG}`,
      unit: 'g',
      label: 'Fehérje-ugrás',
      delta: { text: `${fromG} → ${toG} · a céled ${pctOfTarget}%-a`, tone: 'good' },
    })
  }
  if (facts.dayScore) {
    const { avg, aboveWeekly } = facts.dayScore
    cells.push({
      value: String(avg),
      unit: 'p',
      label: 'Nap-score eddig',
      delta: {
        text: aboveWeekly ? 'a heti átlagod felett' : 'a heti átlagod alatt',
        tone: aboveWeekly ? 'good' : 'warn',
      },
    })
  }
  return cells
}

export function WindowIsland({
  vm, big, nowRing, open, doneSummary, onSelect, onToggleOpen, onLog, onAiLog, onSwap, onStackDose,
}: WindowIslandProps) {
  const capsule: IslandCapsule = { emoji: vm.emoji, title: vm.title, essence: vm.essence, count: vm.count }
  const ariaLabel = `${vm.title}${nowRing ? ' · most' : ''} · ${vm.essence} · megnyitás`
  const ctaLabel = vm.state === 'missed' ? 'Pótold' : 'Logold'
  const ghostMeal = isGhostMeal(vm)
  const factCells = buildFactCells(vm.facts)

  return (
    <Island tone="fuel" big={big} nowRing={nowRing} capsule={capsule} ariaLabel={ariaLabel} onSelect={onSelect}>
      {open ? (
        <>
          <div className="isl-openhead">{vm.emoji} {vm.title}</div>
          <div className="isl-l1">
            <div className="isl-grouph"><span>Ablak étkezése</span></div>
            <ItemRow
              tone="fuel"
              emoji={vm.emoji}
              title={vm.meal?.name ?? vm.title}
              subtitle={!ghostMeal && vm.meal ? mealMetaParts(vm.meal).join(' · ') : null}
              actionLabel={ctaLabel}
              onAction={onLog}
            />

            <div className="isl-grouph"><span>Csere a tervben</span></div>
            <ItemRow
              tone="fuel"
              emoji="🔄"
              title="Csere a tervben"
              subtitle="illő receptek a Kamrából"
              actionLabel="Nézd ›"
              onAction={onSwap}
            />

            <div className="isl-grouph"><span>AI naplózás</span></div>
            <ItemRow
              tone="fuel"
              emoji="📷"
              title="AI naplózás"
              subtitle="fotó vagy szabad szöveg"
              actionLabel="✨ AI"
              onAction={onAiLog}
            />

            {vm.stackDoses.length > 0 && (
              <div>
                <div className="isl-grouph"><span>Ehhez az ablakhoz kötve</span></div>
                {vm.stackDoses.map((dose) => (
                  <ItemRow
                    key={dose.name}
                    tone="fuel"
                    emoji="💊"
                    title={dose.name}
                    subtitle={dose.note}
                    actionLabel="Pipa ✓"
                    onAction={() => onStackDose(dose.name)}
                  />
                ))}
              </div>
            )}
            <button type="button" className="isl-l1-close" onClick={onToggleOpen}>összecsuk ↑</button>
          </div>
        </>
      ) : (
        <>
          <div className="isl-hero-v">{vm.time}<span className="isl-hero-u">{vm.title}</span></div>
          <div className="isl-hero-sub">{vm.subtitle}</div>

          {ghostMeal ? (
            <div className="isl-mealchip-ghost">＋ tervezz ide</div>
          ) : (
            <div className="isl-mealchip">
              <span className="isl-mealchip-em" aria-hidden="true">{vm.emoji}</span>
              <div className="isl-mealchip-tx">
                <div className="isl-mealchip-t">{vm.meal!.name}</div>
                <div className="isl-mealchip-m">{mealMetaParts(vm.meal!).join(' · ')}</div>
              </div>
              {vm.meal!.fit != null && <span className="isl-mealchip-score">illik: {vm.meal!.fit}</span>}
            </div>
          )}

          {factCells.length > 0 && (
            <div className="isl-facts" style={{ gridTemplateColumns: `repeat(${factCells.length}, 1fr)` }}>
              {factCells.map((f) => (
                <div key={f.label} className="isl-fact">
                  <div className="isl-fact-v">{f.value}<span className="isl-fact-u">{f.unit}</span></div>
                  <div className="isl-fact-l">{f.label}</div>
                  <div className={`isl-fact-d is-${f.delta.tone}`}>{f.delta.text}</div>
                </div>
              ))}
            </div>
          )}

          <div className="isl-act">
            <button type="button" className="isl-cta cta-sage" onClick={onLog}>{ctaLabel}</button>
            <button type="button" className="isl-more" onClick={onAiLog}>✨ AI</button>
            <button type="button" className="isl-more" onClick={onToggleOpen}>még {vm.l1Count} ›</button>
          </div>

          {doneSummary && (
            <button type="button" className="isl-doneline" onClick={onToggleOpen}>{doneSummary}</button>
          )}
        </>
      )}
    </Island>
  )
}
