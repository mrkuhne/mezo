// ============================================================
// Mezo · PatternsPage — the Minták dashboard in the Üveg world (mezo-me75u.9).
// Source of truth: docs/design_2.0/prototypes/uveg-mezo-teljes.html #mintak
// (src/uveg-mezo-teljes-u9.js `mintak`/`bucket`/`tile`), built on the csapatfal
// `tf-*` kit (boop-world.css) + the U1 `.glass`/`uv-*` material. Ranking: the
// motor card is the amber glass case (big light numeral hero above it), decide
// cards are amber glass cases, confirmed tiles sage glass, monitoring tiles lav
// glass with the evidence bar, gathering dashed, noRelationship/rejected flat;
// Adat-egészség = a scrolling strip of small coverage rings. Line icons are the
// Titanium 3D sprite (bible §4). Behavioural contracts of the previous face are
// preserved verbatim: bucketize + strong-signal display rule, mezo-mqdj stale-pair
// demotion, honest cold-load/error/degraded/empty states, dead-detail-link guards
// (mezo-tk88.5), domain filter + sort + page in the URL, `?pair=` redirect.
// ============================================================
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { GhostState } from '@/shared/ui/GhostState'
import { usePatterns, usePatternMonitor, usePatternActions } from '@/data/hooks'
import { PatternDecisionCard } from '@/features/insights/components/PatternDecisionCard'
import { PatternDomainMark, PATTERN_DOMAIN_MARK_ART } from '@/features/insights/components/PatternDomainMark'
import { PatternFilterSheet } from '@/features/insights/components/PatternFilterSheet'
import { lastSeenLabel } from '@/features/insights/logic/metricFormat'
import { DOMAIN_ORDER } from '@/features/insights/logic/domains'
import { bucketize, BUCKET_ORDER, engineStatusCopy, type LifecycleBucket, type LifecycleEntry } from '@/features/insights/logic/lifecycle'
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
import type { PatternMonitorPair, PatternStatus } from '@/data/types'
import { ALL_FEATURES_ROUTE } from '@/features/insights/logic/boopNavigation'
import '@/features/insights/boop-world.css'

const RING_R = 26
const RING_C = 2 * Math.PI * RING_R

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

type Tone = 'coral' | 'lav' | 'sage' | 'gold' | 'slate'

/** A 3×2 életciklus-rács cellái (prototípus `BK`): lapos cellák, a kiválasztott a saját
 *  akcentusában világít; a „döntésre vár" korall, ha van mire várni (különben halk). */
const LCEL_META: Record<LifecycleBucket, { label: string; tone: Tone; art: Icon3DName }> = {
  decide: { label: 'döntésre vár', tone: 'slate', art: 't-bell' },
  monitoring: { label: 'megfigyelés', tone: 'lav', art: 't-eye' },
  confirmed: { label: 'megerősítve', tone: 'sage', art: 't-tick' },
  gathering: { label: 'még gyűlik', tone: 'gold', art: 't-up' },
  noRelationship: { label: 'nincs kapcsolat', tone: 'slate', art: 't-hold' },
  rejected: { label: 'elvetve', tone: 'slate', art: 't-skip' },
}

/** A döntés nyugtázása (prototípus `after` pirula) — a mutáció maga a régi `decide`. */
const ACK: Record<PatternStatus, { art: Icon3DName; text: string }> = {
  confirm: { art: 't-tick', text: 'Beépítettem a tudásba — mostantól számolok vele.' },
  monitor: { art: 't-eye', text: 'Rendben, figyeljük tovább — szólok, ha erősödik.' },
  reject: { art: 't-skip', text: 'Elvetve — nem hozom fel újra.' },
}

/** HUMÁN bizonyosság-chip a csempén (confidenceMeta szavai) — nyers r/p soha. */
function tileChip(entry: LifecycleEntry, tone: 'sage' | 'lav'): ReactNode {
  const pair = entry.pair
  if (pair?.n != null && pair.p != null) {
    const meta = confidenceMeta(pair.n, pair.p)
    const cls = tone === 'lav' ? 'is-lav' : meta.tone === 'success' ? 'is-sage' : 'is-gold'
    return <span className={cn('m9m-chip', cls)}>{meta.chip}</span>
  }
  // stat híján a megosztott honest-null szó (── sosem kitalált szám)
  return tone === 'sage' ? <span className="m9m-chip is-mute">tanulom</span> : null
}

const TILE_SKIN: Record<'sage' | 'lav' | 'dashed' | 'mute', string> = {
  sage: 'glass tf-c-sage m9m-tile is-sage',
  lav: 'glass tf-c-lav m9m-tile is-lav',
  dashed: 'uv-empty tf-c-gold m9m-tile is-dashed',
  mute: 'm9m-tile is-mute',
}

/** Egy életciklus-csempe (prototípus `tile` / `.qt`) — linkel a részletoldalra (mezo-tk88.5 guard). */
function PatternTile({ entry, skin, chip, sb, barPct, delayMs, search }: {
  entry: LifecycleEntry
  skin: 'sage' | 'lav' | 'dashed' | 'mute'
  chip?: ReactNode
  sb: string
  /** 0..1 — a bizonyíték-sáv szélessége; null/undefined = nincs sáv */
  barPct?: number | null
  delayMs: number
  search: string
}) {
  return (
    <Link to={`/mezo/patterns/${entry.key}?${search}`} className={cn(TILE_SKIN[skin], 'rise')}
      style={{ '--d': `${delayMs}ms` } as CSSProperties}>
      <span className="m9m-tile-top">
        <Icon3D name={PATTERN_DOMAIN_MARK_ART[entryDomain(entry)]} size={30} />
        {chip}
      </span>
      <span className="m9m-ttl">{rowTitle(entry)}</span>
      {sb !== '' && <span className="m9m-sb">{sb}</span>}
      {barPct != null && (
        <span className="uv-bar" aria-hidden="true">
          <b style={{ '--w': `${Math.round(barPct * 100)}%` } as CSSProperties} />
        </span>
      )}
    </Link>
  )
}

/** Szekció-fejléc (prototípus `sec`): cím (3D jellel, glifa nélkül) + jobbra a halk tipp/darabszám. */
function Lsec({ title, art, count, countTestId, delayMs }: {
  title: ReactNode; art?: Icon3DName; count?: ReactNode; countTestId?: string; delayMs: number
}) {
  return (
    <div className="tf-sec m9m-sec rise" style={{ '--d': `${delayMs}ms` } as CSSProperties}>
      <h2>{art && <Icon3D name={art} size={22} />}{title}</h2>
      {count !== undefined && <span className="tf-hint" data-testid={countTestId}>{count}</span>}
    </div>
  )
}

/** A Minták oldal kerete — a vissza-út MINDEN ágon (ADR 0032 / mezo-d20.11): a `tf-dhead`
 *  (‹ → Összes funkció) + a hero: a megerősített összefüggések nagy, könnyű száma. */
function MintakFrame({ big, children }: { big?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="tf-page m9m-root">
      <div className="tf-dhead">
        <button type="button" className="glass tf-back" aria-label="Vissza"
          onClick={() => navigate(ALL_FEATURES_ROUTE)}>‹</button>
        <span className="tf-dtitle"><small>Mezo · a motor</small><strong>Minták</strong></span>
      </div>
      <div className="m9m-big">
        {big !== undefined && <b>{big}</b>}
        <small>megerősített összefüggés él a tudásban</small>
      </div>
      {children}
    </div>
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
  const [params, setParams] = useSearchParams()
  const selectedBucket = BUCKET_ORDER.find((bucket) => bucket === params.get('bucket')) ?? null
  const activeDomain = DOMAIN_ORDER.find((domain) => domain === params.get('domain')) ?? null
  const sort: PatternCatalogSort = params.get('sort') === 'domain' ? 'domain' : 'progress'
  const requestedPage = Number(params.get('page') ?? 0)
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0
  const updateCatalog = (values: Record<string, string | null>) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(values)) {
        if (value == null) next.delete(key)
        else next.set(key, value)
      }
      return next
    }, { replace: true })
  }
  const [filterOpen, setFilterOpen] = useState(false)
  // Zsálya-nyugtázások (prototípus decdone) — a döntés a régi mutáción megy, a kártya helyén
  // a nyugtázó sor marad, miközben az adat a kosarak közt költözik.
  const [acks, setAcks] = useState<{ key: string; d: PatternStatus }[]>([])

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
  if (targetPairKey) {
    const remaining = new URLSearchParams(params)
    remaining.delete('pair')
    return <Navigate to={`/mezo/patterns/${targetPairKey}${remaining.size ? `?${remaining}` : ''}`} replace />
  }

  const isPending = patternsPending || monitorPending

  // Real-mode-only cold-load window (mock mode's isPending is always false, mezo-viqs fix wave
  // precedent, MotorPage.tsx örököse): patterns=[]/monitor=null/degraded=false all read as
  // "genuinely empty" below WITHOUT this guard — a fabricated „0 kérdést … 0 vár a döntésedre"
  // hero would reach a live user during the unresolved window (the mezo-yew/mezo-0xl bug class).
  // Gate on EITHER query pending — the hero needs both to render its real numbers honestly.
  if (isPending) {
    return <MintakFrame><div className="m9m-pad"><GhostState message="A minták betöltése…" /></div></MintakFrame>
  }

  // Genuinely failed fetch (500, network) — külön a 404-degraded ÉS a betöltés-alatti ablaktól
  // (mindkettő `monitor === null`-ként olvasna, review fix wave mezo-viqs precedens).
  if (monitorIsError) {
    return (
      <MintakFrame>
        <div className="m9m-pad">
          <GhostState message="Nem sikerült betölteni a motor állapotát." ctaLabel="Újra" onCta={monitorRefetch} />
        </div>
      </MintakFrame>
    )
  }

  if (patternsDegraded && monitorDegraded) {
    return (
      <MintakFrame>
        <div className="tf-dash m9m-state">
          <Icon3D name="t-info" size={30} />
          <span>A minta-motor most nem elérhető — a felismert minták itt jelennek majd meg.</span>
        </div>
      </MintakFrame>
    )
  }

  if (patterns.length === 0 && (monitor?.pairs.length ?? 0) === 0) {
    return (
      <MintakFrame>
        <div className="tf-dash m9m-state">
          <Icon3D name="t-sprout" size={30} />
          <span>Még nincs felismert minta — az éjszakai elemzés magától tölti, ahogy gyűlnek a napok.</span>
        </div>
      </MintakFrame>
    )
  }

  const activeBucket = selectedBucket ?? initialBucket(buckets)
  const filteredEntries = filterSortEntries(buckets.get(activeBucket)!, activeDomain, sort)
  const pagedEntries = pageEntries(filteredEntries, page)
  const detailParams = new URLSearchParams(params)
  detailParams.set('bucket', activeBucket)
  const detailSearch = detailParams.toString()

  const coverageByKey = new Map((monitor?.metrics ?? []).map((m) => [m.key, m]))
  const bottleneckCoveredDays = (pair: PatternMonitorPair) =>
    pair.bottleneckMetricKey ? (coverageByKey.get(pair.bottleneckMetricKey)?.coveredDays ?? null) : null
  // Adat-egészség: a metrika-lefedettség gyűrű-sávja — legvékonyabb elöl (régi sorrend-szabály).
  const sortedMetrics = monitor ? [...monitor.metrics].sort((a, b) => a.coveredDays - b.coveredDays) : []

  const questionCount = monitor?.pairs.length ?? 0
  const allEntries = BUCKET_ORDER.flatMap((bucket) => buckets.get(bucket)!)
  const presentDomains = DOMAIN_ORDER.filter((domain) => allEntries.some((entry) => entryDomain(entry) === domain))

  const onDecide = (entry: LifecycleEntry, d: PatternStatus) => {
    decide(entry.pattern!.id, d)
    setAcks((prev) => [...prev, { key: `${entry.key}-${d}`, d }])
  }

  return (
    <MintakFrame big={heroCount}>
    <EntranceGroup className="m9m-body">
      {/* ── A motor állapota: az EGY hangos borostyán üveg — próza három félkövér számmal,
             a 3×2 életciklus-rács lapos cellái és a katalógus-eszköztár ── */}
      <div className="tf-rows">
        <div className="glass tf-case tf-c-gold tf-s-lav m9m-motor rise" style={{ '--d': '40ms' } as CSSProperties}>
          <span className="tf-crow">
            <span className="tf-st">A motor állapota</span>
            <em>{lastRunLabel(monitor?.lastRunAt ?? null)} · {monitor?.lookbackDays ?? 0} nap</em>
          </span>
          <p className="m9m-prose">
            <b>{questionCount} kérdést</b> figyelek a naplóidból. <b>{counts.confirmed} megerősített</b> összefüggés
            dolgozik a társban, <b>{counts.decide} vár a döntésedre</b>.
          </p>
          <div className="m9m-lgrid">
            {BUCKET_ORDER.map((bucket) => {
              const meta = LCEL_META[bucket]
              const hot = bucket === 'decide' && counts.decide > 0
              const tone: Tone = hot ? 'coral' : meta.tone
              return (
                <button
                  key={bucket}
                  type="button"
                  aria-pressed={activeBucket === bucket}
                  className={cn('m9m-lcel', `is-${tone}`, hot && 'hot', activeBucket === bucket && 'is-selected')}
                  onClick={() => {
                    updateCatalog({ bucket, page: null })
                  }}
                >
                  <b>{counts[bucket]}</b>
                  <small><Icon3D name={meta.art} size={16} />{meta.label}</small>
                </button>
              )
            })}
          </div>
          <div className="m9m-tool">
            <span className="m9m-tool-value">
              {activeDomain == null ? 'Minden téma' : <PatternDomainMark domain={activeDomain} size={18} />}
            </span>
            <button type="button" className="m9m-tool-btn" onClick={() => setFilterOpen(true)}>
              <Icon3D name="t-gear" size={17} />Szűrés
            </button>
          </div>
        </div>
      </div>

      {/* ── Döntés-nyugtázások: `tf-after` pirulák (prototípus `after big`) ── */}
      {acks.length > 0 && (
        <div className="m9m-acks">
          {acks.map((a) => (
            <span key={a.key} className="tf-after m9m-ack rise" data-ack={a.d}>
              <Icon3D name={ACK[a.d].art} size={16} />{ACK[a.d].text}
            </span>
          ))}
        </div>
      )}

      {activeBucket === 'decide' && filteredEntries.length > 0 && (
        <>
          <Lsec title={`Döntésre vár · ${filteredEntries.length}`} art="t-bell" count="csak erős jel" delayMs={80} />
          <div className="tf-rows">
            {pagedEntries.items.map((entry, i) => (
              <div key={entry.key} className="m9m-decwrap rise" style={{ '--d': `${110 + i * 40}ms` } as CSSProperties}>
                <PatternDecisionCard
                  glass
                  pattern={entry.pattern!}
                  pair={entry.pair}
                  onDecide={(d: PatternStatus) => onDecide(entry, d)}
                  showExplainer={i === 0}
                  showDetailLink
                  detailSearch={detailSearch}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Megerősítve: zsálya üveg-csempék, domén 3D jel + HUMÁN bizonyosság-chip ── */}
      {activeBucket === 'confirmed' && filteredEntries.length > 0 && (
        <>
          <Lsec title="Megerősítve — él a tudásban" art="t-tick"
            count={filteredEntries.length} countTestId="mnt-cnt-confirmed" delayMs={140} />
          <div className="m9m-mosaic">
            {pagedEntries.items.map((entry, i) => (
              <PatternTile search={detailSearch} key={entry.key} entry={entry} skin="sage" chip={tileChip(entry, 'sage')}
                sb={entry.pair?.n != null ? `${entry.pair.n} közös nap` : 'megerősítve'} delayMs={170 + i * 30} />
            ))}
          </div>
          <p className="m9m-fn rise" style={{ '--d': '190ms' } as CSSProperties}>
            Ez a {filteredEntries.length} összefüggés benne van a társ fejében minden beszélgetésnél, és ebből
            épülnek az előrejelzések.
          </p>
        </>
      )}

      {/* ── Megfigyelés alatt: levendula üveg-csempék a bizonyíték-sávval ── */}
      {activeBucket === 'monitoring' && filteredEntries.length > 0 && (
        <>
          <Lsec title="Megfigyelés alatt" art="t-eye" count={filteredEntries.length} delayMs={220} />
          <div className="m9m-mosaic">
            {pagedEntries.items.map((entry, i) => (
              <PatternTile search={detailSearch}
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
          <Lsec title="Még gyűlik az adat" art="t-up" count={filteredEntries.length} delayMs={280} />
          <div className="m9m-mosaic">
            {pagedEntries.items.map((entry, i) => (
              <PatternTile search={detailSearch} key={entry.key} entry={entry} skin="dashed"
                sb={engineStatusCopy(entry.pattern?.status)
                  ?? (entry.pair ? verdictSentence(entry.pair, bottleneckCoveredDays(entry.pair)) : '')}
                delayMs={310 + i * 30} />
            ))}
          </div>
          <p className="m9m-fn rise" style={{ '--d': '330ms' } as CSSProperties}>
            Ezek nem hibák — csak nincs elég közös nap. Amit logolsz, az hozza őket életre.
          </p>
        </>
      )}

      {/* ── Megnéztük — nincs összefüggés: halk, lapos csempék ── */}
      {activeBucket === 'noRelationship' && filteredEntries.length > 0 && (
        <>
          <Lsec title="Megnéztük — nincs összefüggés" art="t-hold" count={filteredEntries.length} delayMs={360} />
          <div className="m9m-mosaic">
            {pagedEntries.items.map((entry, i) => (
              <PatternTile search={detailSearch} key={entry.key} entry={entry} skin="mute"
                sb={engineStatusCopy(entry.pattern?.status)
                  ?? findingOneLiner(entry.pair) ?? entry.pattern?.mechanism ?? ''} delayMs={390 + i * 30} />
            ))}
          </div>
          <p className="m9m-fn rise" style={{ '--d': '410ms' } as CSSProperties}>
            Ez is eredmény: megnéztük, és nincs kapcsolat. Nem kér döntést — ha később megerősödne, feljebb lép.
          </p>
        </>
      )}

      {/* ── Elvetve ── */}
      {activeBucket === 'rejected' && filteredEntries.length > 0 && (
        <>
          <Lsec title="Elvetve" art="t-skip" count={filteredEntries.length} delayMs={440} />
          <div className="m9m-mosaic">
            {pagedEntries.items.map((entry, i) => (
              <PatternTile search={detailSearch} key={entry.key} entry={entry} skin="mute"
                sb={entry.pair ? verdictSentence(entry.pair, bottleneckCoveredDays(entry.pair)) : 'elvetve'}
                delayMs={470 + i * 30} />
            ))}
          </div>
        </>
      )}

      {filteredEntries.length === 0 && (
        <div className="tf-dash m9m-empty rise">
          <Icon3D name="t-pattern" size={30} />
          <span>Ebben az állapotban ezzel a szűréssel most nincs minta.</span>
        </div>
      )}

      {pagedEntries.pageCount > 1 && (
        <nav className="m9m-pager rise" aria-label="Minták lapozása">
          <button type="button" aria-label="Előző oldal" disabled={pagedEntries.page === 0}
            onClick={() => updateCatalog({ page: String(pagedEntries.page - 1) })}>
            <span aria-hidden="true">‹</span>
          </button>
          <span>
            {pagedEntries.page * PATTERN_PAGE_SIZE + 1}–{Math.min((pagedEntries.page + 1) * PATTERN_PAGE_SIZE, filteredEntries.length)} / {filteredEntries.length}
          </span>
          <button type="button" aria-label="Következő oldal"
            disabled={pagedEntries.page === pagedEntries.pageCount - 1}
            onClick={() => updateCatalog({ page: String(pagedEntries.page + 1) })}>
            <span aria-hidden="true">›</span>
          </button>
        </nav>
      )}

      {/* ── Adat-egészség: kis lefedettség-gyűrűk görgethető sávja, legvékonyabb elöl ── */}
      {monitor && sortedMetrics.length > 0 && (
        <>
          <Lsec title="Adat-egészség" delayMs={500} />
          <div className="m9m-cov rise" style={{ '--d': '520ms' } as CSSProperties}>
            {sortedMetrics.map((metric) => {
              const ratio = metric.windowDays === 0 ? 0 : metric.coveredDays / metric.windowDays
              const pct = Math.round(ratio * 100)
              const tone = ratio >= 0.5 ? 'is-sage' : ratio > 0 ? 'is-gold' : 'is-mute'
              const last = lastSeenLabel(metric.lastDayWithData)
              return (
                <div key={metric.key} className={cn('m9m-covtile', tone)}>
                  <span className="tf-gauge">
                    <svg viewBox="0 0 64 64" className="uv-ring" aria-hidden="true">
                      <circle className="uv-ring-track" cx="32" cy="32" r={RING_R} />
                      {pct > 0 && (
                        <circle className="uv-ring-prog" cx="32" cy="32" r={RING_R}
                          strokeDasharray={`${ratio * RING_C} ${RING_C}`} />
                      )}
                    </svg>
                    <span className="tf-gauge-value">{pct}</span>
                  </span>
                  <b data-testid="coverage-label">{metric.label}</b>
                  <small>{metric.coveredDays}/{metric.windowDays}{last ? ` · ${last}` : ''}</small>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Memória ↔ Minták: a visszairány (mezo-d20.11) — a motor bemenete (L0→L3) és a
             kimenete (a minták) egymás szomszédjai. ── */}
      <Link to="/mezo/memoria" className="m9m-flink rise" style={{ '--d': '540ms' } as CSSProperties}>
        A motor bemenete: memória-rétegek →
      </Link>

      {filterOpen && (
        <PatternFilterSheet
          domain={activeDomain}
          sort={sort}
          availableDomains={presentDomains}
          onApply={(next) => {
            updateCatalog({ bucket: activeBucket, domain: next.domain, sort: next.sort, page: null })
          }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </EntranceGroup>
    </MintakFrame>
  )
}
