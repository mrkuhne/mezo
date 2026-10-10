// ============================================================
// Mezo · HabitFormationCard (mezo-08zl; Folyadék F2 mezo-n4wf5.2) — „hol tartok?" as ONE vessel:
// the level is the estimated automaticity, the marks on its wall are the stage borders, and the
// rail beside it names the four stages with the current one lit (prototype vilagos/nap.js
// `szokas` → `.np-mat`). Every word comes from `habitFormation.ts`; every number from the server.
// Under `minReps` repetitions the vessel stays empty and says so — no invented percentage, no
// deadline (the same honesty rule as `strengthPct`).
//
// `formationReading` is the same estimate as sentences, for the page's hero.
// ============================================================
import type { CSSProperties } from 'react'
import type { HabitFormation } from '@/data/types'
import { etaPhrase, FORMATION_STAGES, stageIndexOf } from '@/features/me/logic/habitFormation'
import { cn } from '@/shared/lib/cn'

const FAR_HORIZON_WEEKS = 26

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** „30–80" / „30" — the repetitions still ahead, as the RANGE the server estimated. */
function repsLeft(f: HabitFormation): string | null {
  if (f.repsToThresholdLo == null || f.repsToThresholdHi == null) return null
  const lo = Math.max(1, Math.round(f.repsToThresholdLo))
  const hi = Math.max(lo, Math.round(f.repsToThresholdHi))
  return lo === hi ? `${hi}` : `${lo}–${hi}`
}

export interface FormationReading {
  /** The hero's verdict: the stage and what is still ahead, as a range — never a single date. */
  verdict: string
  /** The quiet line under it: what the estimate is (and is not). */
  note: string
}

export function formationReading(f: HabitFormation): FormationReading {
  const pct = f.automaticityPct
  if (pct == null) {
    return {
      verdict: `Még gyűlik az adat: ${Math.max(0, f.minReps - f.reps)} ismétlés a becslésig.`,
      note: 'Nincs kitalált szám: amíg kevés az adat, nem mondunk határidőt.',
    }
  }
  if (pct >= f.thresholdPct) {
    return {
      verdict: 'Beérett: magától megy.',
      note: 'Ez már nagyrészt magától megy. Láncolj rá újat, amíg tart a lendület.',
    }
  }
  const stage = `${cap(FORMATION_STAGES[stageIndexOf(pct)].label)}.`
  const eta = etaPhrase(f.weeksToThresholdLo, f.weeksToThresholdHi)
  // A user who has done the reps but logs nothing lately has no rate to divide by — saying
  // „0 hét" or extrapolating would be a lie, so the verdict names the reason.
  if (eta == null) {
    return {
      verdict: `${stage} Mostanában nem volt ismétlés, amiből tempót számolhatnánk.`,
      note: 'A becslés visszajön, amint újra van friss ismétlés.',
    }
  }
  return {
    verdict: /^\d/.test(eta.big)
      ? `${stage} Még ${eta.big} van hátra ${eta.sub}.`
      : `${stage} A küszöb ${eta.big} van ${eta.sub}.`,
    note: (f.weeksToThresholdLo ?? 0) > FAR_HORIZON_WEEKS
      ? 'Ebben a ritmusban messze van a küszöb. Nem az akaraterőn múlik: sűrűbb ismétlés vagy '
        + 'állandóbb horgony gyorsít rajta — a becslés együtt mozog velük.'
      : 'Tartomány, nem ígéret: az egyéni szórás nagy (4–335 nap a szakirodalomban). '
        + 'A sáv szűkül, ahogy több adatod lesz.',
  }
}

export function HabitFormationCard({ f }: { f: HabitFormation }) {
  const pct = f.automaticityPct
  const enough = pct != null
  const settled = enough && pct >= f.thresholdPct
  const stage = enough ? stageIndexOf(pct) : -1
  const missingReps = Math.max(0, f.minReps - f.reps)
  const left = repsLeft(f)

  const lineOf = (i: number): string | null => {
    if (!enough) return i === 0 ? `még gyűlik az adat · ${missingReps} ismétlés a becslésig` : null
    if (i < stage) return 'megvolt'
    if (i > stage) return null
    if (settled) return 'itt tartasz · beérett'
    return left != null ? `itt tartasz · még ~${left} ismétlés` : 'itt tartasz'
  }

  return (
    <div className="rb-mat" data-testid="formation-card">
      <span className={cn('t', (!enough || pct < 18) && 'lo')}>
        {enough && <i style={{ height: `${pct}%` }} />}
        {FORMATION_STAGES.slice(0, -1).map((s) => <u key={s.label} style={{ bottom: `${s.maxPct}%` }} />)}
        <b>{enough ? `${pct}%` : '—'}</b>
      </span>
      <ol aria-label="A formálódás négy szakasza">
        {FORMATION_STAGES.map((s, i) => {
          const from = i === 0 ? 0 : FORMATION_STAGES[i - 1].maxPct
          const line = lineOf(i)
          return (
            <li
              key={s.label}
              className={cn(enough && i < stage && 'done', enough && i === stage && 'on')}
              style={{ '--f': Math.min(100, s.maxPct) - from } as CSSProperties}
              aria-current={enough && i === stage ? 'step' : undefined}
            >
              <b>{s.label}</b>
              {line != null && <small>{line}</small>}
            </li>
          )
        }).reverse()}
      </ol>
    </div>
  )
}
