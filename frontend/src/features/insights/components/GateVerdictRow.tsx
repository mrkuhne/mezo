import type { PatternGateVerdict, PatternMonitorPair } from '@/data/types'

const VERDICT_LABEL: Record<PatternGateVerdict, string> = {
  live: 'él',
  few_days: 'kevés nap',
  degenerate: 'nem mozdul',
  no_data: 'nincs adat',
  frozen: 'befagyasztva',
}

const VERDICT_COLOR: Record<PatternGateVerdict, string> = {
  live: 'var(--success)',
  few_days: 'var(--warning)',
  degenerate: 'var(--warning)',
  no_data: 'var(--text-tertiary)',
  frozen: 'var(--lav-deep)',
}

/** A szűk keresztmetszet kulcsához tartozó magyar címke a pár saját két metrikájából. */
function bottleneckLabel(pair: PatternMonitorPair): string {
  return pair.bottleneckMetricKey === pair.metricBKey ? pair.metricBLabel : pair.metricALabel
}

/**
 * Egyetlen determinisztikus mondat — sosem állít többet, mint amit a verdikt fed.
 * `bottleneckCoveredDays`: a szűk keresztmetszet metrika lefedettsége EBBEN az ablakban — csak
 * `no_data`-nál számít. A backend `no_data`-t akkor ad, ha `alignedDays == 0`, ami NEM ugyanaz,
 * mint "az egyik metrika üres" — a két metrikának lehet bőven adata, csak sosem esik egy napra
 * (pl. `lag=1` párok sosem illeszkednek). Ezért csak akkor mondjuk ki konkrétan, hogy melyik
 * metrika üres, ha az tényleg `coveredDays === 0`; egyébként az átfedés hiányát írjuk le.
 */
export function verdictSentence(pair: PatternMonitorPair, bottleneckCoveredDays: number | null): string {
  switch (pair.verdict) {
    case 'live':
      return `Elég adat van — a motor számolja ezt a párt.`
    case 'few_days':
      return `Még ${pair.missingDays} illeszkedő nap kell — a szűk keresztmetszet: ${bottleneckLabel(pair)}.`
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

export function GateVerdictRow({ pair, bottleneckCoveredDays }: { pair: PatternMonitorPair; bottleneckCoveredDays: number | null }) {
  const color = VERDICT_COLOR[pair.verdict]
  const lag = pair.lagDays > 0 ? ` · +${pair.lagDays} nap` : ''

  return (
    <div className="card" style={{ padding: 14, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow text-tertiary">{pair.categoryLabel}</span>
        <span
          className="chip"
          style={{ fontSize: 9, padding: '3px 8px', color, borderColor: `${color}59`, background: 'var(--surface-glass)' }}
        >
          {VERDICT_LABEL[pair.verdict]}
        </span>
      </div>

      <div
        data-testid="gate-pair-title"
        style={{ fontFamily: 'var(--ff-display)', fontSize: 15, marginTop: 8, lineHeight: 1.25, color: 'var(--text-primary)' }}
      >
        {pair.title}
      </div>

      <div className="eyebrow text-tertiary" style={{ marginTop: 4 }}>
        {pair.metricALabel} → {pair.metricBLabel}{lag}
      </div>

      <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
        {verdictSentence(pair, bottleneckCoveredDays)}
      </p>

      <div className="row gap-sm" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <span className="chip" style={{ fontSize: 9 }}>
          {pair.verdict === 'few_days' ? `n=${pair.alignedDays}/${pair.alignedDays + (pair.missingDays ?? 0)}` : `n=${pair.alignedDays} nap`}
        </span>
        {pair.r != null && <span className="chip" style={{ fontSize: 9 }}>r={pair.r.toFixed(2)}</span>}
        {pair.p != null && <span className="chip" style={{ fontSize: 9 }}>p={pair.p.toFixed(3)}</span>}
      </div>
    </div>
  )
}
