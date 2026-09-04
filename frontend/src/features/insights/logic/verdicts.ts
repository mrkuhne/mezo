import type { PatternMonitorPair } from '@/data/types'
import { binaryGroupLabels } from '@/features/insights/logic/metricFormat'

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
    case 'imbalanced_groups': {
      const state = groupBalance(pair)
      return state == null
        ? 'Mindkét oldalról több nap kell.'
        : `Még ${state.missing} ${state.deficient.day} nap kell.`
    }
    case 'frozen':
      return `Te ítélted meg (${pair.status === 'confirmed' ? 'megerősítve' : 'elvetve'}) — az éjszakai job nem számolja újra.`
  }
}

interface GroupBalance {
  abundant: { count: number; day: string }
  deficient: { count: number; day: string }
  missing: number
}

function groupBalance(pair: PatternMonitorPair): GroupBalance | null {
  if (pair.groupZeroDays == null || pair.groupOneDays == null || pair.requiredPerGroup == null) {
    return null
  }
  const labels = binaryGroupLabels(pair.metricAKey)
  const zero = { count: pair.groupZeroDays, day: labels.zero.day }
  const one = { count: pair.groupOneDays, day: labels.one.day }
  const [abundant, deficient] = zero.count >= one.count ? [zero, one] : [one, zero]
  return {
    abundant,
    deficient,
    missing: Math.max(0, pair.requiredPerGroup - deficient.count),
  }
}

/** Explains why a binary comparison remains a question instead of claiming a direction. */
export function groupBalanceSentence(pair: PatternMonitorPair): string {
  const state = groupBalance(pair)
  if (state == null) return 'Mindkét oldalról több nap kell, mielőtt irányt mondanánk.'
  const evidence = state.deficient.count === 1
    ? `Egyetlen ${state.deficient.day} napból még nem mondunk irányt.`
    : `Ebből a ${state.deficient.count} ${state.deficient.day} napból még nem mondunk irányt.`
  return `${state.abundant.count} ${state.abundant.day} nap mellett még csak ${state.deficient.count} ${state.deficient.day} nap van. ${evidence}`
}
