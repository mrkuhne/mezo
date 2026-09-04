import { confidenceMeta, findingSentence } from '@/features/insights/logic/findings'
import { DOMAIN_META } from '@/features/insights/logic/domains'
import { isStrongSignal } from '@/features/insights/logic/lifecycle'
import { groupBalanceSentence, verdictSentence } from '@/features/insights/logic/verdicts'
import type { Pattern, PatternMonitorPair, PatternStatus } from '@/data/types'

interface HeroState {
  tone: string
  pill: string
  answer: string
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

function Finding({ pair }: { pair: PatternMonitorPair }) {
  const finding = findingSentence(pair)
  if (!finding) return null
  return (
    <div className="pdt-finding">
      <b>{finding.prefix}</b>{' '}{finding.before}<strong>{finding.strength}</strong>{finding.after}.
      {pair.n != null && pair.p != null && <small>{confidenceMeta(pair.n, pair.p).sentence}.</small>}
    </div>
  )
}

export function PatternDetailHero({ pair, pattern, onDecide }: {
  pair: PatternMonitorPair
  pattern: Pattern | null
  onDecide: (status: PatternStatus) => void
}) {
  const state = stateFor(pair, pattern)
  const showActions = pair.verdict === 'live'
    && (pattern?.status ?? 'proposed') === 'proposed'
    && isStrongSignal(pair.r, pair.p)
  const groupCount = Math.min(pair.groupZeroDays ?? Infinity, pair.groupOneDays ?? Infinity)
  const required = pair.requiredPerGroup ?? 0
  const progress = Number.isFinite(groupCount) && required > 0 ? Math.min(100, groupCount / required * 100) : 0
  const domain = DOMAIN_META[pair.metricBDomain]

  return (
    <section className={`pdt-hero pdt-hero-${state.tone}`} aria-labelledby="pdt-answer">
      <div className="pdt-hero-top">
        <span className="pdt-hero-icon" aria-hidden="true">{domain.icon}</span>
        <span><small>{domain.label}</small><b>{pair.title}</b></span>
        <span className="pdt-state-pill">{state.pill}</span>
      </div>
      <p className="pdt-hypothesis">{hypothesis(pair)}</p>
      <h1 id="pdt-answer">{state.answer}</h1>
      {pair.verdict === 'imbalanced_groups' ? (
        <>
          <p className="pdt-hero-copy">{groupBalanceSentence(pair)}</p>
          <div className="pdt-progress-copy"><span>Hétvégi napok</span><strong>{groupCount} / {required}</strong></div>
          <div className="pdt-progress" aria-label={`${groupCount} a szükséges ${required} hétvégi napból`}>
            <i style={{ width: `${progress}%` }} />
          </div>
        </>
      ) : <Finding pair={pair} />}
      {showActions && pattern && (
        <div className="pdt-actions">
          <button type="button" className="pdt-action-primary" onClick={() => onDecide('confirm')}>Megerősítem</button>
          <button type="button" onClick={() => onDecide('monitor')}>Figyeljük</button>
          <button type="button" onClick={() => onDecide('reject')}>Elvetem</button>
        </div>
      )}
    </section>
  )
}
