import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { usePatternPairDetail, usePatternActions, usePatternMonitor } from '@/data/hooks'
import { PatternDecisionCard } from '@/features/insights/components/PatternDecisionCard'
import { PatternStrengthChart } from '@/features/insights/components/PatternStrengthChart'
import { PatternScatter } from '@/features/insights/components/PatternScatter'
import { PatternJournal } from '@/features/insights/components/PatternJournal'
import { PatternImpactCard } from '@/features/insights/components/PatternImpactCard'
import { LifecycleSection } from '@/features/insights/components/LifecycleSection'
import {
  chartDateLabel,
  firstLastSnapshotN,
  journalEntries,
  latestAlignedDay,
  strengthSeries,
  strengthTrendCaption,
} from '@/features/insights/logic/patternHistory'
import { formatMetricValue, formatP, formatR } from '@/features/insights/logic/metricFormat'
import { verdictSentence } from '@/features/insights/logic/verdicts'
import { pairLine } from '@/features/insights/logic/findings'
import { DOMAIN_META } from '@/features/insights/logic/domains'
import { patternCategoryColor } from '@/data/insights/insights'
import type { PatternMonitorPair, PatternStatus } from '@/data/types'

// Shared between the strength card and the journal card (review fix, item 3) — the two empty
// states describe the SAME condition (no `pattern_event` history yet), so they use the identical
// sentence rather than two copies that could drift apart.
const NO_HISTORY_YET = 'Még nincs előzmény — az éjszakai futások töltik.'

/** „ma HH:mm" — mirrors `MotorStateHero`'s own private formatter (the job runs once nightly). */
function lastRunLabel(lastRunAt: string | null | undefined): string {
  if (!lastRunAt) return '—'
  const time = new Date(lastRunAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
  return `ma ${time}`
}

/**
 * The full-page frame every branch of the detail page renders inside (mezo-fy97): the sibling
 * route sits outside `InsightsSection`'s padded outlet, so the page brings its own padding and
 * the house full-page header row (back chevron + h1 — the AiUsagePage idiom). Wrapping the
 * pending/error/not-found branches too keeps a way back on every state.
 */
function DetailFrame({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <MozaikPage tone="gold">
      {/* mezo-d20.11: the ad-hoc chevron + h1 row becomes the house PageHead chip, and it now
          points at the LIST it was opened from (`/mezo/patterns`) rather than the hub — the
          user's way back is one step, not two. */}
      <PageHead onBack={() => navigate('/mezo/patterns')} label="‹ Minták" />
      <div className="mz-page-hero">
        <div className="mz-hero-nm">Minta részletei</div>
      </div>
      <PageBody>
        <div className="col gap-md">{children}</div>
      </PageBody>
    </MozaikPage>
  )
}

/**
 * The plain header for a pair with no persisted `Pattern` row yet (still gathering, or LIVE but
 * the nightly job hasn't produced a row) — no decision buttons, just the honest gate status via
 * `verdictSentence`. `PatternDecisionCard` needs a non-null `pattern`, so this is its sibling for
 * the no-row case (interfaces note, task-13-brief.md).
 */
function GatheringHeaderCard({ pair, bottleneckCoveredDays }: { pair: PatternMonitorPair; bottleneckCoveredDays: number | null }) {
  return (
    <div className="card" style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: patternCategoryColor(pair.category) }} />
      <span className="chip" style={{ fontSize: 10, padding: '4px 10px' }}>
        {DOMAIN_META[pair.metricBDomain].icon} {DOMAIN_META[pair.metricBDomain].label}
      </span>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 10, lineHeight: 1.3, color: 'var(--text-primary)' }}>
        {pair.questionHu}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{pairLine(pair)}</div>
      <div style={{ borderRadius: 14, padding: '10px 12px', marginTop: 10, background: 'var(--surface-recess)' }}>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          {verdictSentence(pair, bottleneckCoveredDays)}
        </p>
      </div>
    </div>
  )
}

/**
 * The pattern-pair detail page (mezo-tk88.5, spec-mockup screen 2) — a leaf route
 * (`/mezo/patterns/:pairKey`, no Insights sub-nav) reached from the dashboard's „Részletek és
 * előzmények →" / lifecycle-row links. Top to bottom: back link → header card (the dashboard's own
 * `PatternDecisionCard`, reused, or the plain `GatheringHeaderCard` for a no-row pair) → the
 * strength-over-time chart → the day-by-day scatter → the history journal → what the app built
 * from this pair → a collapsed engine-diagnostics section (the ONLY place raw r/n/p appears).
 */
export function PatternDetailPage() {
  const { pairKey = '' } = useParams<{ pairKey: string }>()
  const { detail, notFound, isPending, isError, refetch } = usePatternPairDetail(pairKey)
  const { decide } = usePatternActions()
  const { monitor } = usePatternMonitor()
  const [showDays, setShowDays] = useState(false)

  if (isPending) {
    return (
      <DetailFrame>
        <GhostState message="A minta betöltése…" />
      </DetailFrame>
    )
  }

  if (isError) {
    return (
      <DetailFrame>
        <GhostState message="Nem sikerült betölteni a mintát." ctaLabel="Újra" onCta={refetch} />
      </DetailFrame>
    )
  }

  if (notFound || !detail) {
    return (
      <DetailFrame>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs ilyen minta.</span>
        </div>
      </DetailFrame>
    )
  }

  const { pair, pattern, events, days, impact } = detail
  const coverageByKey = new Map((monitor?.metrics ?? []).map((m) => [m.key, m]))
  const bottleneckCoveredDays = pair.bottleneckMetricKey
    ? (coverageByKey.get(pair.bottleneckMetricKey)?.coveredDays ?? null)
    : null

  const snapshotRange = firstLastSnapshotN(events)
  const latestDay = latestAlignedDay(days)
  const entries = journalEntries(events, pair)
  const hasEnoughDays = days.length >= 2

  return (
    <DetailFrame>
      {pattern ? (
        <PatternDecisionCard
          pattern={pattern}
          pair={pair}
          onDecide={(d: PatternStatus) => decide(pattern.id, d)}
          showExplainer={false}
          titleSize={19}
          showDetailLink={false}
        />
      ) : (
        <GatheringHeaderCard pair={pair} bottleneckCoveredDays={bottleneckCoveredDays} />
      )}

      <div className="card" style={{ padding: '15px 16px' }}>
        <span className="eyebrow">Hogyan erősödött a jel</span>
        <PatternStrengthChart events={events} />
        <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
          {snapshotRange
            ? strengthTrendCaption(strengthSeries(events), snapshotRange.first, snapshotRange.last)
            : NO_HISTORY_YET}
        </p>
      </div>

      <div className="card" style={{ padding: '15px 16px' }}>
        <span className="eyebrow">
          {hasEnoughDays ? `A ${days.length} nap, amiből ez kijött` : 'Napok, amikből ez majd kijön'}
        </span>
        <PatternScatter days={days} pair={pair} />
        {hasEnoughDays && latestDay ? (
          <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
            Minden pont egy nap. A kiemelt a legutóbbi: {chartDateLabel(latestDay.date)}.{' '}
            <button
              type="button"
              onClick={() => setShowDays((v) => !v)}
              className="eyebrow"
              style={{ color: 'var(--lav-deep)', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
            >
              Napok listája →
            </button>
          </p>
        ) : (
          <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
            Még nincs elég nap az összevetéshez — ahogy gyűlnek, itt jelennek meg.
          </p>
        )}
        {showDays && hasEnoughDays && (
          <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)' }}>dátum</th>
                <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)' }}>{pair.metricALabel}</th>
                <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)' }}>{pair.metricBLabel}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <td style={{ padding: '4px 6px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>{d.date}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>{formatMetricValue(pair.metricAKey, d.a)}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>{formatMetricValue(pair.metricBKey, d.b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ padding: '15px 16px' }}>
        <span className="eyebrow">A minta története</span>
        {entries.length > 0 ? (
          <PatternJournal entries={entries} />
        ) : (
          <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
            {NO_HISTORY_YET}
          </p>
        )}
      </div>

      <PatternImpactCard pattern={pattern} impact={impact} />

      <LifecycleSection title="🔧 Motor-diagnosztika" accent="var(--text-secondary)">
        <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-tertiary)', padding: '0 4px' }}>
          Ablak: {monitor?.windowFrom ?? '—'} – {monitor?.windowTo ?? '—'} ({monitor?.lookbackDays ?? '—'} nap) · lag: {pair.lagDays} nap · utolsó futás: {lastRunLabel(monitor?.lastRunAt)}
        </p>
        {(pattern?.status === 'confirmed' || pattern?.status === 'rejected') && (
          <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-tertiary)', padding: '0 4px' }}>
            Mivel megítélted, a számok <b style={{ color: 'var(--text-secondary)' }}>befagytak</b> — az éjszakai job
            már csak azt figyeli, előjön-e újra.
          </p>
        )}
        <div className="row gap-sm" style={{ flexWrap: 'wrap', padding: '0 4px' }}>
          <span className="chip" style={{ fontSize: 10 }}>{pair.metricALabel} · {coverageByKey.get(pair.metricAKey)?.sourceHu ?? '—'}</span>
          <span className="chip" style={{ fontSize: 10 }}>{pair.metricBLabel} · {coverageByKey.get(pair.metricBKey)?.sourceHu ?? '—'}</span>
        </div>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-secondary)', padding: '0 4px' }}>
          r={formatR(pair.r)} · n={pair.n ?? '—'} · p={formatP(pair.p)}
        </span>
      </LifecycleSection>
    </DetailFrame>
  )
}
