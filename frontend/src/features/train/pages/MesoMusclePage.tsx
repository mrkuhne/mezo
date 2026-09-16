// ============================================================
// Mezo · MesoMusclePage — one muscle's whole story, reached from a week-review
// row. Train Titanium T9 Task 5 (mezo-88iwa.10): ported from the prototype's
// `planMuscle` (docs/design_2.0/prototypes/companion-titanium/plan-pages.js:231-334).
//
// Anatomy, top to bottom:
//   `.pl-dhero`      — full-bleed hero in the MUSCLE's own region tone, carrying its
//                      body map, the weekly set count as the one numeral, the „say"
//                      sentence (what this number means) and the „next" sentence
//                      (what Monday does to it).
//   `.pl-mstats`     — the three plain facts: sessions a week, week-one sets, the most
//                      this plan will ever ask.
//   `.pl-scale`      — THE GAUGE (this page only; the old per-tile `VolumeBand.tsx`
//                      had no consumer left once this page and the week page were
//                      refaced, and was removed T9 sweep): a fill to the current
//                      number, a landmark mark
//                      at the lower threshold and one at the ceiling, and a labelled
//                      pin. TWO rules the prototype pins and this page implements:
//                        · MERGED LABEL — a muscle you only hold has its threshold and
//                          its ceiling in the same place, so it gets ONE caption
//                          („ennyitől fejlődik — és itt tartod"), never two stacked on
//                          top of each other.
//                        · `--nudge` EDGE-CLAMPING — a label anchored past 86% (or
//                          under 14%) is pulled back onto the track instead of being
//                          centred off the end of it. Mid-scale that clamp does nothing,
//                          so a pair whose geometry merges while its NUMBERS differ is
//                          first pushed apart to a minimum gap (`spreadCaptions`).
//   `.pl-arc`        — the plan's ramp, one bar per week, this week lit, the pihenőhét
//                      hatched, with the per-week set counts under it (`.pl-weekvals`).
//   `.pl-exs`        — where it actually works: one `.pl-ex` row per training day,
//                      each a door to that day's own page.
//   derivation       — the 4-layer provenance (`DerivationSteps`, unchanged).
//   `.pl-versus`     — this plan against the previous one. NEVER red on a down move:
//                      the „Most" row keeps the muscle's own colour whatever the delta,
//                      and the sentence below says a lower peak is a shift of focus,
//                      not a failure.
//
// Real-mode T0: a null arc is NOT an error — the honest split between „couldn't load"
// and „no sessions yet" below is the original idiom and stays exactly as it was.
// Language (T9 jargon ban): „felső érték" not „plafon", „terv" not „blokk",
// „pihenőhét" not „deload"; the tier words come from tierLabel.ts.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { useMesocycleVolumeArc } from '@/data/train/mesoArcHooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { cn } from '@/shared/lib/cn'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { MozaikPage, PageBody, PageHead, type PageTone } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { BodyMap } from '@/features/train/components/BodyMap'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { muscleTiles, previousBlock, whereItWorks } from '@/features/train/logic/mesoWeek'
import { REGION_TONE, regionColor, type RegionKey } from '@/features/train/logic/muscleColors'
import { tierLabel } from '@/features/train/logic/tierLabel'
import { DerivationSteps } from '@/features/train/components/DerivationSteps'

/** The prototype's label clamp (`plan-pages.js:294`): a caption anchored near either end of
 *  the track would be centred half-way off it, so its translate-X is overridden to hug the
 *  edge instead. Returned as a plain string and handed to the markup as `--nudge` — the CSS
 *  default (`-50%`, centred) stays untouched for every label that sits in the middle. */
export function nudgeFor(at: number): string {
  if (at > 86) return '-84%'
  if (at < 14) return '-16%'
  return '-50%'
}

/** Two landmarks within CAPTION_MIN_GAP points of each other are ONE landmark to the eye. A
 *  maintain muscle is the case that matters: its lower threshold IS its ceiling, so two
 *  captions would stack on top of each other and say the same thing twice. */
export const CAPTION_MIN_GAP = 7
export function labelsMerge(lowPct: number, topPct: number): boolean {
  return Math.abs(topPct - lowPct) < CAPTION_MIN_GAP
}

/** When the geometry merges but the NUMBERS don't (mev !== ceiling), both captions still
 *  render — and `nudgeFor` only clamps at the track's ENDS, so mid-scale the two would sit
 *  on top of each other. Push the pair apart to exactly CAPTION_MIN_GAP around their own
 *  midpoint, then slide the pair back inside the track if that pushed an end off it. Only
 *  the CAPTION anchors move (by at most half the gap); the marks keep their true positions,
 *  and a pair that is already far enough apart is returned untouched. */
export function spreadCaptions(lowPct: number, topPct: number): [number, number] {
  if (topPct - lowPct >= CAPTION_MIN_GAP) return [lowPct, topPct]
  const mid = (lowPct + topPct) / 2
  let lo = mid - CAPTION_MIN_GAP / 2
  let hi = mid + CAPTION_MIN_GAP / 2
  if (lo < 0) { hi -= lo; lo = 0 }
  if (hi > 100) { lo -= hi - 100; hi = 100 }
  return [lo, hi]
}

/** Mirrors the hero + facts + gauge anatomy below. */
function MuscleSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <Skeleton width={90} height={12} style={{ margin: '12px 0 0 24px' }} />
      <Skeleton height={230} style={{ margin: '10px 0 14px' }} />
      <div className="col gap-sm" style={{ padding: '0 24px 24px' }}>
        <Skeleton height={64} />
        <Skeleton height={60} style={{ marginTop: 10 }} />
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" height={72} />)}
      </div>
    </div>
  )
}

export function MesoMusclePage() {
  const { id, muscle } = useParams<{ id: string; muscle: string }>()
  const navigate = useNavigate()
  const goBack = useBackNav(`/train/mesocycles/${id}/week`)
  const { mesocycles, workoutPending } = useTrain()
  const { arc, pending: arcPending, error: arcError } = useMesocycleVolumeArc(id ?? null)

  const meso = mesocycles.find((m) => m.id === id)

  if (workoutPending || arcPending) return <MuscleSkeleton />

  if (!meso || !arc) {
    // A FAILED arc fetch is not „nincs még ív" — the first says try again, the second says
    // wait for the first session, and telling them apart is the difference between a
    // recoverable error and a wrong promise.
    const message = !meso
      ? 'Ez a mesociklus nem található.'
      : arcError
        ? 'Nem sikerült betölteni a heti vizsgálatot — próbáld újra.'
        : 'A heti vizsgálat a terv első edzése után jelenik meg.'
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={goBack} label="‹ Heti vizsgálat" />
        <PageBody>
          <GhostState message={message} />
        </PageBody>
      </MozaikPage>
    )
  }

  const tile = muscleTiles(arc, meso).find((t) => t.group === muscle)
  const profile = meso.volumePerMuscle?.[muscle ?? '']

  if (!tile || !profile) {
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={goBack} label="‹ Heti vizsgálat" />
        <PageBody>
          <GhostState message="Ez az izom nincs a heti vizsgálatban." />
        </PageBody>
      </MozaikPage>
    )
  }

  const tone: PageTone = REGION_TONE[tile.region as RegionKey] ?? 'coral'
  const fam = regionColor(tile.region as RegionKey)
  const accent = { '--mus-color': fam.rail } as CSSProperties
  const rows = whereItWorks(meso, tile.group)
  const freq = rows.length
  const archived = mesocycles.filter((m) => m.status === 'archived')
  const prev = previousBlock(archived, tile.group)
  const name = tile.label.toLowerCase()
  const room = tile.ceiling - tile.current

  const weekOneValue = tile.series[0]?.planned ?? tile.mev
  const seriesToNow = tile.series.filter((s) => s.week <= arc.currentWeek)
  // The plan's own peak („a legtöbb lesz") — the MAX planned value over the non-pihenőhét
  // weeks, not merely the LAST one: a tapering plan whose highest week isn't its last
  // working week would under-report both this fact and the gauge scale if the last-week
  // value stood in for the true peak. (mesoWeek.ts's old `peakWeek` helper answered a
  // different question — where the ramp's own last working week sits, used for its index
  // — and was removed once nothing still called it, T9 sweep.)
  const nonDeloadPlanned = tile.series.filter((s) => !s.deload).map((s) => s.planned)
  const top = nonDeloadPlanned.length > 0 ? Math.max(...nonDeloadPlanned) : tile.current
  // One scale for the gauge AND the versus bars, so „akkor" and „most" are measured against
  // the same ruler: the muscle's raw MRV, widened if this plan's own peak goes past it.
  const scale = Math.max(tile.mrv, top) || 1
  // The versus bars' OWN ruler, gauge scale untouched: an archived plan that peaked above
  // this plan's scale would otherwise clamp both versus bars to 100% at the same pixel width
  // while their numbers still differ — widen just for those two rows when that happens.
  const versusScale = Math.max(scale, prev?.peak ?? 0) || 1
  const nowPct = Math.min(100, (tile.current / scale) * 100)
  const lowPct = (tile.mev / scale) * 100
  const topPct = (tile.ceiling / scale) * 100
  // The 7-point rule governs the MARK/LABEL GEOMETRY (two landmarks close enough to read as
  // one) — it still drops the lower mark whenever the two are visually on top of each other.
  // The merged CAPTION TEXT („ennyitől fejlődik — és itt tartod") is a stronger claim: it's
  // only true when the threshold IS the ceiling. A muscle that merely LOOKS merged at this
  // scale (mev !== ceiling) keeps both captions, nudged apart, so the text never says
  // something the numbers don't back up.
  const merged = labelsMerge(lowPct, topPct)
  const mergedText = tile.mev === tile.ceiling
  // Two captions that survive a merged GEOMETRY get anchors far enough apart to read.
  const [lowCapPct, topCapPct] = spreadCaptions(lowPct, topPct)

  const say =
    tile.tier === 'maintain'
      ? `A ${name} hetente ${tile.current} szettet kap, és ez így is marad. Most máshol építesz — ez az izom közben megtartja, amit tud.`
      : room > 0
        ? `A ${name} hetente ${tile.current} szettet kap. Még ${room} fér bele, aztán a terv végéig ${tile.ceiling} marad a felső érték.`
        : `A ${name} hetente ${tile.current} szettet kap — ennél többet ez a terv már nem ad. A következő tervben indulsz majd magasabbról.`

  // What Monday does, read straight off the arc's NEXT week — never a promise the plan's own
  // series doesn't already carry. The PROMISE itself is clamped to `tile.step` (mesoWeek.ts),
  // not the raw arc delta: a grind-held muscle's next planned week can still show +2 in the
  // raw series while the engine's own step is 0 (current < ceiling, held for a grind) — the
  // step exists precisely so this sentence never promises what the engine isn't giving.
  const nextWeek = tile.series.find((s) => s.week === arc.currentWeek + 1)
  const next = !nextWeek
    ? 'Ez a terv utolsó hete — hétfőn már nem változik.'
    : nextWeek.deload
      ? `Hétfőtől pihenőhét: ${nextWeek.planned} szettre esik vissza.`
      : tile.step > 0
        ? `Hétfőn ${tile.step} szettel többet kapsz.`
        : 'Hétfőn nem változik.'

  const lastWeek = tile.series[tile.series.length - 1]
  const arcValues = tile.series.map((s) => s.planned)
  const low = Math.min(...arcValues)
  const span = Math.max(...arcValues) - low || 1

  return (
    <MozaikPage tone={tone}>
      <PageHead onBack={goBack} label="‹ Heti vizsgálat" />
      <EntranceGroup>
        <section className="pl-dhero rise" style={accent}>
          <span className="pl-dhero-wash" aria-hidden="true" />
          <span className="pl-dhero-art">
            <BodyMap heat={[{ token: tile.group, level: 'in' }]} views="auto" ariaLabel={`${tile.label} a testtérképen`} />
          </span>
          <span className="pl-dhero-tag tr-eyebrow">
            {arc.currentWeek}. hét · {tierLabel(tile.tier)}
          </span>
          <h2>{tile.label}</h2>
          <div className="pl-dhero-number">
            <strong>{tile.current}</strong>
            <small>szett hetente</small>
          </div>
          <p className="pl-say">{say}</p>
          <p className="pl-sub-say">{next}</p>
        </section>

        <PageBody principle="A baseline sosem íródik felül — a Felülír csak egy újabb réteg rá. Piros itt sincs: a tartás döntés, nem hiba.">
          <div className="pl-mstats rise" style={accent}>
            <span><strong>{freq}</strong><small>edzés hetente</small></span>
            <span><strong>{weekOneValue}</strong><small>szett az 1. héten</small></span>
            <span><strong>{top}</strong><small>a legtöbb lesz</small></span>
          </div>

          {/* — the gauge: fill + landmarks + labelled pin, this page only — */}
          <h3 className="pl-h3 rise">Hol tartasz</h3>
          <div className="pl-scale-wrap rise" style={accent}>
            <span className="pl-scale-bar">
              <i className="fill" style={{ '--w': `${nowPct}%` } as CSSProperties} />
              {!merged && <u className="mark is-mev" style={{ '--at': `${lowPct}%` } as CSSProperties} />}
              <u className="mark is-top" style={{ '--at': `${topPct}%` } as CSSProperties} />
              <b className="pin" style={{ '--at': `${nowPct}%`, '--nudge': nudgeFor(nowPct) } as CSSProperties}>
                {tile.current}
              </b>
            </span>
            <span className="pl-scale-legend">
              {mergedText ? (
                <i style={{ '--at': `${topPct}%`, '--nudge': nudgeFor(topPct) } as CSSProperties}>
                  {tile.ceiling}<small>ennyitől fejlődik — és itt tartod</small>
                </i>
              ) : (
                <>
                  <i style={{ '--at': `${lowCapPct}%`, '--nudge': nudgeFor(lowCapPct) } as CSSProperties}>
                    {tile.mev}<small>ennyitől fejlődik</small>
                  </i>
                  <i style={{ '--at': `${topCapPct}%`, '--nudge': nudgeFor(topCapPct) } as CSSProperties}>
                    {tile.ceiling}<small>eddig mész el</small>
                  </i>
                </>
              )}
            </span>
          </div>
          <p className="pl-foot-say">
            {tile.mev} szett alatt nincs elég inger ahhoz, hogy ez az izom fejlődjön. A felső érték az,
            ameddig ebben a tervben elmész — ezt a fókuszod szabja meg.
          </p>

          {/* — the plan's ramp, week by week — */}
          <h3 className="pl-h3 rise">A {arc.weeks} hét</h3>
          <div className="rise" style={accent}>
            <span
              className="pl-arc"
              aria-hidden="true"
              style={{ '--tr-accent': fam.rail, marginBottom: 18 } as CSSProperties}
            >
              {tile.series.map((s) => (
                <i
                  key={s.week}
                  className={cn(
                    s.deload && 'is-deload',
                    s.isCurrent && 'is-now',
                    !s.isCurrent && s.week < arc.currentWeek && 'is-past',
                  )}
                  style={{ '--h': `${Math.round(22 + ((s.planned - low) / span) * 78)}%` } as CSSProperties}
                >
                  <b>{s.week}</b>
                </i>
              ))}
            </span>
            <span className="pl-weekvals">
              {tile.series.map((s) => (
                <i key={s.week} className={s.isCurrent ? 'is-now' : undefined}>{s.planned}</i>
              ))}
            </span>
          </div>
          <p className="pl-foot-say">
            {lastWeek?.deload
              ? `Az utolsó hét pihenőhét — ott ${lastWeek.planned} szettre esik vissza, hogy kipihend a ${arc.weeks} hetet.`
              : `A terv ${arc.weeks} hete végig dolgoztatja ezt az izmot — nincs a végén pihenőhét.`}
          </p>

          {/* — where it works: one door per training day — */}
          <h3 className="pl-h3 rise">Hol edzed</h3>
          {rows.length > 0 ? (
            <div className="pl-exs">
              {rows.map((r) => (
                <button
                  key={r.day}
                  type="button"
                  className="pl-ex is-link rise"
                  style={{ '--ex-color': fam.rail } as CSSProperties}
                  aria-label={`${r.day} · ${r.type} nap`}
                  onClick={() => navigate(`/train/mesocycles/${id}/days/${encodeURIComponent(r.day)}`)}
                >
                  <span className="pl-ex-index">{r.day}</span>
                  <span className="pl-ex-art"><MuscleChip token={tile.group} size={34} /></span>
                  <span className="pl-ex-copy">
                    <strong>{r.type} nap</strong>
                    <small>{r.exercises.map((e) => e.name).join(', ')}</small>
                  </span>
                  <span className="pl-ex-sets">{r.sets}<i>szett</i></span>
                </button>
              ))}
            </div>
          ) : (
            <p className="pl-foot-say">Ezen a héten nincs olyan nap, amelyik ezt az izmot dolgoztatná.</p>
          )}

          {/* — the 4-layer provenance, unchanged — */}
          <h3 className="pl-h3 rise">Honnan jön ez a szám</h3>
          <div className="card rise" style={{ padding: '10px 12px' }}>
            <DerivationSteps
              profile={profile}
              tier={tile.tier}
              ceiling={tile.ceiling}
              weekOneValue={weekOneValue}
              series={seriesToNow}
              step={tile.step}
            />
          </div>

          {/* — this plan against the previous one. A lower peak is NEVER drawn red. — */}
          <h3 className="pl-h3 rise">Az előző tervhez képest</h3>
          {prev ? (
            <>
              <p className="pl-versus-title rise">Előző terved: {prev.title}</p>
              <div className="pl-versus rise" style={accent}>
                <div className="pl-versus-row">
                  <span>Akkor</span>
                  <span className="pl-versus-bar">
                    <i style={{ '--w': `${Math.min(100, (prev.peak / versusScale) * 100)}%` } as CSSProperties} />
                  </span>
                  <b>{prev.start} → {prev.peak}</b>
                </div>
                <div className="pl-versus-row is-now">
                  <span>Most</span>
                  <span className="pl-versus-bar">
                    <i style={{ '--w': `${Math.min(100, (top / versusScale) * 100)}%` } as CSSProperties} />
                  </span>
                  <b>{weekOneValue} → {top}</b>
                </div>
              </div>
              <p className="pl-foot-say">
                {top > prev.peak
                  ? `Ez a terv ${top - prev.peak} szettel visz magasabbra, mint az előző.`
                  : top === prev.peak
                    ? 'Ez a terv ugyanoda visz, mint az előző — ez tartás, nem visszaesés.'
                    : 'Az előző terv magasabbra vitt — most más izom kapja a hangsúlyt.'}
              </p>
            </>
          ) : (
            <p className="pl-foot-say">
              Ehhez az izomhoz még nincs korábbi terved — ez az első, amiben számon tartjuk.
            </p>
          )}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
