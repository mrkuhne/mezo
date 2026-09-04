import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { usePatternActions, usePatternMonitor, usePatternPairDetail, usePatterns } from '@/data/hooks'
import { PatternArtifactDetail } from '@/features/insights/components/PatternArtifactDetail'
import { PatternDetailHero } from '@/features/insights/components/PatternDetailHero'
import { PatternEvidenceChart } from '@/features/insights/components/PatternEvidenceChart'
import { PatternImpactCard } from '@/features/insights/components/PatternImpactCard'
import { PatternJournal } from '@/features/insights/components/PatternJournal'
import { PatternStrengthChart } from '@/features/insights/components/PatternStrengthChart'
import { groupedEvidence } from '@/features/insights/logic/patternEvidence'
import { firstLastSnapshotN, journalEntries, strengthSeries, strengthTrendCaption } from '@/features/insights/logic/patternHistory'
import { binaryGroupLabels, formatMetricValue, formatP, formatR } from '@/features/insights/logic/metricFormat'
import { verdictSentence } from '@/features/insights/logic/verdicts'
import type { AlignedDay, PatternMonitorPair, PatternStatus } from '@/data/types'

function lastRunLabel(lastRunAt: string | null | undefined): string {
  if (!lastRunAt) return '—'
  return new Date(lastRunAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
}

function DetailFrame({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/mezo/patterns')} label="‹ Minták" />
      <div className="mz-page-hero"><div className="mz-hero-nm">Minta részletei</div></div>
      <PageBody><div className="pdt-page">{children}</div></PageBody>
    </MozaikPage>
  )
}

function SectionHead({ title, meta }: { title: string; meta?: string }) {
  return <div className="pdt-section-head"><h2>{title}</h2>{meta && <span>{meta}</span>}</div>
}

function GroupTile({ label, count, summary, range, deficient }: {
  label: string; count: number; summary: string; range?: string; deficient?: string
}) {
  return (
    <article className={`pdt-compare-tile ${deficient ? 'pdt-compare-deficient' : ''}`}>
      <div className="pdt-tile-label">{label}</div>
      <div className="pdt-day-count">{count} <small>nap</small></div>
      <div className="pdt-typical">{count >= 3 ? 'középső időpont' : 'eddigi időpont'}<b>{summary}</b></div>
      {range && <div className="pdt-range">{range} között</div>}
      {deficient && <span className="pdt-need-tag">{deficient}</span>}
    </article>
  )
}

function BinaryComparison({ days, pair }: { days: AlignedDay[]; pair: PatternMonitorPair }) {
  const required = pair.requiredPerGroup ?? 3
  const groups = groupedEvidence(days, required)
  const labels = binaryGroupLabels(pair.metricAKey)
  const value = (raw: number | null) => raw == null ? '—' : formatMetricValue(pair.metricBKey, raw)
  const range = (min: number | null, max: number | null) => min == null || max == null
    ? undefined : `${value(min)}–${value(max)}`
  return (
    <>
      <SectionHead title="Az összevetés alapja" meta="éles adatok" />
      <section className="pdt-compare-grid" aria-label="A két csoport összevetése">
        <GroupTile label={labels.zero.axis} count={groups.zero.count}
          summary={value(groups.zero.median ?? groups.zero.values[0] ?? null)}
          range={groups.zero.count > 1 ? range(groups.zero.min, groups.zero.max) : undefined}
          deficient={groups.zero.count < required ? `+${required - groups.zero.count} nap kell` : undefined} />
        <GroupTile label={labels.one.axis} count={groups.one.count}
          summary={value(groups.one.median ?? groups.one.values[0] ?? null)}
          range={groups.one.count > 1 ? range(groups.one.min, groups.one.max) : undefined}
          deficient={groups.one.count < required ? `+${required - groups.one.count} nap kell` : undefined} />
      </section>
    </>
  )
}

function DaysTable({ days, pair }: { days: AlignedDay[]; pair: PatternMonitorPair }) {
  return (
    <details className="pdt-days-fold">
      <summary>Napok listája →</summary>
      <table>
        <thead><tr><th>dátum</th><th>{pair.metricALabel}</th><th>{pair.metricBLabel}</th></tr></thead>
        <tbody>{days.map((day) => <tr key={day.date}>
          <td>{day.date}</td><td>{formatMetricValue(pair.metricAKey, day.a)}</td>
          <td>{formatMetricValue(pair.metricBKey, day.b)}</td>
        </tr>)}</tbody>
      </table>
    </details>
  )
}

function StoryTiles({ pair }: { pair: PatternMonitorPair }) {
  const collecting = pair.verdict === 'imbalanced_groups'
  return (
    <>
      <SectionHead title="Mit vigyél magaddal?" />
      <section className="pdt-story-grid">
        <article className="pdt-story-tile pdt-story-meaning">
          <span aria-hidden="true">✦</span><h3>Mit jelent ez?</h3>
          <p>{collecting
            ? <>Az egyetlen hétvégi nap <b>korábbinak látszik</b>, de ebből még nem következik hétvégi szokás.</>
            : <>A grafikon a most összevethető napokat mutatja. Az irányt mindig a fenti lelet mondja ki.</>}</p>
        </article>
        <article className="pdt-story-tile pdt-story-next">
          <span aria-hidden="true">↻</span><h3>Mi történik ezután?</h3>
          <p>{collecting
            ? <><b>{verdictSentence(pair, null)}</b> Addig csak gyűjtjük az étkezési naplódat.</>
            : <>Az új közös napokkal a motor újraszámolja a kapcsolatot és jelzi, ha érdemben változik.</>}</p>
        </article>
      </section>
    </>
  )
}

function Diagnostics({ pair, monitor }: {
  pair: PatternMonitorPair
  monitor: ReturnType<typeof usePatternMonitor>['monitor']
}) {
  const coverage = new Map((monitor?.metrics ?? []).map((metric) => [metric.key, metric]))
  const pairing = pair.lagDays === 0 ? 'azonos nap' : `${pair.lagDays} nappal később`
  return (
    <details className="pdt-fold">
      <summary><span className="pdt-fold-icon">⌁</span><span><b>Hogyan számoltuk?</b><small>ablak, források és technikai adatok</small></span></summary>
      <div className="pdt-fold-body">
        <div className="pdt-diag-grid">
          <div><small>Adatablak</small><b>{monitor?.lookbackDays ?? '—'} nap</b></div>
          <div><small>Párosított nap</small><b>{pair.alignedDays}</b></div>
          <div><small>Csoportarány</small><b>{pair.groupZeroDays != null ? `${pair.groupZeroDays} : ${pair.groupOneDays}` : 'nem csoportos'}</b></div>
          <div><small>Utolsó számítás</small><b>{lastRunLabel(monitor?.lastRunAt)}</b></div>
        </div>
        <div className="pdt-source-row">
          <span>{coverage.get(pair.metricAKey)?.sourceHu ?? pair.metricALabel}</span>
          <span>{coverage.get(pair.metricBKey)?.sourceHu ?? pair.metricBLabel}</span>
          <span>{pairing}</span>
        </div>
        <details className="pdt-tech">
          <summary>Technikai számok</summary>
          <div className="pdt-tech-grid">
            <span><b>{formatR(pair.r)}</b>korreláció</span>
            <span><b>{pair.n ?? '—'}</b>közös nap</span>
            <span><b>{formatP(pair.p)}</b>p-érték</span>
          </div>
          {pair.verdict === 'frozen' && <p>A számok a döntésed pillanatában befagytak.</p>}
        </details>
      </div>
    </details>
  )
}

export function PatternDetailPage() {
  const { pairKey = '' } = useParams<{ pairKey: string }>()
  const { detail, notFound, isPending, isError, refetch } = usePatternPairDetail(pairKey)
  const { patterns, isPending: patternsPending } = usePatterns()
  const { decide } = usePatternActions()
  const { monitor } = usePatternMonitor()
  const artifact = patterns.find((pattern) => pattern.pairKey === pairKey) ?? null

  if (isPending || patternsPending) return <DetailFrame><GhostState message="A minta betöltése…" /></DetailFrame>
  if (isError) {
    return <DetailFrame><GhostState message="Nem sikerült betölteni a mintát." ctaLabel="Újra" onCta={refetch} /></DetailFrame>
  }
  if (detail == null && notFound && artifact != null) {
    return (
      <DetailFrame>
        <PatternArtifactDetail pattern={artifact} onDecide={(status) => decide(artifact.id, status)} />
      </DetailFrame>
    )
  }
  if (notFound || !detail) {
    return <DetailFrame><div className="pdt-empty">Nincs ilyen minta.</div></DetailFrame>
  }

  const { pair, pattern, events, days, impact } = detail
  const entries = journalEntries(events, pair)
  const snapshotRange = firstLastSnapshotN(events)
  const validHistory = (pair.verdict === 'live' || pair.verdict === 'frozen') && snapshotRange != null
  const hasImpact = pattern != null || impact.fact != null
    || impact.predictions.length + impact.experiments.length + impact.challenges.length > 0

  return (
    <DetailFrame>
      <PatternDetailHero pair={pair} pattern={pattern}
        onDecide={(status: PatternStatus) => pattern && decide(pattern.id, status)} />

      {pair.metricAValueKind === 'binary' && days.length > 0 && <BinaryComparison days={days} pair={pair} />}

      {validHistory && (
        <section className="pdt-card">
          <div className="pdt-chart-title"><b>Hogyan változott a kapcsolat?</b></div>
          <PatternStrengthChart events={events} />
          <p className="pdt-note">{strengthTrendCaption(strengthSeries(events), snapshotRange.first, snapshotRange.last)}</p>
        </section>
      )}

      <SectionHead title="Az eddigi napok" meta="pont = egy nap" />
      <section className="pdt-card">
        <div className="pdt-chart-title">
          <b>{pair.metricBLabel}</b><span>{pair.metricAValueKind === 'binary' && pair.groupZeroDays != null
            ? `${pair.groupZeroDays} + ${pair.groupOneDays} nap` : `${days.length} nap`}</span>
        </div>
        <PatternEvidenceChart days={days} pair={pair} />
        {days.length < 2
          ? <p className="pdt-note">Még nincs elég nap az összevetéshez — ahogy gyűlnek, itt jelennek meg.</p>
          : <p className="pdt-chart-legend">Minden pont egy nap. <span>Az arany kör a legutóbbi.</span></p>}
        {days.length > 0 && <DaysTable days={days} pair={pair} />}
      </section>

      <StoryTiles pair={pair} />

      <SectionHead title="Háttér" meta="csak ha érdekel" />
      <details className="pdt-fold">
        <summary><span className="pdt-fold-icon">↟</span><span><b>A minta története</b><small>{entries.length} jelentős esemény</small></span></summary>
        <div className="pdt-fold-body">{entries.length > 0
          ? <PatternJournal entries={entries} />
          : <p className="pdt-note">Még nincs jelentős esemény — az új adatok töltik majd.</p>}</div>
      </details>

      {hasImpact && <PatternImpactCard pattern={pattern} impact={impact} />}
      <Diagnostics pair={pair} monitor={monitor} />
    </DetailFrame>
  )
}
