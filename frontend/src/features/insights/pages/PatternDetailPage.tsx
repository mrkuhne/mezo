// ============================================================
// Mezo · PatternDetailPage — a minta „Miből látszik?" mélyoldala, újramesélve (mezo-rstt7,
// prototypes/src/uveg-minta-body.html). EGY olvasat (`readPattern`), EGY elrendezés minden
// részletre: fent a válasz (keret nélküli halo-hős), alatta „Mit mutat az adat" (az oldal
// egyetlen üvege, a kétzónás grafikon), „A szabály" (előre rögzítve), „Ami eddig történt",
// a hatás-kártya és a „Számok, ha érdekel" fold. Az állapot-pirula a vissza-sor jobb szélén ül.
// A terv/pár nélküli mentett felismerés a `PatternArtifactDetail`. A vissza-gomb oda visz,
// ahonnan jöttél (`useBackTo`).
// ============================================================
import type { ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useBackTo } from '@/shared/hooks/useBackNav'
import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import {
  DetailFrame, DetailState, SectionHead, toneClass, type DetailTone,
} from '@/features/insights/components/DetailHero'
import { usePatternActions, usePatternMonitor, usePatternPairDetail, usePatterns } from '@/data/hooks'
import { PatternArtifactDetail, artifactLook } from '@/features/insights/components/PatternArtifactDetail'
import { PatternAnswerHero } from '@/features/insights/components/PatternAnswerHero'
import { PatternZoneChart } from '@/features/insights/components/PatternZoneChart'
import { PatternRuleCard } from '@/features/insights/components/PatternRuleCard'
import { EvidenceLog, evidenceLogRows } from '@/features/insights/components/EvidenceLog'
import { PatternImpactCard } from '@/features/insights/components/PatternImpactCard'
import { PatternJournal } from '@/features/insights/components/PatternJournal'
import { journalEntries } from '@/features/insights/logic/patternHistory'
import { answerLook, readPattern } from '@/features/insights/logic/patternReading'
import { formatP, formatR } from '@/features/insights/logic/metricFormat'
import type { PatternEvent, PatternMonitorPair, PatternRowStatus, PatternTestPlan } from '@/data/types'

/** Az állapot-pirula szava — `none` = katalógus-pár, amihez még nincs tárolt sor. */
const STATUS_WORD: Record<PatternRowStatus | 'none', string> = {
  proposed: 'ÚJ',
  monitoring: 'FIGYELJÜK',
  confirmed: 'BEÉPÜLT',
  rejected: 'ELVETVE',
  refuted: 'ELENGEDVE',
  dormant: 'PIHEN',
  none: 'FIGYELT PÁR',
}

function StatusPill({ status, tone }: { status: PatternRowStatus | 'none'; tone: DetailTone }) {
  return <span className={cn('pmx-status', toneClass(tone))}>{STATUS_WORD[status]}</span>
}

function lastRunLabel(lastRunAt: string | null | undefined): string {
  if (!lastRunAt) return '—'
  return new Date(lastRunAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
}

function PatternFrame({ pill, children }: { pill?: ReactNode; children: ReactNode }) {
  const [search] = useSearchParams()
  const back = useBackTo(`/mezo/patterns${search.size ? `?${search}` : ''}`, 'Minták')
  return pill
    ? <DetailFrame back={back} aside={pill}>{children}</DetailFrame>
    : <DetailFrame back={back} eyebrow="Minta részletei">{children}</DetailFrame>
}

/** „Ami eddig történt" — a terv-vezérelt (reflexiós) sor a bizonyíték-naplót mutatja, minden
 *  más a katalógus bevált naplóját; ha egyikben sincs sor, az őszinte üres mondat. */
function HistoryFold({ events, pair, plan }: {
  events: PatternEvent[]
  pair: PatternMonitorPair
  plan: PatternTestPlan | null
}) {
  const logCount = plan ? evidenceLogRows(events).length : 0
  const entries = logCount > 0 ? [] : journalEntries(events, pair)
  const count = logCount || entries.length
  return (
    <details className="pdt-fold rise">
      <summary><Icon3D name="t-history" size={30} /><span><b>Ami eddig történt</b><small>{count > 0 ? `${count} esemény` : 'még semmi'}</small></span></summary>
      <div className="pdt-fold-body">
        {logCount > 0
          ? <EvidenceLog events={events} />
          : entries.length > 0
            ? <PatternJournal entries={entries} />
            : <p className="pdt-note">Még nincs jelentős esemény — az új adatok töltik majd.</p>}
      </div>
    </details>
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
      <summary><Icon3D name="t-trend" size={30} /><span><b>Számok, ha érdekel</b><small>ablak, források és technikai adatok</small></span></summary>
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
  const { monitor, isPending: monitorPending } = usePatternMonitor()
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
      <PatternFrame pill={<StatusPill status={artifact.status ?? 'proposed'} tone={artifactLook(artifact).tone} />}>
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
  // terv és kapu-szám nélkül a napminimumot csak a monitor tudja: amíg az úton van, várunk — egy
  // tippelt 8-cal számolt olvasat a monitor megérkeztekor átfordulhatna a képernyőn
  if (pattern?.testPlan == null && pair.missingDays == null && monitorPending) {
    return <PatternFrame><DetailState art="t-clock" kind="loading" role="status">A minta betöltése…</DetailState></PatternFrame>
  }
  const reading = readPattern({ pair, pattern, days, events }, monitor?.minN ?? null)
  const look = answerLook(reading, pattern?.status ?? null)
  const plan = pattern?.testPlan ?? null
  // átlagot csak akkor, ha az olvasat már mond valamit: gyűjtés (csoport-hiány is), álló adat és
  // puszta kérdés mellett egy 1-2 napos „átlag" többet állítana, mint amit a napok elbírnak
  const showAverages = reading.dayCount >= reading.minN && !reading.groupsShort
    && !['gyulik', 'allo', 'kerdes'].includes(reading.state)
  const averagesNote = reading.groupsShort && reading.groups
    ? `Az átlagot akkor mutatom, ha mindkét fajta napból megvan a ${reading.groups.perGroup}.`
    : reading.dayCount < reading.minN ? `Az átlagot ${reading.minN} napnál mutatom.` : null
  const hasImpact = pattern != null || impact.fact != null
    || impact.predictions.length + impact.experiments.length + impact.challenges.length > 0

  return (
    <PatternFrame pill={<StatusPill status={pattern?.status ?? 'none'} tone={look.tone} />}>
      <PatternAnswerHero pair={pair} pattern={pattern} reading={reading} days={days} events={events}
        onDecide={(verb) => { if (pattern) decide(pattern.id, verb) }} />

      <SectionHead title="Mit mutat az adat" meta={days.length ? `${days.length} nap` : undefined} />
      {days.length >= 2
        ? <PatternZoneChart days={days} pair={pair} tone={look.tone}
            showAverages={showAverages} />
        : (
          <p className={cn('pmx-empty uv-empty rise', toneClass(look.tone))}>
            <Icon3D name="t-calendar" size={40} />
            {reading.dayCount === 0 && 'Még egy közös nap sincs. '}
            Ahogy a napok összegyűlnek, itt jelennek meg — minden nap egy pötty.
          </p>
        )}
      {days.length >= 2 && averagesNote && <p className="pmx-cnote rise">{averagesNote}</p>}

      <SectionHead title="A szabály" meta="előre rögzítve" />
      <PatternRuleCard pair={pair} plan={plan} reading={reading}
        windowDays={plan?.windowDays ?? monitor?.lookbackDays ?? null} />

      <HistoryFold events={events} pair={pair} plan={plan} />

      {hasImpact && <PatternImpactCard pattern={pattern} impact={impact} />}
      {/* a reflexiós sor a SAJÁT tervének ablakát és a saját éjszakai futását mutatja */}
      {plan && pattern
        ? <Diagnostics pair={pair} monitor={monitor} windowDays={plan.windowDays} lastComputedAt={pattern.lastDetectedAt} />
        : <Diagnostics pair={pair} monitor={monitor} windowDays={monitor?.lookbackDays} lastComputedAt={monitor?.lastRunAt} />}
    </PatternFrame>
  )
}
