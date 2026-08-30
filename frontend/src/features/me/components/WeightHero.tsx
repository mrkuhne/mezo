// ============================================================
// Mezo · WeightHero — the Súly page's own-page hero (mezo-d20.6.3).
// Source of truth: en-body.html #page-suly hero: title "Napi súly",
// clay icon + big goal-delta number in one row, sub "indulás óta ·
// {start} → {latest}". The progress-to-goal pill (`✓ {pct}% a célig`)
// isn't in that snippet but IS a documented behavioral contract
// (en-feature-audit §Súly) — kept as hero children, styled sage
// (never red/error — handoff §2).
// ============================================================
import { PageHero } from '@/shared/ui/mozaik'
import type { WeightEntry, WeightTrends, Goal } from '@/data/types'
import { changeFromStart, latestValue, progressPct, fmtSigned, isImprovement } from '@/features/me/logic/weightStats'

export function WeightHero({ log, weightTrends, goal }: {
  log: WeightEntry[]
  weightTrends: WeightTrends
  goal: Goal | null
}) {
  const latest = latestValue(log)
  const start = goal?.startWeight ?? (log.length ? log[0].value : null)
  const target = goal?.targetWeight ?? null
  const change = changeFromStart(log, goal?.startWeight ?? null)
  const pct = latest !== null && start !== null ? progressPct(start, latest, target) : null

  const sub = latest !== null && start !== null
    ? `indulás óta · ${start.toFixed(1)} → ${latest.toFixed(1)}${target !== null ? ` · cél ${target} kg` : ''}`
    : undefined

  return (
    <PageHero
      name="Napi súly"
      icon="i-suly"
      big={<>{change === null ? '—' : fmtSigned(change)}<span className="mz-hero-unit"> kg</span></>}
      sub={sub}
    >
      {pct !== null && <div className="wt-goalpill">✓ {pct}% a célig</div>}
      <div className="wt-4wk">4-hét tempó {fmtSigned(weightTrends.last4w.weeklyRate)} kg/hét</div>
    </PageHero>
  )
}

// Retained for the hero's own stat-cell coloring rule: sage on improvement, amber
// otherwise — NEVER error/red (handoff §2 guardrail; the prototype itself has no red).
export function statRateColor(rate: number, goalKind?: Goal['kind']): string | undefined {
  if (Math.abs(rate) < 0.005) return undefined
  return isImprovement(rate, goalKind) ? 'var(--mz-cell-sage-ink)' : 'var(--mz-cell-amber-ink)'
}
