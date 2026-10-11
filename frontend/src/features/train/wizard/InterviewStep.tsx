// ============================================================
// Mezo · InterviewStep — a varázsló EGYETLEN kérdező képernyője (mezo-yty6; Folyadék
// mezo-n4wf5.3, prototype vilagos/edzes.js `ujterv()`, states `kapu` / `gen` / `hiba`).
// Hero: a terv íve hétről hétre üres edényekben — a vízvonal a hét súlya, a csúcshét a
// legmagasabb, a pihenőhét sraffozott (phaseCurve(weeks)). Alatta öt számozott kártya:
// edzésnapok, hossz, cél, fókusz, ami magától megy; a generálás gombja a lap alján úszik.
// A generálás kimenete a közös MesoWeekEditor-ban nyílik (a wizard vékony interjú, nem
// második szerkesztő).
// ============================================================
import type { Dispatch } from 'react'
import { DAY_ORDER } from '@/data/train/train'
import { MesoTubes } from '@/features/train/components/MesoTubes'
import { DAY_SHORT } from '@/features/train/components/WeekdayGrid'
import { MusclePriorityPicker } from '@/features/train/components/MusclePriorityPicker'
import { phaseCurve, splitLine, weekTotals } from '@/features/train/logic/mesoPlan'
import type { WizardAction, WizardState } from '@/features/train/wizard/wizardState'
import {
  Acts, Box, Btn, Card, Facts, FrameBack, Hero, Lk, Note, Page, Pill, Pills, Section, TextArea, Txt, useFrameTitle,
} from '@/shared/ui/folyadek'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

/** The prototype's 7 weekday vessels — the one list of day letters (`DAY_SHORT`) over the DAY_ORDER tokens. */
const DAY_CHIPS = DAY_ORDER.map((day, i) => ({ day: day as string, short: DAY_SHORT[i] as string }))

const COUNTS: { n: number; sub: string }[] = [
  { n: 2, sub: 'full body' }, { n: 3, sub: 'full body' }, { n: 4, sub: 'upper/lower' },
  { n: 5, sub: 'U/L + PPL' }, { n: 6, sub: 'PPL ×2' },
]

/** The retired StepProgram's Hossz range (mezo-yty6 fix round 1) — 4-8 weeks. */
const WEEK_CHOICES = [4, 5, 6, 7, 8]

/** The split table only covers 2–6 training days — the generate CTA's gate. */
function canGenerate(state: WizardState): boolean {
  return state.daysOfWeek.length >= 2 && state.daysOfWeek.length <= 6
}

interface InterviewStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
  onGenerate: () => void
  generating: boolean
  /** The first generation failed: the retry callout stands in the hero. */
  failed?: boolean
  onBack?: () => void
}

export function InterviewStep({ state, dispatch, onGenerate, generating, failed = false, onBack }: InterviewStepProps) {
  const days = state.daysOfWeek
  const { weekOne, peak } = weekTotals(state.priorities)
  const toggleDay = (day: string) =>
    dispatch({ type: 'setDays', days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] })

  const gateOpen = canGenerate(state)
  const curve = phaseCurve(state.weeks)
  const [splitHead, splitBody] = splitLine(days).split(' · ')

  useFrameTitle({ title: 'Új terv', eyebrow: 'Pár kérdés' })

  return (
    <Page
      className="ew-page"
      foot={(
        <Btn grow disabled={!gateOpen || generating} onClick={onGenerate}>
          {generating ? 'Mezo dolgozik…' : 'Program generálása'}
        </Btn>
      )}
    >
      {onBack && <FrameBack className="fo-backpill" onBack={onBack}>‹ Terv</FrameBack>}
      <Hero
        className="ew-hero"
        label="Új terv"
        verdict="Mikor edzel — és mire gyúrsz?"
        sub="Csak ennyit kérdezünk — a többit Mezo rakja össze, és a szerkesztőben bármit átírhatsz."
      >
        {failed && (
          <div className="ew-alert" role="alert">
            <Box icon="t-info" color="var(--fo-warn)" title="Nem sikerült a generálás — próbáld újra.">
              <Acts><Lk onClick={onGenerate}>↺ Újrapróbálom</Lk></Acts>
            </Box>
          </div>
        )}
        <div className="fo-hero-g ew-hg">
          <MesoTubes curve={curve} now={0} height={64}
            ariaLabel={`A terv íve: ${state.weeks - 1} emelkedő hét és egy pihenőhét`} />
        </div>
        <Note>{state.weeks} hét = {state.weeks - 1} emelkedő hét + 1 pihenőhét</Note>
      </Hero>

      <Section n={1} title={`Edzésnapok · ${days.length} nap`} />
      <Card>
        <div className="ew-cnt">
          {COUNTS.map(({ n, sub }) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} nap / hét`}
              aria-pressed={days.length === n}
              onClick={() => dispatch({ type: 'setDayCount', n })}
            >
              <b>{n}</b>
              {/* A <wbr> after each slash: „upper/lower" wraps as „upper/ lower" in a narrow
                  tile instead of mid-word (U11); the text itself is unchanged. */}
              <small>{sub.split('/').flatMap((part, i) => (i ? ['/', <wbr key={i} />, part] : [part]))}</small>
            </button>
          ))}
        </div>
        <div className="ew-wd">
          {DAY_CHIPS.map(({ day, short: label }) => (
            <button
              key={day}
              type="button"
              aria-label={label}
              aria-pressed={days.includes(day)}
              onClick={() => toggleDay(day)}
            >
              <i />
              <b>{label}</b>
            </button>
          ))}
        </div>
        <Box icon="t-calendar" title={splitHead}>{splitBody && <p>{splitBody}</p>}</Box>
      </Card>

      <Section n={2} title="Hossz" />
      <Card>
        <Txt className="ew-len">{state.weeks} hét = {state.weeks - 1} emelkedő + 1 pihenőhét</Txt>
        <Pills role="group" aria-label="Hossz hetekben">
          {WEEK_CHOICES.map((w) => (
            <Pill key={w} on={state.weeks === w} onClick={() => dispatch({ type: 'setWeeks', weeks: w })}>
              {w} hét
            </Pill>
          ))}
        </Pills>
      </Card>

      <Section n={3} title="A célod · opcionális" />
      <Card>
        <VoiceField className="ew-goal" domain="train" onTranscript={(t) => dispatch({ type: 'setGoalText', text: appendDictation(state.goalText, t, 400) })}>
          <TextArea
            rows={3}
            maxLength={400}
            aria-label="Mit szeretnél ebben a tervben?"
            placeholder="pl. röplabda szezon mellett, a vállam kímélve — de a hát és a váll nagyon jöhet"
            value={state.goalText}
            onChange={(e) => dispatch({ type: 'setGoalText', text: e.target.value })}
          />
        </VoiceField>
        <Note>Üresen is teljes program készül — a szöveg a gyakorlatválasztást és a napok hangolását befolyásolja.</Note>
      </Card>

      <Section n={4} title="Fókusz · max 2 hangsúly" />
      <Card>
        <MusclePriorityPicker
          value={state.priorities}
          onChange={(priorities) => dispatch({ type: 'setPriorities', priorities })}
        />
        <Facts items={[[weekOne, 'szett · 1. hét'], [peak, 'szett · csúcshét']]} />
      </Card>

      <Section n={5} title="Ami magától megy" />
      <Card>
        <Facts items={[[`${state.weeks - 1} + 1`, 'emelkedő + pihenőhét'], ['+2', 'szett / hét / izom'], ['~8', 'szett-határ / edzés']]} />
        <Note>A szerkesztőben bármit átírhatsz — de e nélkül is kész, működő tervet kapsz.</Note>
        {!gateOpen && <Note className="ew-gate">Válassz 2–6 edzésnapot a folytatáshoz.</Note>}
      </Card>
    </Page>
  )
}
