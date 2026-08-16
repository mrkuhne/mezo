import type { PatternMonitorPair } from '@/data/types'

/** A szűk keresztmetszet kulcsához tartozó magyar címke a pár saját két metrikájából. */
export function bottleneckLabel(pair: PatternMonitorPair): string {
  return pair.bottleneckMetricKey === pair.metricBKey ? pair.metricBLabel : pair.metricALabel
}

/**
 * A nem-élő verdiktek őszinte mondata — sosem állít többet, mint amit a verdikt fed. A few_days
 * cselekvésre fordítva (🎯 nudge); a no_data megkülönböztetése változatlan: `bottleneckCoveredDays
 * === 0` esetén nevezzük csak meg az üres metrikát (aligned==0 ≠ „az egyik metrika üres").
 */
export function verdictSentence(pair: PatternMonitorPair, bottleneckCoveredDays: number | null): string {
  switch (pair.verdict) {
    case 'live':
      return `Elég adat van — a motor számolja ezt a párt.`
    case 'few_days':
      return `Még ${pair.missingDays} nap adat ebből: ${bottleneckLabel(pair)} — és ez a pár életre kel!`
    case 'no_data':
      return bottleneckCoveredDays === 0
        ? `Nincs még illeszkedő nap — a(z) ${bottleneckLabel(pair)} üres ebben az ablakban.`
        : `Nincs még illeszkedő nap — nincs átfedő nap a(z) ${pair.metricALabel} és a(z) ${pair.metricBLabel} között ebben az ablakban.`
    case 'degenerate':
      return `A(z) ${bottleneckLabel(pair)} nem mozdul az ablakban — így nincs mit korrelálni.`
    case 'frozen':
      return `Te ítélted meg (${pair.status === 'confirmed' ? 'megerősítve' : 'elvetve'}) — az éjszakai job nem számolja újra.`
  }
}
