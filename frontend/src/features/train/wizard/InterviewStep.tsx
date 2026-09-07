// ============================================================
// Mezo · InterviewStep — a varázsló EGYETLEN kérdező képernyője (mezo-yty6).
// A régi 01 „Mikor és miért" + 02 „Fókusz" lépés egy görgethető oldallá olvadt,
// a 03 „Program" pedig megszűnt: a generálás kimenete a közös MesoWeekEditor-ban
// nyílik (Alpha-Progression-minta — a wizard vékony interjú, nem második szerkesztő).
//
// A kártyák a StepWhen/StepFocus bevált .mz-stepcard anatómiáját öröklik (ikon +
// eyebrow + tartalom), így a stíluslap sem duplikálódik: csak a rózsaszín wash és
// a lábléc-rács új.
// ============================================================
import type { CSSProperties, Dispatch } from 'react'
import { MusclePriorityPicker } from '@/features/train/components/MusclePriorityPicker'
import { splitLine, weekTotals } from '@/features/train/logic/mesoPlan'
import type { WizardAction, WizardState } from '@/features/train/wizard/wizardState'
import { CtaPrimary } from '@/shared/ui/Cta'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

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

/** The retired StepProgram's Hossz range (mezo-yty6 fix round 1) — 4-8 weeks. */
const WEEK_CHOICES = [4, 5, 6, 7, 8]

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** The split table only covers 2–6 training days — the generate CTA's gate. */
function canGenerate(state: WizardState): boolean {
  return state.daysOfWeek.length >= 2 && state.daysOfWeek.length <= 6
}

interface InterviewStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
  onGenerate: () => void
  generating: boolean
}

export function InterviewStep({ state, dispatch, onGenerate, generating }: InterviewStepProps) {
  const days = state.daysOfWeek
  const { weekOne, peak } = weekTotals(state.priorities)
  const toggleDay = (day: string) =>
    dispatch({ type: 'setDays', days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] })

  const gateOpen = canGenerate(state)

  return (
    <EntranceGroup>
      <div className="mz-steptitle">Mikor edzel — és mire gyúrsz?</div>
      <p className="mz-steplead">
        Csak ennyit kérdezünk — a többit a modell rakja össze, és a szerkesztőben bármit átírhatsz.
      </p>

      <div className="mz-stepcard mz-stepcard-coral rise" style={delay(40)}>
        <div className="mz-stephead">
          <ClayIcon name="i-edzes" size={28} />
          <span className="mz-eyebrow mz-eb-coral mz-grow">Edzésnapok</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mz-ink-soft)' }}>
            {days.length} nap
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
              onClick={() => toggleDay(day)}
            >
              {short}
            </button>
          ))}
        </div>
        <div className="mz-coach">
          <span className="dot" aria-hidden="true" />
          <span>{splitLine(days)}</span>
        </div>
        <div className="mz-stephead" style={{ marginTop: 11, marginBottom: 6 }}>
          <span className="mz-eyebrow mz-eb-coral mz-grow">Hossz</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mz-ink-soft)' }}>
            {state.weeks} hét = {state.weeks - 1} rámpa + 1 deload
          </span>
        </div>
        <div className="segtabs" role="group" aria-label="Hossz hetekben">
          {WEEK_CHOICES.map((w) => (
            <button
              key={w}
              type="button"
              className="segtab"
              aria-pressed={state.weeks === w}
              aria-label={`${w} hét`}
              onClick={() => dispatch({ type: 'setWeeks', weeks: w })}
            >
              {w}
            </button>
          ))}
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

      <div className="mz-stepcard mz-stepcard-rose rise" style={delay(180)}>
        <div className="mz-stephead">
          <ClayIcon name="i-suly" size={28} />
          <span className="mz-eyebrow mz-eb-rose mz-grow">Fókusz · max 2 hangsúly</span>
        </div>
        <MusclePriorityPicker
          value={state.priorities}
          onChange={(priorities) => dispatch({ type: 'setPriorities', priorities })}
        />
        <div style={{ marginTop: 11 }}>
          <StatStrip>
            <StatCell value={weekOne} label="szett · 1. hét" />
            <StatCell value={peak} label="szett · csúcshét" />
          </StatStrip>
        </div>
      </div>

      <div className="mz-stepcard mz-stepcard-gold rise" style={delay(250)}>
        <div className="mz-stephead">
          <ClaySpot name="s-hajtas" size={28} />
          <span className="mz-eyebrow mz-eb-gold mz-grow">Ami magától megy</span>
        </div>
        <StatStrip>
          <StatCell value={`${state.weeks - 1} + 1`} label="rámpa + deload hét" />
          <StatCell value="+2" label="szett / hét / izom" />
          <StatCell value="~8" label="szett-plafon / edzés" />
        </StatStrip>
        <div className="mz-stepnote">
          A szerkesztőben bármit átírhatsz — de e nélkül is kész, működő blokkot kapsz.
        </div>
      </div>

      {!gateOpen && <p className="mz-stepnote">Válassz 2–6 edzésnapot a folytatáshoz.</p>}
      <div className="mz-wfoot">
        <CtaPrimary disabled={!gateOpen || generating} onClick={onGenerate}>
          {generating ? 'Mezo dolgozik…' : '✨ Program generálása'}
        </CtaPrimary>
      </div>
    </EntranceGroup>
  )
}
