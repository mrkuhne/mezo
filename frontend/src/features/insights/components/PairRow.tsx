import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DOMAIN_META } from '@/features/insights/logic/domains'
import { confidenceMeta, findingSentence, pairLine } from '@/features/insights/logic/findings'
import type { PatternGateVerdict, PatternMonitorPair } from '@/data/types'

const VERDICT_COLOR: Record<PatternGateVerdict, { color: string; bg: string }> = {
  live: { color: 'var(--text-inverse)', bg: 'var(--success-base)' },
  few_days: { color: 'var(--warning-deep)', bg: 'var(--warning-soft)' },
  no_data: { color: 'var(--text-secondary)', bg: 'var(--secondary-bg)' },
  degenerate: { color: 'var(--error-deep)', bg: 'var(--error-soft)' },
  frozen: { color: 'var(--accent-deep)', bg: 'var(--accent-soft)' },
}

const CONFIDENCE_TONE: Record<'success' | 'accent' | 'warning', { color: string; bg: string }> = {
  success: { color: 'var(--success-deep)', bg: 'var(--success-bg)' },
  accent: { color: 'var(--accent-deep)', bg: 'var(--accent-bg)' },
  warning: { color: 'var(--warning-deep)', bg: 'var(--warning-bg)' },
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

/**
 * A Motor tab pár-kártyája (mezo-fj1g, v4): kérdés-cím + 🔍 „Amit keresünk" + 📈 „Amit eddig
 * látunk" — a lelet páronként írt irány-olvasatból komponált EMBERI mondat; a nyers r/n/p a
 * kibontott nézet „statisztika" sorába költözött.
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
  const crossDomain = pair.metricADomain !== pair.metricBDomain ? DOMAIN_META[pair.metricADomain] : null
  const linkable = pair.verdict === 'live' || pair.verdict === 'frozen'
  const finding = findingSentence(pair)
  const confidence = pair.n != null && pair.p != null ? confidenceMeta(pair.n, pair.p) : null

  return (
    <div
      data-testid="pair-row"
      className="card"
      style={{ padding: 15, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: railColor }} />

      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <span
          className="chip"
          style={{ fontSize: 9, letterSpacing: '0.08em', padding: '3px 8px', border: 'none', background: 'var(--surface-recess)', color: 'var(--text-secondary)' }}
        >
          {pair.categoryLabel}
        </span>
        <span className="row gap-sm">
          {crossDomain && (
            <span
              className="chip"
              style={{ fontSize: 9, padding: '2px 7px', color: crossDomain.rail, background: crossDomain.tint, border: 'none' }}
            >
              {crossDomain.icon} {crossDomain.label}
            </span>
          )}
          <span
            className="chip"
            style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', letterSpacing: '0.03em', color: pill.color, background: pill.bg, border: 'none' }}
          >
            {verdictPillText(pair)}
          </span>
        </span>
      </div>

      <div
        data-testid="gate-pair-title"
        style={{ fontFamily: 'var(--ff-display)', fontSize: 17, fontWeight: 800, marginTop: 10, lineHeight: 1.35, color: 'var(--text-primary)' }}
      >
        {pair.questionHu}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{pairLine(pair)}</div>

      <div className="col" style={{ gap: 4, marginTop: 12, borderRadius: 12, padding: '10px 12px', background: 'var(--wash-lav)' }}>
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>🔍 Amit keresünk</span>
        <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: 'var(--text-primary)' }}>{pair.mechanismHu}</p>
      </div>

      {finding ? (
        <div className="col" style={{ gap: 4, marginTop: 8, borderRadius: 12, padding: '10px 12px', background: 'var(--surface-recess)' }}>
          <span className="eyebrow" style={{ color: 'var(--accent-deep)' }}>📈 Amit eddig látunk</span>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: 'var(--text-primary)' }}>
            {finding.prefix} {finding.before}
            <b>{finding.strength}</b>
            {finding.after}.
          </p>
          {confidence && (
            <div className="row gap-sm" style={{ alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <span
                className="chip"
                style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', border: 'none', ...CONFIDENCE_TONE[confidence.tone] && { color: CONFIDENCE_TONE[confidence.tone].color, background: CONFIDENCE_TONE[confidence.tone].bg } }}
              >
                {confidence.chip}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{confidence.sentence}</span>
            </div>
          )}
          {pair.verdict === 'frozen' && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {verdictSentence(pair, bottleneckCoveredDays)}
            </span>
          )}
        </div>
      ) : (
        <div
          className="col"
          style={{ gap: 4, marginTop: 8, borderRadius: 12, padding: '10px 12px', background: pair.verdict === 'few_days' ? 'var(--warning-bg)' : 'var(--surface-recess)' }}
        >
          <span className="eyebrow" style={{ color: 'var(--warning-deep)' }}>
            {pair.verdict === 'few_days' ? '🎯 Még nincs válasz' : 'Miért nincs még válasz'}
          </span>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: 'var(--text-primary)' }}>
            {verdictSentence(pair, bottleneckCoveredDays)}
          </p>
        </div>
      )}

      {expanded && (
        <div
          className="card"
          style={{ marginTop: 10, padding: '11px 12px', background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)' }}
        >
          <div className="eyebrow" style={{ color: 'var(--accent-deep)' }}>📥 Honnan jön az adat</div>
          <div className="row gap-sm" style={{ marginTop: 4, flexWrap: 'wrap' }}>
            <span className="chip" style={{ fontSize: 10, background: 'var(--surface-card)' }}>
              {pair.metricALabel} · {sourceA}
            </span>
            <span className="chip" style={{ fontSize: 10, background: 'var(--surface-card)' }}>
              {pair.metricBLabel} · {sourceB}
            </span>
          </div>
          {(pair.r != null || pair.alignedDays > 0) && (
            <>
              <div className="eyebrow" style={{ color: 'var(--accent-deep)', marginTop: 8 }}>Statisztika</div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--ff-mono)' }}>
                {pair.r != null ? `r=${pair.r.toFixed(2)} · ` : ''}n={pair.n ?? pair.alignedDays}
                {pair.p != null ? ` · p=${pair.p.toFixed(3)}` : ''}
              </span>
            </>
          )}
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
