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
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { ClayIcon, ClaySpot, type ClayIconName } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { GhostState } from '@/shared/ui/GhostState'
import { usePatterns, usePatternMonitor, usePatternActions } from '@/data/hooks'
import { PatternDecisionCard } from '@/features/insights/components/PatternDecisionCard'
import { lastSeenLabel } from '@/features/insights/logic/metricFormat'
import { DOMAIN_META, DOMAIN_ORDER } from '@/features/insights/logic/domains'
import { bucketize, BUCKET_ORDER, type LifecycleBucket, type LifecycleEntry } from '@/features/insights/logic/lifecycle'
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

/** A pár KIMENETI (B) doménjének clay ikonja — pár híján a minta-ikon (i-minta). */
const DOMAIN_ICON: Record<MetricDomain, ClayIconName> = {
  sleep: 'i-alvas', train: 'i-edzes', fuel: 'i-fuel', mind: 'i-checkin', body: 'i-suly', other: 'i-minta',
}

/** A 3×2 életciklus-rács cellái — prototípus .lcel skinek (a hot ráépül a decide-ra). */
const LCEL_META: Record<LifecycleBucket, { label: string; skin: string }> = {
  decide: { label: 'döntésre vár', skin: 'c-mute' },
  monitoring: { label: 'megfigyelés', skin: 'c-lav' },
  confirmed: { label: 'megerősítve', skin: 'c-sage' },
  gathering: { label: 'még gyűlik', skin: 'c-amber' },
  noRelationship: { label: 'nincs kapcsolat', skin: 'c-mute' },
  rejected: { label: 'elvetve', skin: 'c-mute' },
}

/** A döntés zsálya-nyugtázása (prototípus decdone) — a mutáció maga a régi `decide`. */
const ACK: Record<PatternStatus, string> = {
  confirm: '✓ Beépítettem a tudásba — mostantól számolok vele.',
  monitor: '👁 Rendben, figyeljük tovább — szólok, ha erősödik.',
  reject: '✕ Elvetve — nem hozom fel újra.',
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
  const icon = entry.pair ? DOMAIN_ICON[entry.pair.metricBDomain] : 'i-minta'
  const inner = (
    <>
      <div className="mnt-ptile-top">
        <ClayIcon name={icon} size={26} />
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
  if (!entry.pair) return <div className={cls} style={style}>{inner}</div>
  return (
    <Link to={`/mezo/patterns/${entry.key}`} className={cls} style={style}>
      {inner}
    </Link>
  )
}

/** Szekció-fejléc (prototípus .lsec): eyebrow + jobbra igazított darabszám. */
function Lsec({ title, ink, count, countTestId, delayMs }: {
  title: string; ink: string; count?: ReactNode; countTestId?: string; delayMs: number
}) {
  return (
    <div className="mnt-lsec rise" style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
      <span className="mz-eyebrow" style={{ color: ink }}>{title}</span>
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
  // Domén-szűrő (spec): üres set = nincs szűrés. A „Mind" chip egy kattintásra az ÖSSZES aktív
  // domént eltávolítja — `toggleDomain`-t hívja egyszer/domén UGYANABBAN a batch-ben, ezért a
  // toggle csak funkcionális setState-tel biztonságos (külön kattintásonkénti stale closure
  // eldobná a korábbi hívásokat).
  const [activeDomains, setActiveDomains] = useState<Set<MetricDomain>>(new Set())
  // Zsálya-nyugtázások (prototípus decdone) — a döntés a régi mutáción megy, a kártya helyén
  // a nyugtázó sor marad, miközben az adat a kosarak közt költözik.
  const [acks, setAcks] = useState<{ key: string; msg: string }[]>([])

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

  const toggleDomain = (d: MetricDomain) =>
    setActiveDomains((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })

  const byDomain = (e: LifecycleEntry) =>
    activeDomains.size === 0 || (e.pair != null && activeDomains.has(e.pair.metricBDomain))
  const visibleFor = (bucket: LifecycleBucket) => buckets.get(bucket)!.filter(byDomain)

  const coverageByKey = new Map((monitor?.metrics ?? []).map((m) => [m.key, m]))
  const bottleneckCoveredDays = (pair: PatternMonitorPair) =>
    pair.bottleneckMetricKey ? (coverageByKey.get(pair.bottleneckMetricKey)?.coveredDays ?? null) : null
  // Adat-egészség: a metrika-lefedettség csempe-sávja — legvékonyabb elöl (régi sorrend-szabály).
  const sortedMetrics = monitor ? [...monitor.metrics].sort((a, b) => a.coveredDays - b.coveredDays) : []

  const questionCount = monitor?.pairs.length ?? 0
  const presentDomains = DOMAIN_ORDER.filter((d) => monitor?.pairs.some((p) => p.metricBDomain === d))

  const decideVisible = visibleFor('decide')
  const confirmedVisible = visibleFor('confirmed')
  const monitoringVisible = visibleFor('monitoring')
  const gatheringVisible = visibleFor('gathering')
  const noRelationshipVisible = visibleFor('noRelationship')
  const rejectedVisible = visibleFor('rejected')

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
              <div key={bucket} className={cn('mnt-lcel', hot ? 'hot' : meta.skin)}>
                <b>{counts[bucket]}</b>
                <small>{meta.label}</small>
              </div>
            )
          })}
        </div>
        <div className="row gap-sm" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={activeDomains.size === 0 ? 'chip brand' : 'chip'}
            onClick={() => activeDomains.forEach((d) => toggleDomain(d))}
          >
            Mind
          </button>
          {presentDomains.map((d) => (
            <button
              key={d}
              type="button"
              className={activeDomains.has(d) ? 'chip brand' : 'chip'}
              onClick={() => toggleDomain(d)}
            >
              {DOMAIN_META[d].icon} {DOMAIN_META[d].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Döntés: zsálya-nyugtázások + a hubbal közös döntés-kártya (gold ring) ── */}
      {acks.map((a) => (
        <div key={a.key} className="mnt-decdone rise">
          <ClaySpot name="s-orb-unnepel" size={26} />
          <span>{a.msg}</span>
        </div>
      ))}
      {decideVisible.length > 0 && (
        <>
          <Lsec title={`🔔 Döntésre vár · ${decideVisible.length}`} ink="var(--mz-cell-amber-ink)"
            count="csak erős jel" delayMs={80} />
          {decideVisible.map((entry, i) => (
            <div key={entry.key} className="mnt-decwrap rise" style={{ '--d': `${110 + i * 40}ms` } as React.CSSProperties}>
              <PatternDecisionCard
                pattern={entry.pattern!}
                pair={entry.pair}
                onDecide={(d: PatternStatus) => onDecide(entry, d)}
                showExplainer={i === 0}
                // A V3.2 AI-hipotézis soroknak nincs katalógus-párja (hyp-<hash> pairKey) — a
                // részlet-link garantáltan "Nincs ilyen minta."-ra futna, ezért csak pár-backed
                // sorokon jelenik meg (mezo-tk88.5 review fix).
                showDetailLink={entry.pair != null}
              />
            </div>
          ))}
        </>
      )}

      {/* ── Megerősítve: zsálya-csempék, domén clay ikon + HUMÁN bizonyosság-chip ── */}
      {confirmedVisible.length > 0 && (
        <>
          <Lsec title="✓ Megerősítve — él a tudásban" ink="var(--mz-cell-sage-ink)"
            count={confirmedVisible.length} countTestId="mnt-cnt-confirmed" delayMs={140} />
          <div className="mnt-mosaic">
            {confirmedVisible.map((entry, i) => (
              <PatternTile key={entry.key} entry={entry} skin="sage" chip={tileChip(entry, 'sage')}
                sb={entry.pair?.n != null ? `${entry.pair.n} közös nap` : 'megerősítve'} delayMs={170 + i * 30} />
            ))}
          </div>
          <p className="mnt-foot rise" style={{ '--d': '190ms' } as React.CSSProperties}>
            Ez a {confirmedVisible.length} összefüggés benne van a társ fejében minden beszélgetésnél, és ebből
            épülnek az előrejelzések.
          </p>
        </>
      )}

      {/* ── Megfigyelés alatt: levendula-csempék animált bizonyíték-sávval ── */}
      {monitoringVisible.length > 0 && (
        <>
          <Lsec title="👁 Megfigyelés alatt" ink="var(--mz-cell-lav-ink)" count={monitoringVisible.length} delayMs={220} />
          <div className="mnt-mosaic">
            {monitoringVisible.map((entry, i) => (
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
      {gatheringVisible.length > 0 && (
        <>
          <Lsec title="⏳ Még gyűlik az adat" ink="var(--mz-cell-amber-ink)" count={gatheringVisible.length} delayMs={280} />
          <div className="mnt-mosaic">
            {gatheringVisible.map((entry, i) => (
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
      {noRelationshipVisible.length > 0 && (
        <>
          <Lsec title="○ Megnéztük — nincs összefüggés" ink="var(--mz-ink-mut)"
            count={noRelationshipVisible.length} delayMs={360} />
          <div className="mnt-mosaic">
            {noRelationshipVisible.map((entry, i) => (
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
      {rejectedVisible.length > 0 && (
        <>
          <Lsec title="✕ Elvetve" ink="var(--mz-ink-mut)" count={rejectedVisible.length} delayMs={440} />
          <div className="mnt-mosaic">
            {rejectedVisible.map((entry, i) => (
              <PatternTile key={entry.key} entry={entry} skin="mute"
                sb={entry.pair ? verdictSentence(entry.pair, bottleneckCoveredDays(entry.pair)) : 'elvetve'}
                delayMs={470 + i * 30} />
            ))}
          </div>
        </>
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
    </EntranceGroup>
    </MintakFrame>
  )
}
