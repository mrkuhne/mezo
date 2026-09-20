// ============================================================
// Mezo · ProgressionBanner (mezo-5pfe) — the in-workout progressive-overload
// signal: label + delta chip and a "Múlt hét → Ma a cél" two-cell comparison.
// The engine's rationale SENTENCE is NOT repeated here (mezo-i8ahy): the card prints
// it once, in its cue line — the banner said the same thing a second time, in words,
// right under its own numbers. Three visual states by lever: weight=coral, rep=sage,
// hold/deload=amber back-off. Presentational only; replaces the .aistrip strip.
// ============================================================
import type { LastWeekSet, ProgressionSignal } from '@/data/types'
import { ClayIcon } from '@/shared/ui/clay'

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
  /** Drops the label row, for a host whose own header already says „Progresszió" + the
      delta. Shipped for a CollapsibleStrip (mezo-d20.3.9) that no longer exists, so it
      currently has NO caller — kept because the next host that nests this banner wants
      exactly this (noted in the visszaöltöztetés close-out, mezo-ju4j6.16). */
  bare?: boolean
}) {
  const p = progression
  const tone = p.lever === 'weight' ? 'po-weight' : p.lever === 'rep' ? 'po-rep' : 'po-hold'
  const now = p.targetWeightKg != null ? `${fmt(p.targetWeightKg)} × ${p.targetReps}` : `× ${p.targetReps}`
  return (
    <div className={`pobanner ${tone}${bare ? ' pobanner-bare' : ''}`}>
      {!bare && (
        <div className="pobanner-lab">
          {/* Agyag-szimbólum, nem emodzsi (stíluskönyv §2.3 · §6; lezárás mezo-ju4j6.16).
              `i-lang` a ház „energia" jele — ugyanez ül a ceremónia RPE-számlálóján —, és
              a jelvény mellette amúgy is kimondja az IRÁNYT, tehát ez a jel a BLOKKOT
              azonosítja, nem a haladás irányát. (A `SPORT_EMOJI` térkép ugyan még él a
              `sportKinds.ts`-ben, de az EGYETLEN fogyasztója, a `logic/weeklyLoad.ts`,
              maga is importáló nélküli holt modul — a képernyőre nem jut emodzsi onnan.) */}
          <span className="txt"><ClayIcon name="i-lang" size={14} className="icon" /> Progresszió</span>
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
    </div>
  )
}
