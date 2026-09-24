// ============================================================
// Mezo · WeightHero — the Súly page's own-page hero (mezo-d20.6.3).
// Source of truth: en-body.html #page-suly hero: title "Napi súly",
// clay icon + big goal-delta number in one row, sub "indulás óta ·
// {start} → {latest}". The progress-to-goal pill (`✓ {pct}% a célig`)
// isn't in that snippet but IS a documented behavioral contract
// (en-feature-audit §Súly) — kept as hero children, styled sage
// (never red/error — handoff §2). Üveg (mezo-me75u.6): PageHero `art` halo hero.
// ============================================================
import { PageHero } from '@/shared/ui/mozaik'
import { Icon3D } from '@/shared/ui/clay'
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
      art="t-weight"
      accent="var(--dv-sky)"
      big={<>{change === null ? '—' : fmtSigned(change)}<small>kg</small></>}
      sub={sub}
    >
      {/* Üveg (mezo-me75u.6): the goal pill is lit sage with a t-tick (was a „✓" glyph),
          the 4-week tempo a flat pill; the two wrap as one group. */}
      <div className="wt-heropills">
        {pct !== null && (
          <span className="wt-goalpill"><Icon3D name="t-tick" size={16} /><span>{pct}% a célig</span></span>
        )}
        <span className="wt-4wk">4-hét tempó {fmtSigned(weightTrends.last4w.weeklyRate)} kg/hét</span>
      </div>
    </PageHero>
  )
}

// Retained for the hero's own stat-cell coloring rule: sage on improvement, amber
// otherwise — NEVER error/red (handoff §2 guardrail; the prototype itself has no red).
export function statRateColor(rate: number, goalKind?: Goal['kind']): string | undefined {
  if (Math.abs(rate) < 0.005) return undefined
  return isImprovement(rate, goalKind) ? 'var(--mz-cell-sage-ink)' : 'var(--mz-cell-amber-ink)'
}
