// ============================================================
// Mezo · PatternsPage — the Minták dashboard re-faced to Mozaik 2.0
// (mezo-d20.5.3). Source of truth: mezo-body.html #page-mintak ×1.18
// + the tile-pass recipe (mezo-en iterations §1): hero (i-minta +
// confirmed big number), motor prose card with three bold numbers and
// the colorful 3×2 lifecycle grid (döntésre vár = white + gold ring,
// pulsing — reduced-motion-guarded), the decision card(s) settling to
// a sage acknowledgement, then tile mosaics per lifecycle state:
// confirmed = sage tiles with domain clay icon + HUMAN-word confidence
// chip (never raw r/p), watching = lavender tiles with an animated
// evidence bar, gathering = dashed amber tiles; Adat-egészség = a
// coverage-ring tile strip. All behavioral contracts of the previous
// face are preserved verbatim: bucketize + strong-signal display rule,
// mezo-mqdj stale-pair demotion, honest cold-load/error/degraded/empty
// states, dead-detail-link guards (mezo-tk88.5), domain filter with the
// batch-clearing "Mind" chip, `?pair=` redirect.
// ============================================================
import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { GhostState } from '@/shared/ui/GhostState'
import { usePatterns, usePatternMonitor, usePatternActions } from '@/data/hooks'
import { PatternDecisionCard } from '@/features/insights/components/PatternDecisionCard'
import { PatternDomainMark } from '@/features/insights/components/PatternDomainMark'
import { PatternFilterSheet } from '@/features/insights/components/PatternFilterSheet'
import { lastSeenLabel } from '@/features/insights/logic/metricFormat'
import { DOMAIN_ORDER } from '@/features/insights/logic/domains'
import { bucketize, BUCKET_ORDER, type LifecycleBucket, type LifecycleEntry } from '@/features/insights/logic/lifecycle'
import {
  entryDomain,
  filterSortEntries,
  initialBucket,
  PATTERN_PAGE_SIZE,
  pageEntries,
  type PatternCatalogSort,
} from '@/features/insights/logic/patternCatalog'
import { confidenceMeta, findingSentence } from '@/features/insights/logic/findings'
import { verdictSentence } from '@/features/insights/logic/verdicts'
import type { MetricDomain, PatternMonitorPair, PatternStatus } from '@/data/types'

/** A mini-tile címe: a pár (élő) kérdés-mondata, vagy — pár híján — a minta saját címe. */
function rowTitle(entry: LifecycleEntry): string {
  return entry.pair?.questionHu ?? entry.pattern?.title ?? ''
}

/** A „megfigyelés alatt"/„nincs összefüggés" csempék egysoros leletmondata — nyers r/p SOHA. */
function findingOneLiner(pair: PatternMonitorPair | null): string | null {
  if (!pair || pair.r == null) return null
  const finding = findingSentence(pair)
  if (!finding) return null
  return `${finding.prefix} ${finding.before}${finding.strength}${finding.after}.`
}

/** „ma HH:mm" — az utolsó motor-futás ideje (a job minden éjjel egyszer fut). */
function lastRunLabel(lastRunAt: string | null): string {
  if (!lastRunAt) return '—'
  const time = new Date(lastRunAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
  return `ma ${time}`
}

/** A 3×2 életciklus-rács cellái — prototípus .lcel skinek (a hot ráépül a decide-ra). */
const LCEL_META: Record<LifecycleBucket, { label: string; skin: string; icon: IconName }> = {
  decide: { label: 'döntésre vár', skin: 'c-mute', icon: 'bell' },
  monitoring: { label: 'megfigyelés', skin: 'c-lav', icon: 'eye' },
  confirmed: { label: 'megerősítve', skin: 'c-sage', icon: 'check' },
  gathering: { label: 'még gyűlik', skin: 'c-amber', icon: 'trend-up' },
  noRelationship: { label: 'nincs kapcsolat', skin: 'c-mute', icon: 'minus' },
  rejected: { label: 'elvetve', skin: 'c-mute', icon: 'x' },
}

/** A döntés zsálya-nyugtázása (prototípus decdone) — a mutáció maga a régi `decide`. */
const ACK: Record<PatternStatus, ReactNode> = {
  // Ld. MezoHubPage DECIDED_MSG — a ✓ a ház pipa-idiómája, ezért glifa marad (mezo-hq44).
  confirm: '✓ Beépítettem a tudásba — mostantól számolok vele.',
  monitor: <><Icon name="eye" size={14} /> Rendben, figyeljük tovább — szólok, ha erősödik.</>,
  reject: <><Icon name="x" size={14} /> Elvetve — nem hozom fel újra.</>,
}

/** HUMÁN bizonyosság-chip a csempén (confidenceMeta szavai) — nyers r/p soha. */
function tileChip(entry: LifecycleEntry, tone: 'sage' | 'lav'): ReactNode {
  const pair = entry.pair
  if (pair?.n != null && pair.p != null) {
    const meta = confidenceMeta(pair.n, pair.p)
    const cls = tone === 'lav' ? 'lav' : meta.tone === 'success' ? 'sage' : 'amber'
    return <span className={cn('mnt-chip', cls)}>{meta.chip}</span>
  }
  // stat híján a megosztott honest-null szó (── sosem kitalált szám)
  return tone === 'sage' ? <span className="mnt-chip mute">tanulom</span> : null
}

/** Egy életciklus-csempe — pár-backed csempe linkel a részletoldalra (mezo-tk88.5 guard). */
function PatternTile({ entry, skin, chip, sb, barPct, delayMs }: {
  entry: LifecycleEntry
  skin: 'sage' | 'lav' | 'dashed' | 'mute'
  chip?: ReactNode
  sb: string
  /** 0..1 — az animált bizonyíték-sáv szélessége; null/undefined = nincs sáv */
  barPct?: number | null
  delayMs: number
}) {
  const inner = (
    <>
      <div className="mnt-ptile-top">
        <PatternDomainMark domain={entryDomain(entry)} size={26} showLabel={false} />
        {chip}
      </div>
      <div className="mnt-ttl">{rowTitle(entry)}</div>
      {sb !== '' && <div className="mnt-sb">{sb}</div>}
      {barPct != null && (
        <div className="mnt-gbar" aria-hidden="true">
          <div style={{ '--w': String(barPct), '--d': `${delayMs + 350}ms` } as React.CSSProperties} />
        </div>
      )}
    </>
  )
  const cls = cn('mnt-ptile', skin !== 'mute' && skin, 'rise')
  const style = { '--d': `${delayMs}ms` } as React.CSSProperties
  return (
    <Link to={`/mezo/patterns/${entry.key}`} className={cls} style={style}>
      {inner}
    </Link>
  )
}

/** Szekció-fejléc (prototípus .lsec): eyebrow + jobbra igazított darabszám. */
function Lsec({ title, ink, count, countTestId, delayMs }: {
  title: ReactNode; ink: string; count?: ReactNode; countTestId?: string; delayMs: number
}) {
  return (
    <div className="mnt-lsec rise" style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
      <span className="mz-eyebrow mz-ebic" style={{ color: ink }}>{title}</span>
      {count !== undefined && <span className="mnt-cnt" data-testid={countTestId}>{count}</span>}
    </div>
  )
}

/** A Minták oldal kerete — a `‹ Mezo` fejléc MINDEN ágon (ADR 0032 / mezo-d20.11 hűség-audit:
 *  az oldal korábban semmilyen PageHead-et nem rendelt, így zsákutca volt). A hero a
 *  prototípus #page-mintak page-hero-ja: i-minta + a megerősített összefüggések nagy száma. */
function MintakFrame({ big, children }: { big?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/mezo')} label="‹ Mezo" />
      <div className="mz-page-hero">
        <div className="mz-hero-nm">Minták</div>
        <div className="mz-hero-row">
          <ClayIcon name="i-minta" size={64} />
          {big !== undefined && <span className="mz-bignum">{big}</span>}
        </div>
        <div className="mz-hero-sb">megerősített összefüggés él a tudásban</div>
      </div>
      <PageBody>{children}</PageBody>
    </MozaikPage>
  )
}

/**
 * A Minták dashboard (spec 2026-08-14 · mezo-tk88.4, Mozaik-arc: mezo-d20.5.3) — minden
 * számolás kliens-oldali, nincs új endpoint: a `bucketize` (logic/lifecycle.ts) osztja szét a
 * mintákat + monitor-párokat a hat kosárba; a hero + a motor-kártya + a döntés-kártyák + a
 * csempe-mozaikok + az „Adat-egészség" sáv ebből épül.
 */
export function PatternsPage() {
  const { patterns, degraded: patternsDegraded, isPending: patternsPending } = usePatterns()
  const {
    monitor,
    degraded: monitorDegraded,
    isPending: monitorPending,
    isError: monitorIsError,
    refetch: monitorRefetch,
  } = usePatternMonitor()
  const { decide } = usePatternActions()
  const [params] = useSearchParams()
  const [selectedBucket, setSelectedBucket] = useState<LifecycleBucket | null>(null)
  const [activeDomain, setActiveDomain] = useState<MetricDomain | null>(null)
  const [sort, setSort] = useState<PatternCatalogSort>('progress')
  const [page, setPage] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)
  // Zsálya-nyugtázások (prototípus decdone) — a döntés a régi mutáción megy, a kártya helyén
  // a nyugtázó sor marad, miközben az adat a kosarak közt költözik.
  const [acks, setAcks] = useState<{ key: string; msg: ReactNode }[]>([])

  // A kosarak pure számolása a hook-szabály miatt ÁLL az early returnök előtt (useCountUp).
  const buckets = bucketize(patterns, monitor)
  const counts = Object.fromEntries(BUCKET_ORDER.map((b) => [b, buckets.get(b)!.length])) as Record<
    LifecycleBucket,
    number
  >
  const heroCount = useCountUp(counts.confirmed)

  // A Motor „Minta megnyitása →" / a régi inbox `?pair=` horgonya (mezo-18bx örököse): a
  // részletoldalra irányít — a lista maga már nem highlightol semmit, a részlet a cél.
  const targetPairKey = params.get('pair')
  if (targetPairKey) return <Navigate to={`/mezo/patterns/${targetPairKey}`} replace />

  const isPending = patternsPending || monitorPending

  // Real-mode-only cold-load window (mock mode's isPending is always false, mezo-viqs fix wave
  // precedent, MotorPage.tsx örököse): patterns=[]/monitor=null/degraded=false all read as
  // "genuinely empty" below WITHOUT this guard — a fabricated „0 kérdést … 0 vár a döntésedre"
  // hero would reach a live user during the unresolved window (the mezo-yew/mezo-0xl bug class).
  // Gate on EITHER query pending — the hero needs both to render its real numbers honestly.
  if (isPending) {
    return <MintakFrame><GhostState message="A minták betöltése…" /></MintakFrame>
  }

  // Genuinely failed fetch (500, network) — külön a 404-degraded ÉS a betöltés-alatti ablaktól
  // (mindkettő `monitor === null`-ként olvasna, review fix wave mezo-viqs precedens).
  if (monitorIsError) {
    return (
      <MintakFrame>
        <GhostState message="Nem sikerült betölteni a motor állapotát." ctaLabel="Újra" onCta={monitorRefetch} />
      </MintakFrame>
    )
  }

  if (patternsDegraded && monitorDegraded) {
    return (
      <MintakFrame>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <p className="text-tertiary" style={{ fontSize: 12 }}>
            A minta-motor most nem elérhető — a felismert minták itt jelennek majd meg.
          </p>
        </div>
      </MintakFrame>
    )
  }

  if (patterns.length === 0 && (monitor?.pairs.length ?? 0) === 0) {
    return (
      <MintakFrame>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <p className="text-tertiary" style={{ fontSize: 12 }}>
            Még nincs felismert minta — az éjszakai elemzés magától tölti, ahogy gyűlnek a napok.
          </p>
        </div>
      </MintakFrame>
    )
  }

  const activeBucket = selectedBucket ?? initialBucket(buckets)
  const filteredEntries = filterSortEntries(buckets.get(activeBucket)!, activeDomain, sort)
  const pagedEntries = pageEntries(filteredEntries, page)

  const coverageByKey = new Map((monitor?.metrics ?? []).map((m) => [m.key, m]))
  const bottleneckCoveredDays = (pair: PatternMonitorPair) =>
    pair.bottleneckMetricKey ? (coverageByKey.get(pair.bottleneckMetricKey)?.coveredDays ?? null) : null
  // Adat-egészség: a metrika-lefedettség csempe-sávja — legvékonyabb elöl (régi sorrend-szabály).
  const sortedMetrics = monitor ? [...monitor.metrics].sort((a, b) => a.coveredDays - b.coveredDays) : []

  const questionCount = monitor?.pairs.length ?? 0
  const allEntries = BUCKET_ORDER.flatMap((bucket) => buckets.get(bucket)!)
  const presentDomains = DOMAIN_ORDER.filter((domain) => allEntries.some((entry) => entryDomain(entry) === domain))

  const onDecide = (entry: LifecycleEntry, d: PatternStatus) => {
    decide(entry.pattern!.id, d)
    setAcks((prev) => [...prev, { key: `${entry.key}-${d}`, msg: ACK[d] }])
  }

  return (
    <MintakFrame big={heroCount}>
    <EntranceGroup className="mnt-root">
      {/* ── A motor állapota: próza három félkövér számmal + a 3×2 életciklus-rács ── */}
      <div className="mnt-motor rise" style={{ '--d': '40ms' } as React.CSSProperties}>
        <div className="row" style={{ alignItems: 'center' }}>
          <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>A motor állapota</span>
          <span className="mnt-motor-meta">
            {lastRunLabel(monitor?.lastRunAt ?? null)} · {monitor?.lookbackDays ?? 0} nap
          </span>
        </div>
        <p className="mnt-prose">
          <b>{questionCount} kérdést</b> figyelek a naplóidból. <b>{counts.confirmed} megerősített</b> összefüggés
          dolgozik a társban, <b>{counts.decide} vár a döntésedre</b>.
        </p>
        <div className="mnt-lgrid">
          {BUCKET_ORDER.map((bucket) => {
            const meta = LCEL_META[bucket]
            const hot = bucket === 'decide' && counts.decide > 0
            return (
              <button
                key={bucket}
                type="button"
                aria-pressed={activeBucket === bucket}
                className={cn('mnt-lcel', hot ? 'hot' : meta.skin, activeBucket === bucket && 'is-selected')}
                onClick={() => {
                  setSelectedBucket(bucket)
                  setPage(0)
                }}
              >
                <b>{counts[bucket]}</b>
                <small><Icon name={meta.icon} size={10} />{meta.label}</small>
              </button>
            )
          })}
        </div>
        <div className="mnt-catalog-toolbar">
          <span className="mnt-catalog-filter-value">
            {activeDomain == null ? 'Minden téma' : <PatternDomainMark domain={activeDomain} size={18} />}
          </span>
          <button type="button" className="mnt-filter-trigger" onClick={() => setFilterOpen(true)}>
            <Icon name="settings" size={16} /> Szűrés
          </button>
        </div>
      </div>

      {/* ── Döntés: zsálya-nyugtázások + a hubbal közös döntés-kártya (gold ring) ── */}
      {acks.map((a) => (
        <div key={a.key} className="mnt-decdone rise">
          <ClaySpot name="s-orb-unnepel" size={26} />
          <span className="mz-icin">{a.msg}</span>
        </div>
      ))}
      {activeBucket === 'decide' && filteredEntries.length > 0 && (
        <>
          <Lsec title={<><Icon name="bell" size={12} /> Döntésre vár · {filteredEntries.length}</>} ink="var(--mz-cell-amber-ink)"
            count="csak erős jel" delayMs={80} />
          {pagedEntries.items.map((entry, i) => (
            <div key={entry.key} className="mnt-decwrap rise" style={{ '--d': `${110 + i * 40}ms` } as React.CSSProperties}>
              <PatternDecisionCard
                pattern={entry.pattern!}
                pair={entry.pair}
                onDecide={(d: PatternStatus) => onDecide(entry, d)}
                showExplainer={i === 0}
                showDetailLink
              />
            </div>
          ))}
        </>
      )}

      {/* ── Megerősítve: zsálya-csempék, domén clay ikon + HUMÁN bizonyosság-chip ── */}
      {activeBucket === 'confirmed' && filteredEntries.length > 0 && (
        <>
          <Lsec title={<><Icon name="check" size={12} /> Megerősítve — él a tudásban</>} ink="var(--mz-cell-sage-ink)"
            count={filteredEntries.length} countTestId="mnt-cnt-confirmed" delayMs={140} />
          <div className="mnt-mosaic">
            {pagedEntries.items.map((entry, i) => (
              <PatternTile key={entry.key} entry={entry} skin="sage" chip={tileChip(entry, 'sage')}
                sb={entry.pair?.n != null ? `${entry.pair.n} közös nap` : 'megerősítve'} delayMs={170 + i * 30} />
            ))}
          </div>
          <p className="mnt-foot rise" style={{ '--d': '190ms' } as React.CSSProperties}>
            Ez a {filteredEntries.length} összefüggés benne van a társ fejében minden beszélgetésnél, és ebből
            épülnek az előrejelzések.
          </p>
        </>
      )}

      {/* ── Megfigyelés alatt: levendula-csempék animált bizonyíték-sávval ── */}
      {activeBucket === 'monitoring' && filteredEntries.length > 0 && (
        <>
          <Lsec title={<><Icon name="eye" size={12} /> Megfigyelés alatt</>} ink="var(--mz-cell-lav-ink)" count={filteredEntries.length} delayMs={220} />
          <div className="mnt-mosaic">
            {pagedEntries.items.map((entry, i) => (
              <PatternTile
                key={entry.key}
                entry={entry}
                skin="lav"
                chip={tileChip(entry, 'lav')}
                // mezo-mqdj: ha a pár ma nem él, a sor `mechanism`-je az utolsó élő éjszakáról
                // fagyott be — a kapu saját mondata megy ki helyette. (A user által figyelt sor
                // itt MARAD: a döntése az övé, csak a lelet nem állíthat többet, mint a mai ablak.)
                sb={findingOneLiner(entry.pair)
                  ?? (entry.pair
                    ? verdictSentence(entry.pair, bottleneckCoveredDays(entry.pair))
                    : entry.pattern?.mechanism ?? '')}
                barPct={entry.pair && (monitor?.lookbackDays ?? 0) > 0
                  ? Math.min(1, entry.pair.alignedDays / monitor!.lookbackDays)
                  : null}
                delayMs={250 + i * 30}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Még gyűlik az adat: szaggatott borostyán-csempék ── */}
      {activeBucket === 'gathering' && filteredEntries.length > 0 && (
        <>
          <Lsec title={<><Icon name="trend-up" size={12} /> Még gyűlik az adat</>} ink="var(--mz-cell-amber-ink)" count={filteredEntries.length} delayMs={280} />
          <div className="mnt-mosaic">
            {pagedEntries.items.map((entry, i) => (
              <PatternTile key={entry.key} entry={entry} skin="dashed"
                sb={entry.pair ? verdictSentence(entry.pair, bottleneckCoveredDays(entry.pair)) : ''}
                delayMs={310 + i * 30} />
            ))}
          </div>
          <p className="mnt-foot rise" style={{ '--d': '330ms' } as React.CSSProperties}>
            Ezek nem hibák — csak nincs elég közös nap. Amit logolsz, az hozza őket életre.
          </p>
        </>
      )}

      {/* ── Megnéztük — nincs összefüggés: halk, mosott csempék ── */}
      {activeBucket === 'noRelationship' && filteredEntries.length > 0 && (
        <>
          <Lsec title={<><Icon name="minus" size={12} /> Megnéztük — nincs összefüggés</>} ink="var(--mz-ink-mut)"
            count={filteredEntries.length} delayMs={360} />
          <div className="mnt-mosaic">
            {pagedEntries.items.map((entry, i) => (
              <PatternTile key={entry.key} entry={entry} skin="mute"
                sb={findingOneLiner(entry.pair) ?? entry.pattern?.mechanism ?? ''} delayMs={390 + i * 30} />
            ))}
          </div>
          <p className="mnt-foot rise" style={{ '--d': '410ms' } as React.CSSProperties}>
            Ez is eredmény: megnéztük, és nincs kapcsolat. Nem kér döntést — ha később megerősödne, feljebb lép.
          </p>
        </>
      )}

      {/* ── Elvetve ── */}
      {activeBucket === 'rejected' && filteredEntries.length > 0 && (
        <>
          <Lsec title={<><Icon name="x" size={12} /> Elvetve</>} ink="var(--mz-ink-mut)" count={filteredEntries.length} delayMs={440} />
          <div className="mnt-mosaic">
            {pagedEntries.items.map((entry, i) => (
              <PatternTile key={entry.key} entry={entry} skin="mute"
                sb={entry.pair ? verdictSentence(entry.pair, bottleneckCoveredDays(entry.pair)) : 'elvetve'}
                delayMs={470 + i * 30} />
            ))}
          </div>
        </>
      )}

      {filteredEntries.length === 0 && (
        <div className="mnt-catalog-empty rise">
          <ClayIcon name="i-minta" size={34} />
          <p>Ebben az állapotban ezzel a szűréssel most nincs minta.</p>
        </div>
      )}

      {pagedEntries.pageCount > 1 && (
        <nav className="mnt-pager rise" aria-label="Minták lapozása">
          <button type="button" aria-label="Előző oldal" disabled={pagedEntries.page === 0}
            onClick={() => setPage(pagedEntries.page - 1)}>
            <Icon name="chevron-left" size={16} />
          </button>
          <span>
            {pagedEntries.page * PATTERN_PAGE_SIZE + 1}–{Math.min((pagedEntries.page + 1) * PATTERN_PAGE_SIZE, filteredEntries.length)} / {filteredEntries.length}
          </span>
          <button type="button" aria-label="Következő oldal"
            disabled={pagedEntries.page === pagedEntries.pageCount - 1}
            onClick={() => setPage(pagedEntries.page + 1)}>
            <Icon name="chevron-right" size={16} />
          </button>
        </nav>
      )}

      {/* ── Adat-egészség: lefedettség-gyűrűs csempe-sáv, legvékonyabb elöl ── */}
      {monitor && sortedMetrics.length > 0 && (
        <>
          <Lsec title="Adat-egészség" ink="var(--mz-ink-mut)" delayMs={500} />
          <div className="mnt-covstrip rise" style={{ '--d': '520ms' } as React.CSSProperties}>
            {sortedMetrics.map((metric) => {
              const ratio = metric.windowDays === 0 ? 0 : metric.coveredDays / metric.windowDays
              const ringColor = ratio >= 0.5 ? 'var(--success-base)' : ratio > 0 ? 'var(--warning-base)' : 'var(--text-disabled)'
              const last = lastSeenLabel(metric.lastDayWithData)
              return (
                <div key={metric.key} className="mnt-covtile">
                  <span className="mnt-rr" aria-hidden="true"
                    style={{ '--c': ringColor, '--v': Math.round(ratio * 100) } as React.CSSProperties} />
                  <b data-testid="coverage-label">{metric.label}</b>
                  <small>{metric.coveredDays}/{metric.windowDays}{last ? ` · ${last}` : ''}</small>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Memória ↔ Minták: a visszairány (mezo-d20.11). A Memória degraded-ága eddig is
             ide mutatott, innen viszont nem vezetett út oda — a motor bemenete (L0→L3) és a
             kimenete (a minták) egymás szomszédjai. ── */}
      <p className="mnt-foot rise" style={{ '--d': '540ms' } as React.CSSProperties}>
        <Link to="/mezo/memoria" style={{ color: 'var(--lav-deep)', fontWeight: 600, textDecoration: 'none' }}>
          A motor bemenete: memória-rétegek →
        </Link>
      </p>

      {filterOpen && (
        <PatternFilterSheet
          domain={activeDomain}
          sort={sort}
          availableDomains={presentDomains}
          onApply={(next) => {
            setActiveDomain(next.domain)
            setSort(next.sort)
            setPage(0)
          }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </EntranceGroup>
    </MintakFrame>
  )
}
