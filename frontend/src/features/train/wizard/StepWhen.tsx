// ============================================================
// Mezo · StepWhen — a varázsló 01 lépése: „Mikor edzel — és miért?"
// (meso-body.html #page-wizard [data-step="0"], px ×1.18). Három
// szekció-kártya rise-staggerrel: edzésnapok (napszám-csempék + 7 kerek
// nap-chip + split-sor), a szabad szöveges cél, és „ami magától megy" —
// a modell három állandója. Csak ezt a hármat kérdezzük.
// ============================================================
import type { CSSProperties, Dispatch } from 'react'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { splitLine } from '@/features/train/logic/mesoPlan'
import type { WizardAction, WizardState } from '@/features/train/wizard/wizardState'

/** The prototype's 7 round chips — short label per DAY_ORDER token. */
const DAY_CHIPS: { day: string; short: string }[] = [
  { day: 'Hét', short: 'H' }, { day: 'Kedd', short: 'K' }, { day: 'Sze', short: 'Sze' },
  { day: 'Csü', short: 'Cs' }, { day: 'Pén', short: 'P' }, { day: 'Szo', short: 'Szo' },
  { day: 'Vas', short: 'V' },
]

const COUNTS: { n: number; sub: string }[] = [
  { n: 2, sub: 'full body' }, { n: 3, sub: 'full body' }, { n: 4, sub: 'upper/lower' },
  { n: 5, sub: 'U/L + PPL' }, { n: 6, sub: 'PPL ×2' },
]

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export function StepWhen({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  const days = state.daysOfWeek
  const toggle = (day: string) =>
    dispatch({ type: 'setDays', days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] })

  return (
    <EntranceGroup>
      <div className="mz-steptitle">Mikor edzel — és miért?</div>
      <p className="mz-steplead">Csak ennyit kérdezünk — a többit a modell és Mezo rakja össze.</p>

      <div className="mz-stepcard mz-stepcard-coral rise" style={delay(40)}>
        <div className="mz-stephead">
          <ClayIcon name="i-edzes" size={28} />
          <span className="mz-eyebrow mz-eb-coral mz-grow">Edzésnapok</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mz-ink-soft)' }}>
            {days.length}/{days.length}
          </span>
        </div>
        <div className="mz-dcgrid">
          {COUNTS.map(({ n, sub }) => (
            <button
              key={n}
              type="button"
              className="mz-dct"
              aria-label={`${n} nap / hét`}
              aria-pressed={days.length === n}
              onClick={() => dispatch({ type: 'setDayCount', n })}
            >
              <b>{n}</b>
              <small>{sub}</small>
            </button>
          ))}
        </div>
        <div className="mz-daypick">
          {DAY_CHIPS.map(({ day, short }) => (
            <button
              key={day}
              type="button"
              aria-label={short}
              aria-pressed={days.includes(day)}
              onClick={() => toggle(day)}
            >
              {short}
            </button>
          ))}
        </div>
        <div className="mz-coach">
          <span className="dot" aria-hidden="true" />
          <span>{splitLine(days)}</span>
        </div>
      </div>

      <div className="mz-stepcard mz-stepcard-lav rise" style={delay(110)}>
        <div className="mz-stephead">
          <ClayIcon name="i-mezo" size={28} />
          <span className="mz-eyebrow mz-eb-lav mz-grow">A célod · opcionális</span>
        </div>
        <textarea
          rows={3}
          maxLength={400}
          aria-label="Mit szeretnél ebben a blokkban?"
          placeholder="pl. röplabda szezon mellett, a vállam kímélve — de a hát és a váll nagyon jöhet"
          value={state.goalText}
          onChange={(e) => dispatch({ type: 'setGoalText', text: e.target.value })}
        />
        <div className="mz-stepnote">
          Üresen is teljes program készül — a szöveg a gyakorlatválasztást és a napok hangolását befolyásolja.
        </div>
      </div>

      <div className="mz-stepcard mz-stepcard-gold rise" style={delay(180)}>
        <div className="mz-stephead">
          <ClaySpot name="s-hajtas" size={28} />
          <span className="mz-eyebrow mz-eb-gold mz-grow">Ami magától megy</span>
        </div>
        <StatStrip>
          <StatCell value="5 + 1" label="rámpa + deload hét" />
          <StatCell value="+2" label="szett / hét / izom" />
          <StatCell value="~8" label="szett-plafon / edzés" />
        </StatStrip>
        <div className="mz-stepnote">
          A Programban bármit átírhatsz — de e nélkül is kész, működő blokkot kapsz.
        </div>
      </div>
    </EntranceGroup>
  )
}

/** The step's own gate: the split table only covers 2–6 training days. */
export function canLeaveStepWhen(state: WizardState): boolean {
  return state.daysOfWeek.length >= 2 && state.daysOfWeek.length <= 6
}
