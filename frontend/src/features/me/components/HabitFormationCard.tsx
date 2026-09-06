// ============================================================
// Mezo · HabitFormationCard (mezo-08zl) — prototype `rutin-formalodas` `.poster` ×1.18.
// Spec: docs/superpowers/specs/2026-09-06-habit-formation-design.md
//
// One poster card answers "hol tartok?": the automaticity ring, the curve, the four stages as
// a milestone rail, and the ETA as a RANGE. Every word comes from `habitFormation.ts`; every
// number comes from the server. Under `minReps` repetitions the card says so instead of
// inventing a percentage or a deadline — the same honesty rule as `strengthPct`.
// ============================================================
import type { HabitFormation } from '@/data/types'
import { FormationCurve } from '@/features/me/components/FormationCurve'
import { etaPhrase, FORMATION_STAGES, stageIndexOf } from '@/features/me/logic/habitFormation'
import { cn } from '@/shared/lib/cn'
import { ScoreRing } from '@/shared/ui/ScoreRing'

const FAR_HORIZON_WEEKS = 26

export function HabitFormationCard({ f }: { f: HabitFormation }) {
  const pct = f.automaticityPct
  const enough = pct != null
  const settled = enough && pct >= f.thresholdPct
  const stage = enough ? stageIndexOf(pct) : -1
  const eta = etaPhrase(f.weeksToThresholdLo, f.weeksToThresholdHi)
  const missingReps = Math.max(0, f.minReps - f.reps)

  return (
    <div className={cn('rt-poster', settled && 'is-settled')} data-testid="formation-card">
      <div className="rt-poster-top">
        <ScoreRing
          pct={enough ? pct / 100 : 0}
          size={82}
          stroke={6}
          color={settled ? 'var(--sage)' : 'var(--amber)'}
          label={enough ? `${pct}%` : '—'}
          sublabel="automatizmus"
        />
        <div className="rt-poster-meta">
          <div className="rt-poster-eb">Út az automatizmus felé</div>
          <div className="rt-poster-big">
            {enough ? FORMATION_STAGES[stage].label : 'Még gyűlik az adat'}
          </div>
          <p className="rt-poster-sub">
            {enough
              ? `${f.reps} ismétlés · ${f.missed} kimaradt nap · a görbe meredekségét a saját ritmusod adja`
              : `${f.minReps} ismétlés alatt nem becslünk — az adat még nem hordoz jelet. A görbe addig is épül.`}
          </p>
        </div>
      </div>

      <FormationCurve curveK={f.curveK} reps={f.reps} thresholdPct={f.thresholdPct} />

      <ol className="rt-msrail" aria-label="A formálódás négy szakasza">
        {FORMATION_STAGES.map((s, i) => (
          <li key={s.label}
            className={cn(enough && i < stage && 'is-past', enough && i === stage && 'is-now')}
            aria-current={enough && i === stage ? 'step' : undefined}>
            <i aria-hidden="true" />
            <span>{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="rt-etaband" data-testid="formation-eta">
        {!enough && (
          <>
            <span className="rt-etaband-n">{missingReps}</span>
            <span className="rt-etaband-l"><b>még ennyi ismétlés</b>és megjelenik a becslés</span>
          </>
        )}
        {enough && settled && (
          <>
            <span className="rt-etaband-n" aria-hidden="true">★</span>
            <span className="rt-etaband-l"><b>beérett</b>a küszöb fölött — jó horgony egy új szokásnak</span>
          </>
        )}
        {enough && !settled && eta != null && (
          <>
            <span className="rt-etaband-n">{eta.big}</span>
            <span className="rt-etaband-l"><b>van hátra</b>{eta.sub}</span>
          </>
        )}
        {/* A user who has done the reps but logs nothing lately has no rate to divide by —
            saying "0 hét" or extrapolating would be a lie, so the band names the reason. */}
        {enough && !settled && eta == null && (
          <>
            <span className="rt-etaband-n" aria-hidden="true">·</span>
            <span className="rt-etaband-l"><b>nincs becslés</b>mostanában nem volt ismétlés, amiből tempót számolhatnánk</span>
          </>
        )}
      </div>

      <p className="rt-poster-note">
        {!enough
          ? 'Nincs kitalált szám: amíg kevés az adat, nem mondunk határidőt.'
          : settled
            ? 'Ez már nagyrészt magától megy. Láncolj rá újat, amíg tart a lendület.'
            : (f.weeksToThresholdLo ?? 0) > FAR_HORIZON_WEEKS
              ? 'Ebben a ritmusban messze van a küszöb. Nem az akaraterőn múlik: sűrűbb ismétlés vagy '
                + 'állandóbb horgony meredekebbé teszi a görbét — a becslés együtt mozog velük.'
              : 'Tartomány, nem ígéret: az egyéni szórás nagy (4–335 nap a szakirodalomban). '
                + 'A sáv szűkül, ahogy több adatod lesz.'}
      </p>
    </div>
  )
}
