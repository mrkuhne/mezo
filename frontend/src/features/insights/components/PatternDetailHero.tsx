// ============================================================
// Mezo · PatternDetailHero — a teszt-terv nélküli (katalógus-) minta „Igaz ez rám?" hero-ja.
// Üvegben (Üvegesítés U8a, mezo-me75u.13): prototypes/uveg-uzenofal.html #minta/hetvege —
// az oldal EGYETLEN üveg-hero-ja: domén-kút + eyebrow + cím + állapot-pirula, a kérdés, a nagy
// nap-gyűrű mellett a válasz és a lelet; döntés csak élő, erős, még megítéletlen párnál.
// ============================================================
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { confidenceMeta, findingSentence } from '@/features/insights/logic/findings'
import { PATTERN_DOMAIN_ART } from '@/features/insights/components/PatternDomainMark'
import {
  DayRing, DecisionNote, DecisionRow, DetailHero, StatePill, patternDecisionButtons, type DetailTone,
} from '@/features/insights/components/DetailHero'
import { DOMAIN_META } from '@/features/insights/logic/domains'
import { isStrongSignal } from '@/features/insights/logic/lifecycle'
import { groupBalanceSentence, verdictSentence } from '@/features/insights/logic/verdicts'
import type { Pattern, PatternMonitorPair, PatternStatus } from '@/data/types'

interface HeroState {
  tone: 'collecting' | 'confirmed' | 'rejected' | 'monitoring' | 'decision' | 'uncertain'
  pill: string
  answer: string
}

/** Az állapot → a hero egy akcentusa és a pirula jele. */
const TONE_OF: Record<HeroState['tone'], { tone: DetailTone; art: Icon3DName }> = {
  collecting: { tone: 'lav', art: 't-clock' },
  confirmed: { tone: 'sage', art: 't-tick' },
  rejected: { tone: 'mute', art: 't-skip' },
  monitoring: { tone: 'sky', art: 't-lens' },
  decision: { tone: 'gold', art: 't-sprout' },
  uncertain: { tone: 'lav', art: 't-info' },
}

function stateFor(pair: PatternMonitorPair, pattern: Pattern | null): HeroState {
  if (pair.verdict === 'imbalanced_groups') {
    return { tone: 'collecting', pill: 'Még gyűlik az adat', answer: 'Még nincs elég hétvégi adat.' }
  }
  if (pair.verdict !== 'live' && pair.verdict !== 'frozen') {
    return { tone: 'collecting', pill: 'Még gyűlik az adat', answer: verdictSentence(pair, null) }
  }
  if (pattern?.status === 'confirmed') {
    return { tone: 'confirmed', pill: 'Megerősítve', answer: 'Ezt a kapcsolatot már megerősítetted.' }
  }
  if (pattern?.status === 'rejected') {
    return { tone: 'rejected', pill: 'Elvetve', answer: 'Ezt a kapcsolatot elvetetted.' }
  }
  if (pattern?.status === 'monitoring') {
    return { tone: 'monitoring', pill: 'Figyeljük', answer: 'Ezt a kapcsolatot tovább figyeljük.' }
  }
  if (isStrongSignal(pair.r, pair.p)) {
    return { tone: 'decision', pill: 'Döntésre vár', answer: 'Van egy kapcsolat, amit érdemes megítélned.' }
  }
  return { tone: 'uncertain', pill: 'Még bizonytalan', answer: 'Van már elég közös nap, de a jel még bizonytalan.' }
}

function hypothesis(pair: PatternMonitorPair): string {
  if (pair.key === 'weekend~late-meal-hour') {
    return 'Azt vizsgáljuk, hogy hétvégén későbbre csúszik-e az utolsó étkezésed.'
  }
  return `Amit vizsgálunk: ${pair.questionHu}`
}

/** Befagyott (megítélt) párnál a `pair.n` a DÖNTÉS pillanatának közös napjai, a gyűrű és a
 *  grafikon viszont a mostani ablakot mutatja — a kettő eltérhet. Ilyenkor kimondjuk, melyik
 *  szám mit jelent, sosem hagyjuk őket csupaszon egymás mellett (mezo-bsb6h, bible 51). */
export function frozenDaysDiffer(pair: PatternMonitorPair, dayCount: number): boolean {
  return pair.verdict === 'frozen' && pair.n != null && pair.n !== dayCount
}

function Finding({ pair, dayCount }: { pair: PatternMonitorPair; dayCount: number }) {
  const finding = findingSentence(pair)
  if (!finding) return null
  const differ = frozenDaysDiffer(pair, dayCount)
  return (
    <p className="pdt-finding">
      <b>{finding.prefix}</b>{' '}{finding.before}<strong>{finding.strength}</strong>{finding.after}.
      {pair.n != null && pair.p != null && <small>{differ ? 'A döntésedkor ' : ''}{confidenceMeta(pair.n, pair.p).sentence}.</small>}
      {differ && <small>Azóta az ablak továbbcsúszott: a grafikon most {dayCount} napot mutat.</small>}
    </p>
  )
}

export function PatternDetailHero({ pair, pattern, dayCount, onDecide }: {
  pair: PatternMonitorPair
  pattern: Pattern | null
  /** „Az eddigi napok" grafikon napjai — a gyűrű UGYANEZT a számot mondja (mezo-twizx). */
  dayCount: number
  onDecide: (status: PatternStatus) => void
}) {
  const state = stateFor(pair, pattern)
  const look = TONE_OF[state.tone]
  const showActions = pair.verdict === 'live'
    && (pattern?.status ?? 'proposed') === 'proposed'
    && isStrongSignal(pair.r, pair.p)
  const groupCount = Math.min(pair.groupZeroDays ?? Infinity, pair.groupOneDays ?? Infinity)
  const required = pair.requiredPerGroup ?? 0
  const progress = Number.isFinite(groupCount) && required > 0 ? Math.min(100, groupCount / required * 100) : 0
  const domain = DOMAIN_META[pair.metricBDomain]
  const imbalanced = pair.verdict === 'imbalanced_groups'
  // A még gyűlő pár gyűrűje a hiányzó napok felé telik; az élő/befagyott pár teli.
  const collecting = pair.verdict !== 'live' && pair.verdict !== 'frozen'
  const missing = pair.missingDays ?? 0
  const dayPct = collecting && missing > 0 ? pair.alignedDays / (pair.alignedDays + missing) * 100 : 100

  return (
    <DetailHero tone={look.tone} art={PATTERN_DOMAIN_ART[pair.metricBDomain]} labelledBy="pdt-answer"
      well={<span className="pdt-domain" data-pattern-domain={pair.metricBDomain}>
        <Icon3D name={PATTERN_DOMAIN_ART[pair.metricBDomain]} size={32} />
      </span>}
      eyebrow={domain.label} title={pair.title}
      pill={<StatePill label={state.pill} tone={look.tone} art={look.art} />}>
      <p className="pdt-hypothesis">{hypothesis(pair)}</p>
      <div className="pdt-core">
        {imbalanced && Number.isFinite(groupCount)
          ? <DayRing value={groupCount} of={required} pct={progress} unit="HÉTVÉGI NAP" tone="lav"
              ariaLabel={`${groupCount} a szükséges ${required} hétvégi napból`} />
          : <DayRing value={dayCount} pct={dayPct} unit="NAP" tone={look.tone}
              ariaLabel={`${dayCount} nap a grafikonon`} />}
        <div className="pdt-answer">
          <h1 id="pdt-answer">{state.answer}</h1>
          {imbalanced ? <p className="pdt-answer-sub">{groupBalanceSentence(pair)}</p> : <Finding pair={pair} dayCount={dayCount} />}
        </div>
      </div>
      {showActions && pattern && (
        <>
          <DecisionRow label="Döntés a mintáról" buttons={patternDecisionButtons((verb) => onDecide(verb))} />
          <DecisionNote />
        </>
      )}
    </DetailHero>
  )
}
