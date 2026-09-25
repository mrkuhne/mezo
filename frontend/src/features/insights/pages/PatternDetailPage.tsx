// ============================================================
// Mezo · PatternDetailPage — a minta „Miből látszik?" mélyoldala (mezo-tk88.5, laborfüzet
// mezo-eq85.6; üvegben: Üvegesítés U8a, mezo-me75u.13 — prototypes/uveg-uzenofal.html #minta/*).
// Rangsor (bible §3.4): EGY üveg-hero (laborfüzet: HypothesisStateCard, katalógus:
// PatternDetailHero, mentett felismerés: PatternArtifactDetail), minden más lapos panel,
// az üres/hiba/betöltés szaggatott. A vissza-gomb oda visz, ahonnan jöttél (`useBackTo`).
// ============================================================
import type { ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useBackTo } from '@/shared/hooks/useBackNav'
import { Icon3D } from '@/shared/ui/clay'
import { DetailFrame, DetailState, SectionHead } from '@/features/insights/components/DetailHero'
import { usePatternActions, usePatternMonitor, usePatternPairDetail, usePatterns } from '@/data/hooks'
import { PatternArtifactDetail } from '@/features/insights/components/PatternArtifactDetail'
import { PatternDetailHero } from '@/features/insights/components/PatternDetailHero'
import { EvidenceLog } from '@/features/insights/components/EvidenceLog'
import { HypothesisStateCard } from '@/features/insights/components/HypothesisStateCard'
import { TestPlanTiles } from '@/features/insights/components/TestPlanTiles'
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

function PatternFrame({ children }: { children: ReactNode }) {
  const [search] = useSearchParams()
  const back = useBackTo(`/mezo/patterns${search.size ? `?${search}` : ''}`, 'Minták')
  return <DetailFrame back={back} eyebrow="Minta részletei">{children}</DetailFrame>
}

function GroupTile({ label, count, summary, range, deficient, tone }: {
  label: string; count: number; summary: string; range?: string; deficient?: string; tone: 'sky' | 'lav'
}) {
  return (
    <article className={`pdt-compare-tile pdt-tone-${tone} rise ${deficient ? 'pdt-compare-deficient' : ''}`}>
      <div className="pdt-tile-label">{label}</div>
      <div className="pdt-day-count">{count}<small> nap</small></div>
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
        <GroupTile tone="sky" label={labels.zero.axis} count={groups.zero.count}
          summary={value(groups.zero.median ?? groups.zero.values[0] ?? null)}
          range={groups.zero.count > 1 ? range(groups.zero.min, groups.zero.max) : undefined}
          deficient={groups.zero.count < required ? `+${required - groups.zero.count} nap kell` : undefined} />
        <GroupTile tone="lav" label={labels.one.axis} count={groups.one.count}
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
        <tbody>{days.map((day, index) => <tr key={day.date} className={index === days.length - 1 ? 'is-last' : undefined}>
          <td>{day.date}</td><td>{formatMetricValue(pair.metricAKey, day.a)}</td>
          <td>{formatMetricValue(pair.metricBKey, day.b)}</td>
        </tr>)}</tbody>
      </table>
    </details>
  )
}

/** „Az eddigi napok" kártya — a szórásdiagram és az őszinte üres/legenda sora. A katalógus-
 *  és a laborfüzet-elrendezés UGYANEZT a kártyát mutatja, hogy a két olvasat sose különbözzön. */
function DaysCard({ days, pair }: { days: AlignedDay[]; pair: PatternMonitorPair }) {
  const binary = pair.metricAValueKind === 'binary' && pair.groupZeroDays != null
  const labels = binary ? binaryGroupLabels(pair.metricAKey) : null
  return (
    <section className="pdt-flat pdt-days rise">
      <div className="pdt-chart-title">
        <span>
          <b>{pair.metricBLabel}</b>
          <span className="pdt-chart-sub">{binary && labels
            ? <><span>{pair.groupZeroDays} + {pair.groupOneDays} nap</span> · {labels.zero.axis} + {labels.one.axis}</>
            : 'minden pont egy nap'}</span>
        </span>
        <strong>{days.length}<i> nap</i></strong>
      </div>
      <PatternEvidenceChart days={days} pair={pair} />
      {days.length < 2
        ? <p className="pdt-chart-empty uv-empty">Még nincs elég nap az összevetéshez — ahogy gyűlnek, itt jelennek meg.</p>
        : <p className="pdt-chart-legend"><i aria-hidden="true" />Minden pont egy nap. <span>Az arany kör a legutóbbi.</span></p>}
      {days.length > 0 && <DaysTable days={days} pair={pair} />}
    </section>
  )
}

function StoryTiles({ pair }: { pair: PatternMonitorPair }) {
  const collecting = pair.verdict === 'imbalanced_groups'
  return (
    <>
      <SectionHead title="Mit vigyél magaddal?" />
      <section className="pdt-story-grid">
        <article className="pdt-flat pdt-story-tile pdt-story-meaning rise">
          <Icon3D name="t-info" size={28} /><h3>Mit jelent ez?</h3>
          <p>{collecting
            ? <>Az egyetlen hétvégi nap <b>korábbinak látszik</b>, de ebből még nem következik hétvégi szokás.</>
            : <>A grafikon a most összevethető napokat mutatja. Az irányt mindig a fenti lelet mondja ki.</>}</p>
        </article>
        <article className="pdt-flat pdt-story-tile pdt-story-next rise">
          <Icon3D name="t-repeat" size={28} /><h3>Mi történik ezután?</h3>
          <p>{collecting
            ? <><b>{verdictSentence(pair, null)}</b> Addig csak gyűjtjük az étkezési naplódat.</>
            : <>Az új közös napokkal a motor újraszámolja a kapcsolatot és jelzi, ha érdemben változik.</>}</p>
        </article>
      </section>
    </>
  )
}

/** A háttér-fold. Az ablak és az „utolsó számítás" NEM a monitorból jön automatikusan: a
 *  laborfüzet sorát egy MÁSIK futás (az éjszakai reflexió) számolja, a saját ablakával — ezért
 *  mindkettőt a hívó adja meg, hogy a fold sose a másik motor adatát mutassa (mezo-eq85.6 review). */
function Diagnostics({ pair, monitor, windowDays, lastComputedAt }: {
  pair: PatternMonitorPair
  monitor: ReturnType<typeof usePatternMonitor>['monitor']
  windowDays: number | null | undefined
  lastComputedAt: string | null | undefined
}) {
  const coverage = new Map((monitor?.metrics ?? []).map((metric) => [metric.key, metric]))
  const pairing = pair.lagDays === 0 ? 'azonos nap' : `${pair.lagDays} nappal később`
  return (
    <details className="pdt-fold rise">
      <summary><Icon3D name="t-trend" size={30} /><span><b>Hogyan számoltuk?</b><small>ablak, források és technikai adatok</small></span></summary>
      <div className="pdt-fold-body">
        <div className="pdt-diag-grid">
          <div><small>Adatablak</small><b>{windowDays ?? '—'} nap</b></div>
          <div><small>{pair.verdict === 'frozen' ? 'Párosított nap a döntésedkor' : 'Párosított nap'}</small><b>{pair.alignedDays}</b></div>
          <div><small>Csoportarány</small><b>{pair.groupZeroDays != null ? `${pair.groupZeroDays} : ${pair.groupOneDays}` : 'nem csoportos'}</b></div>
          <div><small>Utolsó számítás</small><b>{lastRunLabel(lastComputedAt)}</b></div>
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
            <span><b>{pair.n ?? '—'}</b>{pair.verdict === 'frozen' ? 'közös nap a döntésedkor' : 'közös nap'}</span>
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

  if (isPending || patternsPending) {
    return <PatternFrame><DetailState art="t-clock" kind="loading" role="status">A minta betöltése…</DetailState></PatternFrame>
  }
  if (isError) {
    return (
      <PatternFrame>
        <DetailState art="t-info" role="alert">
          <span>Nem sikerült betölteni a mintát.</span>
          <button type="button" className="pdt-retry" onClick={refetch}>Újra</button>
        </DetailState>
      </PatternFrame>
    )
  }
  if (detail == null && notFound && artifact != null) {
    return (
      <PatternFrame>
        <PatternArtifactDetail pattern={artifact} onDecide={(status) => decide(artifact.id, status)} />
      </PatternFrame>
    )
  }
  if (notFound || !detail) {
    return (
      <PatternFrame>
        <DetailState art="t-info"><b>Nincs ilyen minta.</b> A link egy már nem létező mintára mutat.</DetailState>
      </PatternFrame>
    )
  }

  const { pair, pattern, events, days, impact } = detail

  // Laborfüzet (Reflexió S6, mezo-eq85.6): egy előre rögzített teszt-tervvel bíró sor SAJÁT
  // olvasatot kap — állapot-hero, a terv, a napok, a bizonyíték-napló, és a háttér. A terv
  // nélküli (katalógus-) sorok elrendezése változatlan.
  if (pattern?.testPlan) {
    return (
      <PatternFrame>
        <HypothesisStateCard pattern={pattern} pair={pair} dayCount={days.length} plan={pattern.testPlan}
          onDecide={(status: PatternStatus) => decide(pattern.id, status)} />

        <SectionHead title="A teszt-terv" meta="előre rögzítve" />
        <TestPlanTiles plan={pattern.testPlan} pair={pair} />

        <SectionHead title="Az eddigi napok" meta="pont = egy nap" />
        <DaysCard days={days} pair={pair} />

        <SectionHead title="Bizonyíték-napló" meta="minden, ami történt" />
        <EvidenceLog events={events} />

        <SectionHead title="Háttér" meta="csak ha érdekel" />
        {/* a reflexiós sor a SAJÁT tervének ablakát és a saját éjszakai futását mutatja */}
        <Diagnostics pair={pair} monitor={monitor}
          windowDays={pattern.testPlan.windowDays} lastComputedAt={pattern.lastDetectedAt} />
      </PatternFrame>
    )
  }

  const entries = journalEntries(events, pair)
  const snapshotRange = firstLastSnapshotN(events)
  const validHistory = (pair.verdict === 'live' || pair.verdict === 'frozen') && snapshotRange != null
  const hasImpact = pattern != null || impact.fact != null
    || impact.predictions.length + impact.experiments.length + impact.challenges.length > 0

  return (
    <PatternFrame>
      <PatternDetailHero pair={pair} pattern={pattern} dayCount={days.length}
        onDecide={(status: PatternStatus) => pattern && decide(pattern.id, status)} />

      {pair.metricAValueKind === 'binary' && days.length > 0 && <BinaryComparison days={days} pair={pair} />}

      {validHistory && (
        <>
          <SectionHead title="Hogyan változott a kapcsolat?" />
          <section className="pdt-flat pdt-strength rise">
            <PatternStrengthChart events={events} />
            <p className="pdt-note">{strengthTrendCaption(strengthSeries(events), snapshotRange.first, snapshotRange.last)}</p>
          </section>
        </>
      )}

      <SectionHead title="Az eddigi napok" meta="pont = egy nap" />
      <DaysCard days={days} pair={pair} />

      <StoryTiles pair={pair} />

      <SectionHead title="Háttér" meta="csak ha érdekel" />
      <details className="pdt-fold rise">
        <summary><Icon3D name="t-history" size={30} /><span><b>A minta története</b><small>{entries.length} jelentős esemény</small></span></summary>
        <div className="pdt-fold-body">{entries.length > 0
          ? <PatternJournal entries={entries} />
          : <p className="pdt-note">Még nincs jelentős esemény — az új adatok töltik majd.</p>}</div>
      </details>

      {hasImpact && <PatternImpactCard pattern={pattern} impact={impact} />}
      <Diagnostics pair={pair} monitor={monitor}
        windowDays={monitor?.lookbackDays} lastComputedAt={monitor?.lastRunAt} />
    </PatternFrame>
  )
}
