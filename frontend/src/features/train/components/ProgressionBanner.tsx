// ============================================================
// Mezo · ProgressionBanner (mezo-5pfe) — the in-workout progressive-overload
// signal: label + delta chip, a "Múlt hét → Ma a cél" two-cell comparison, and
// the engine rationale. Three visual states by lever: weight=coral, rep=sage,
// hold/deload=amber back-off. Presentational only; replaces the .aistrip strip.
// ============================================================
import type { LastWeekSet, ProgressionSignal } from '@/data/types'

const fmt = (n: number) => n.toLocaleString('hu-HU')

/** "+2,5 kg ↑" / "+1 rep ↑" / "tartás" — the delta the closed strip header shows too. */
export function progressionDeltaLabel(p: ProgressionSignal): string {
  if (p.deltaKg != null && p.deltaKg !== 0) return `${p.deltaKg > 0 ? '+' : '−'}${fmt(Math.abs(p.deltaKg))} kg ${p.deltaKg > 0 ? '↑' : '↓'}`
  if (p.deltaReps != null) return `+${p.deltaReps} rep ↑`
  return 'tartás'
}

export function ProgressionBanner({ progression, lastWeek, bare = false }: {
  progression: ProgressionSignal
  lastWeek: LastWeekSet | null
  /** Nested inside a CollapsibleStrip (mezo-d20.3.9) — the strip header already
      carries "⚡ Progresszió" + the delta chip, so the banner drops its own label
      row rather than saying the same thing twice on one screen. */
  bare?: boolean
}) {
  const p = progression
  const tone = p.lever === 'weight' ? 'po-weight' : p.lever === 'rep' ? 'po-rep' : 'po-hold'
  const now = p.targetWeightKg != null ? `${fmt(p.targetWeightKg)} × ${p.targetReps}` : `× ${p.targetReps}`
  return (
    <div className={`pobanner ${tone}${bare ? ' pobanner-bare' : ''}`}>
      {!bare && (
        <div className="pobanner-lab">
          <span className="txt">⚡ Progresszió</span>
          <span className="delta">{progressionDeltaLabel(p)}</span>
        </div>
      )}
      <div className="pobanner-cells">
        <div className="cell">
          <div className="clab">Múlt hét</div>
          <div className="cval">{lastWeek ? `${fmt(lastWeek.weight)} × ${lastWeek.reps} · RIR ${lastWeek.rir}` : '—'}</div>
        </div>
        <div className="cell now">
          <div className="clab">Ma a cél</div>
          <div className="cval up">{now}</div>
        </div>
      </div>
      <p className="pobanner-why">{p.rationale}</p>
    </div>
  )
}
