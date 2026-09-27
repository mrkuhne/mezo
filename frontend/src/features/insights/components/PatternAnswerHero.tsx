// ============================================================
// Mezo · PatternAnswerHero — a minta-részlet ÚJ első hőse: keret nélküli halo, a válasz nagyban
// (mezo-rstt7, prototypes/uveg-minta-body.html `.mh`). A kérdés kicsiben megy fel, a válasz a
// heading; alatta a mondat, a Mezo-idézet (csak amíg gyűjt), a „merre húz" mérő vagy a
// nap-pipák, végül a döntés — `decisionPlan` szerint gombolva, sosem az oldal saját logikájával.
// A `pattern == null` (katalógus-pár, nincs tárolt sor) esetén NINCS döntés-blokk.
// ============================================================
import type { Icon3DName } from '@/shared/ui/clay'
import { Icon3D } from '@/shared/ui/clay'
import { toneClass } from '@/features/insights/components/DetailHero'
import { PATTERN_DOMAIN_ART } from '@/features/insights/components/PatternDomainMark'
import { PatternDayPips, PatternLeanMeter } from '@/features/insights/components/PatternLeanMeter'
import { patternHeadline } from '@/features/insights/logic/patternCopy'
import {
  answerLook, decisionPlan, saySentence, type DecisionVerb, type Reading,
} from '@/features/insights/logic/patternReading'
import { cn } from '@/shared/lib/cn'
import type { AlignedDay, Pattern, PatternEvent, PatternMonitorPair, PatternStatus } from '@/data/types'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const VERB_ICON: Record<DecisionVerb, Icon3DName> = { confirm: 't-tick', monitor: 't-lens', reject: 't-skip' }

/** A `decisionPlan`/`saySentence` `**…**` jelölése — a páratlan darabok félkövérek. */
export function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part))}
    </>
  )
}

/** A legutolsó `observation` esemény első bekezdése — Mezo saját megérzése, amiből a kérdés
 *  vagy a gyűjtés-állapot felvetődött (csak addig mutatjuk, amíg nincs mért válasz). */
function latestObservation(events: PatternEvent[]): string | null {
  const obs = [...events].reverse().find((e) => e.kind === 'observation' && e.text)
  return obs?.text ? obs.text.split('\n\n')[0] : null
}

function DomainChip({ domain, label }: { domain: PatternMonitorPair['metricADomain']; label: string }) {
  return (
    <span className="pmx-pc">
      <Icon3D name={PATTERN_DOMAIN_ART[domain]} size={20} />{cap(label)}
    </span>
  )
}

function Decision({ reading, status, onDecide }: {
  reading: Reading
  status: Pattern['status'] | null
  onDecide: (verb: PatternStatus) => void
}) {
  const plan = decisionPlan(reading, status)
  if (!plan.settled && plan.buttons.length === 0 && !plan.revokeLink && !plan.note) return null
  return (
    <div className="pmx-dec">
      {plan.settled && (
        <p className="pmx-done"><Icon3D name="t-tick" size={22} />{plan.settled}</p>
      )}
      {plan.buttons.length > 0 && (
        <div className="pmx-row2">
          {plan.buttons.map((btn) => (
            <button key={btn.verb} type="button" className={cn('pmx-dact', btn.recommended && 'is-rec')}
              aria-pressed={btn.verb === 'monitor' ? status === 'monitoring' : undefined}
              onClick={() => onDecide(btn.verb)}>
              <Icon3D name={VERB_ICON[btn.verb]} size={22} />{btn.label}
            </button>
          ))}
        </div>
      )}
      {plan.revokeLink && (
        <button type="button" className="pmx-link" onClick={() => onDecide('reject')}>
          Mégsem igaz rám — visszavonom
        </button>
      )}
      {plan.note && <p className="pmx-why"><Bold text={plan.note} /></p>}
    </div>
  )
}

export function PatternAnswerHero({ pair, pattern, reading, days, events, onDecide }: {
  pair: PatternMonitorPair
  pattern: Pattern | null
  reading: Reading
  days: AlignedDay[]
  events: PatternEvent[]
  onDecide: (verb: PatternStatus) => void
}) {
  const status = pattern?.status ?? null
  const look = answerLook(reading, status)
  const showQuote = reading.state === 'kerdes' || reading.state === 'gyulik'
  const quote = showQuote ? latestObservation(events) : null

  return (
    <section className={cn('pmx-hero', 'rise', toneClass(look.tone))} aria-labelledby="pmx-answer">
      <div className="pmx-pairrow">
        <DomainChip domain={pair.metricADomain} label={pair.metricALabel} />
        <span className="pmx-ar">→</span>
        <DomainChip domain={pair.metricBDomain} label={pair.metricBLabel} />
      </div>
      <p className="pmx-q">{pair.questionHu || patternHeadline(pair.title, pair)}</p>
      <div className="pmx-ans">
        <Icon3D name={look.art} size={54} />
        <h1 id="pmx-answer">{look.word}</h1>
      </div>
      <p className="pmx-say"><Bold text={saySentence(reading, pair, days, status)} /></p>
      {quote && (
        <div className="pmx-quote">
          <span className="pmx-eb">AMIBŐL MEZO FELVETETTE</span>
          <p>{quote}</p>
        </div>
      )}
      {reading.now
        ? <PatternLeanMeter now={reading.now} then={reading.then} />
        : reading.state === 'gyulik' && <PatternDayPips count={reading.dayCount} of={reading.minN} />}
      {pattern && <Decision reading={reading} status={status} onDecide={onDecide} />}
    </section>
  )
}
