import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DOMAIN_META } from '@/features/insights/logic/domains'
import type { PatternGateVerdict, PatternMonitorPair } from '@/data/types'

const VERDICT_COLOR: Record<PatternGateVerdict, { color: string; bg: string }> = {
  live: { color: 'var(--text-inverse)', bg: 'var(--success-base)' },
  few_days: { color: 'var(--warning-deep)', bg: 'var(--warning-soft)' },
  no_data: { color: 'var(--text-secondary)', bg: 'var(--secondary-bg)' },
  degenerate: { color: 'var(--error-deep)', bg: 'var(--error-soft)' },
  frozen: { color: 'var(--accent-deep)', bg: 'var(--accent-soft)' },
}

function verdictPillText(pair: PatternMonitorPair): string {
  switch (pair.verdict) {
    case 'live':
      return 'ÉLŐ'
    case 'few_days':
      return `MÉG ${pair.missingDays} NAP`
    case 'no_data':
      return 'NINCS ADAT'
    case 'degenerate':
      return 'NEM MOZDUL'
    case 'frozen':
      return 'FAGYASZTVA'
  }
}

/** A szűk keresztmetszet kulcsához tartozó magyar címke a pár saját két metrikájából. */
function bottleneckLabel(pair: PatternMonitorPair): string {
  return pair.bottleneckMetricKey === pair.metricBKey ? pair.metricBLabel : pair.metricALabel
}

/**
 * Egyetlen determinisztikus mondat — sosem állít többet, mint amit a verdikt fed. A few_days
 * cselekvésre fordítva (🎯 nudge, mezo-18bx); a no_data megkülönböztetése változatlan:
 * `bottleneckCoveredDays === 0` esetén nevezzük csak meg az üres metrikát, egyébként az
 * átfedés hiányát írjuk le (aligned==0 ≠ „az egyik metrika üres", pl. lag=1 párok).
 */
export function verdictSentence(pair: PatternMonitorPair, bottleneckCoveredDays: number | null): string {
  switch (pair.verdict) {
    case 'live':
      return `Elég adat van — a motor számolja ezt a párt.`
    case 'few_days':
      return `🎯 Még ${pair.missingDays} nap adat ebből: ${bottleneckLabel(pair)} — és ez a pár életre kel!`
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

/**
 * A Motor tab kibontható pár-sora (mezo-18bx, a GateVerdictRow utódja): verdikt-pill +
 * r-erősség sáv + kereszt-domén chip; kibontva mechanizmus + forrás-pillek + Patterns-link
 * (csak élő/fagyasztott soron — másnak nincs minta-kártyája).
 */
export function PairRow({
  pair,
  bottleneckCoveredDays,
  sourceA,
  sourceB,
  railColor,
}: {
  pair: PatternMonitorPair
  bottleneckCoveredDays: number | null
  sourceA: string
  sourceB: string
  railColor: string
}) {
  const [expanded, setExpanded] = useState(false)
  const pill = VERDICT_COLOR[pair.verdict]
  const lag = pair.lagDays > 0 ? ` · +${pair.lagDays} nap` : ''
  const crossDomain = pair.metricADomain !== pair.metricBDomain ? DOMAIN_META[pair.metricADomain] : null
  const linkable = pair.verdict === 'live' || pair.verdict === 'frozen'

  return (
    <div
      data-testid="pair-row"
      className="card"
      style={{ padding: 14, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: railColor }} />

      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow text-tertiary">{pair.categoryLabel}</span>
        <span className="row gap-sm">
          {crossDomain && (
            <span
              className="chip"
              style={{ fontSize: 9, padding: '2px 7px', color: crossDomain.rail, background: crossDomain.tint, border: 'none' }}
            >
              {crossDomain.label}
            </span>
          )}
          <span
            className="chip"
            style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', letterSpacing: '0.03em', color: pill.color, background: pill.bg, border: 'none' }}
          >
            {verdictPillText(pair)}
          </span>
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

      {pair.verdict === 'live' && pair.r != null && (
        <div className="row gap-sm" style={{ marginTop: 8, alignItems: 'center' }}>
          <div className="bar" style={{ width: 90 }}>
            <div
              className="bar-fill"
              style={{ width: `${Math.min(Math.abs(pair.r), 1) * 100}%`, background: 'var(--success-base)' }}
            />
          </div>
          <span className="eyebrow text-tertiary">
            r={pair.r.toFixed(2)} · {pair.n} nap{pair.p != null ? ` · p=${pair.p.toFixed(3)}` : ''}
          </span>
        </div>
      )}

      <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
        {verdictSentence(pair, bottleneckCoveredDays)}
      </p>

      {pair.verdict !== 'live' && (
        <div className="row gap-sm" style={{ marginTop: 6, flexWrap: 'wrap' }}>
          <span className="chip" style={{ fontSize: 9 }}>
            {pair.verdict === 'few_days' ? `n=${pair.alignedDays}/${pair.alignedDays + (pair.missingDays ?? 0)}` : `n=${pair.alignedDays} nap`}
          </span>
          {pair.r != null && <span className="chip" style={{ fontSize: 9 }}>r={pair.r.toFixed(2)}</span>}
          {pair.p != null && <span className="chip" style={{ fontSize: 9 }}>p={pair.p.toFixed(3)}</span>}
        </div>
      )}

      {expanded && (
        <div
          className="card"
          style={{ marginTop: 10, padding: '11px 12px', background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)' }}
        >
          <div className="eyebrow" style={{ color: 'var(--accent-deep)' }}>💡 Miért figyeljük</div>
          <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>{pair.mechanismHu}</p>
          <div className="eyebrow" style={{ color: 'var(--accent-deep)', marginTop: 8 }}>📥 Honnan jön az adat</div>
          <div className="row gap-sm" style={{ marginTop: 4, flexWrap: 'wrap' }}>
            <span className="chip" style={{ fontSize: 10, background: 'var(--surface-card)' }}>
              {pair.metricALabel} · {sourceA}
            </span>
            <span className="chip" style={{ fontSize: 10, background: 'var(--surface-card)' }}>
              {pair.metricBLabel} · {sourceB}
            </span>
          </div>
          {linkable && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <Link
                to={`/insights/patterns?pair=${pair.key}`}
                onClick={(e) => e.stopPropagation()}
                className="chip"
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: '8px 16px',
                  color: 'var(--text-inverse)',
                  background: 'var(--primary-base)',
                  border: 'none',
                }}
              >
                Minta megnyitása →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
