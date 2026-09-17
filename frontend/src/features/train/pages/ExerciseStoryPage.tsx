// ============================================================
// Mezo · ExerciseStoryPage — ONE exercise's whole story at `/train/exercises/:key`.
//
// Train parity P2 Task 5 (mezo-lf3cv), ported from the prototype's `gyDetail`
// (docs/design_2.0/prototypes/companion-titanium/gyak-pages.js:70-124). Until this
// page existed, Task 4's catalogue routed every card here and the router's catch-all
// dropped the reader on `/nap`; and the ONLY per-exercise story production had was the
// pre-Titanium `REKORDOK` modal (`sheets/ExerciseRecordSheet.tsx`, retired with this
// commit — this page is its replacement, and it had no other caller).
//
// Anatomy, top to bottom — 1:1 with `gyDetail`:
//   `‹ Gyakorlatok`      the back pill (house `PageHead`).
//   `.pl-dhero.gy-hero`  the poster: muscle eyebrow, the name, the AUTHORSHIP stamp
//                        (`Saját` / `Közös · {név}` — see below), and for a logged
//                        exercise the three foot facts `N alkalom · <dátum> óta ·
//                        N t összsúly`. The middle fact is only an absolute date when
//                        the series covers the whole history; a wire-capped series says
//                        „ebből az utolsó N látszik" instead (`sinceFact`), and every
//                        date old enough to be misread carries its year (`huMonthDayAged`).
//                        A never-logged exercise gets the prototype's own empty-state
//                        sentence instead.
//   `Rekordjaid`         the three `.gy-rec` stat cards. Every absent figure is an
//                        EM DASH — a record you do not have is never a 0.
//   `Következő cél`      `.gy-next`, derived from the real best set (`nextTarget`).
//   `Az erőd íve`        `StrengthCurve` over Task 2's `e1rmSeries`.
//   `Medáljaid`          this exercise's medals, filtered from `useMedals`.
//   `Hol szerepel`       the running plan's days + the shelf's templates that
//                        prescribe it, derived client-side (`whereUsed`) — no endpoint.
//   `Gyakorlat kezelése` the AUTHORING row(s) — see below.
//
// OMITTED from the prototype, deliberately:
//   · the hero's CUE PROSE („Talpak lent. Stabil lapockák…") — no production field
//     carries per-exercise cue text, and inventing one would be writing coaching copy
//     out of nothing. Recorded in the plan + matrix §17.
//   · the curve's DASHED projected branch and its „a terv várakozása" caption — there
//     is no model behind it (see StrengthCurve's own header).
//
// THREE capabilities that had no reachable home after Task 4 retired the old catalogue
// shell, and that live here now (the house rule: no feature dies silently):
//   · per-exercise EDIT/DELETE → `CatalogExerciseSheet` in edit mode, offered ONLY when
//     the server says `editable` (it is server-derived per viewer; the FE never reasons
//     about roles, and an absent flag — the mock-mode static seed — means no).
//   · the DEMO-VIDEO url → `VideoUrlSheet`, gated the same way on `mediaEditable`.
//     WATCHING a demo already survives elsewhere (the workout card glass, the picker);
//     this is the AUTHORING half, and it is one quiet row that also states whether a
//     video is attached — production's `videoUrl` and demo stills get no section of
//     their own here, because the prototype's story has none and a player would be a
//     new section rather than a ported one.
//   · the `Saját` / `Közös · {név}` AUTHORSHIP stamps (`authoredByMe` / `authorName`,
//     mapped in trainHooks.ts since mezo-qw37.5 and rendered nowhere in the app until
//     now) — they sit in the hero, where the exercise says who it belongs to.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMedals, useMesoTemplates, useTrain } from '@/data/hooks'
import { huMonthDayAged } from '@/shared/lib/dates'
import { hu1, huInt } from '@/shared/lib/huNum'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { ClayIcon } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { InfoButton } from '@/features/train/components/InfoButton'
import { StrengthCurve } from '@/features/train/components/StrengthCurve'
import { CatalogExerciseSheet } from '@/features/train/sheets/CatalogExerciseSheet'
import { VideoUrlSheet } from '@/features/train/sheets/VideoUrlSheet'
import {
  buildLibraryRows, exerciseKey, medalsForExercise, nextTarget, sinceFact, whereUsed,
} from '@/features/train/logic/exerciseLibrary'
import { MEDAL_TYPE_LABEL, medalValueLabel } from '@/features/train/logic/medalLabels'
import { muscleColor, muscleRegion, REGION_TONE } from '@/features/train/logic/muscleColors'
import type { PageTone } from '@/shared/ui/mozaik'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** Volume in reader units: tonnes above 1 t, whole kg below it. */
const volumeLabel = (kg: number) => (kg >= 1000 ? `${hu1(kg / 1000)} t` : `${huInt(kg)} kg`)

/** Mirrors the hero + the three stat cards + the curve box below. */
function StorySkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <Skeleton width={90} height={12} style={{ margin: '12px 0 0 24px' }} />
      <Skeleton height={190} style={{ margin: '10px 0 14px' }} />
      <div className="col gap-sm" style={{ padding: '0 24px 24px' }}>
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" height={78} />)}
        <Skeleton variant="card" height={120} />
      </div>
    </div>
  )
}

export function ExerciseStoryPage() {
  const { key } = useParams<{ key: string }>()
  const navigate = useNavigate()
  const goBack = useBackNav('/train/exercises')
  const { exerciseLibrary, exerciseRecords, exercisesPending, activeMeso, workoutPending } = useTrain()
  const { data: medals, isPending: medalsPending } = useMedals()
  const { templates, pending: templatesPending } = useMesoTemplates()
  const [editing, setEditing] = useState(false)
  const [videoing, setVideoing] = useState(false)

  // The catalogue, the records AND the medals all feed the page above the fold, so wait
  // them all out behind the skeleton (the catalogue's own gate, ExercisesPage:60): a
  // still-loading `useMedals()` answers `[]`, which would paint „Még nincs medálod" as
  // if that were the answer. The PLAN queries are NOT in this gate — they only feed
  // „Hol szerepel" at the foot, which carries its own wait below.
  if (exercisesPending || medalsPending) return <StorySkeleton />

  const rows = buildLibraryRows(exerciseLibrary, exerciseRecords, medals)
  const row = rows.find((r) => r.key === key)

  if (!row) {
    return (
      <MozaikPage tone="gold">
        <PageHead onBack={goBack} label="‹ Gyakorlatok" />
        <PageBody>
          <GhostState message="Ez a gyakorlat nincs a tárban." />
        </PageBody>
      </MozaikPage>
    )
  }

  const item = exerciseLibrary.find((e) => exerciseKey(e) === row.key)
  const region = muscleRegion(row.muscle)
  const tone: PageTone = region ? REGION_TONE[region] : 'gold'
  const accent = { '--mus-color': muscleColor(row.muscle).rail } as CSSProperties
  const record = row.record
  const since = record ? sinceFact(record) : null
  const target = record ? nextTarget(record) : null
  const series = record?.e1rmSeries ?? []
  const myMedals = medalsForExercise(medals, row)
  const used = whereUsed(row, activeMeso, templates)
  const usedPending = workoutPending || templatesPending

  const bestE1rm = record?.bestE1rm?.value ?? null
  const hasE1rm = bestE1rm != null && bestE1rm > 0

  // TWO POPULATIONS, and the card's derived numbers must not straddle them. The headline
  // `bestE1rm` comes from `ExerciseRecordService`, which still counts SKIPPED working sets
  // (mezo-za09c, open — not this slice's to widen or to fix); the `e1rmSeries` below it comes
  // from `E1rmSeries`, which excludes them. So a record set on a skipped set exists in the
  // headline and has NO point in the curve at all, and a delta or a share measured across
  // that gap would be two different things divided by each other.
  //
  // The series' own peak is the tell. When it reaches the headline the two populations agree
  // on this exercise and the comparison is sound; when it falls short the record lives
  // outside the series and BOTH derived numbers are withheld — the card keeps its real
  // figure and simply says nothing it cannot back up. (Half a decimal of slack: the wire
  // rounds both to scale 1.)
  const seriesPeak = series.length ? Math.max(...series.map((p) => p.e1rm)) : null
  const seriesOwnsRecord = hasE1rm && seriesPeak != null && seriesPeak >= bestE1rm! - 0.05

  // The delta: how much the RECORD estimate improved on the best estimate that stood before
  // the session which set it. Not „since last session" — the headline is the all-time best,
  // so its delta has to be measured against the previous best.
  //
  // It is also withheld on a WINDOW-BOUNDED series (`sinceFact`): past the wire's point cap
  // the earlier peak may simply have fallen out of the series, and „+X kg a korábbi csúcsod
  // óta" would then be measured from whatever survived the window rather than from the real
  // previous best — overstating the gain by however much the lost peak was worth.
  const priorBest = seriesOwnsRecord && since?.kind !== 'window'
    ? series.filter((p) => p.date < record!.bestE1rm!.set.date).reduce<number | null>(
      (max, p) => (max === null || p.e1rm > max ? p.e1rm : max), null)
    : null
  const e1rmDelta = bestE1rm != null && priorBest != null && bestE1rm > priorBest ? bestE1rm - priorBest : null
  // The bar: where the LATEST estimate sits against the best one — a real ratio of two real
  // numbers, once both are known to come from the same population.
  const latestE1rm = series.length ? series[series.length - 1].e1rm : null
  // …and it is NULL when there is nothing to compare: no best estimate (the card is an em
  // dash — a bar under a missing number would be painting a figure that is not there), or a
  // best with an empty series, where a full bar would silently claim „you are at your peak
  // right now". An unfilled rail says the true thing: this comparison cannot be made.
  const e1rmShare = seriesOwnsRecord && latestE1rm != null
    ? Math.min(100, (latestE1rm / bestE1rm!) * 100)
    : null

  const authorStamp = item?.authoredByMe
    ? 'Saját'
    : item?.authorName
      ? `Közös · ${item.authorName}`
      : null

  return (
    <MozaikPage tone={tone}>
      <PageHead onBack={goBack} label="‹ Gyakorlatok" />
      <EntranceGroup>
        <header className="pl-dhero gy-hero rise" style={{ ...accent, ...delay(40) }}>
          <span className="pl-dhero-wash" aria-hidden="true" />
          <span className="gy-hero-art" aria-hidden="true">
            <MuscleChip token={row.muscle} size={68} className="icon" />
            <i />
            <i />
          </span>
          <span className="pl-dhero-tag tr-eyebrow">{row.muscleLabel}</span>
          <h2>{row.name}</h2>
          {/* The authorship stamp — server-derived, and the app's FIRST renderer for it. */}
          {authorStamp && <p className="pl-sub-say">{authorStamp}</p>}
          {record ? (
            <div className="pl-poster-foot">
              <span>{record.sessionCount} alkalom</span>
              {/* An absolute „óta" only when the series covers the whole history; a bounded
                  one says so (see `sinceFact`) rather than passing a window start off as a start. */}
              {since && (
                <span>
                  {since.kind === 'since'
                    ? `${huMonthDayAged(since.date)} óta`
                    : `ebből az utolsó ${since.sessions} látszik`}
                </span>
              )}
              {/* A bodyweight exercise really has moved 0 kg — that is not a missing
                  figure to em-dash, it is a different fact, so it says the true one. */}
              {record.totalVolume > 0
                ? <span>{volumeLabel(record.totalVolume)} összsúly</span>
                : <span>{huInt(record.totalReps)} ismétlés</span>}
            </div>
          ) : (
            <p className="pl-say">
              Ezzel a gyakorlattal még nincs naplózott alkalmad — az első edzés után itt gyűlnek a rekordjaid.
            </p>
          )}
        </header>

        <PageBody className="pl-sub">
          {record && (
            <>
              <h3 className="pl-h3">
                Rekordjaid
                <InfoButton
                  title="Mi számít rekordnak?"
                  copy="A legjobb szett a legnagyobb súly a hozzá tartozó ismétléssel. A becsült maximum egy képletből jön a szettjeidből — becslés, nem mérés. A volumen egy alkalom összes megmozgatott súlya."
                />
              </h3>
              <div className="gy-recs rise" style={{ ...accent, ...delay(70) }}>
                <div className="gy-rec">
                  <span className="tr-eyebrow">Becsült 1RM</span>
                  <strong>{hasE1rm ? <>{hu1(bestE1rm!)} <small>kg</small></> : '—'}</strong>
                  {hasE1rm && (
                    <i className="gy-rec-bar">
                      {e1rmShare != null && <b style={{ '--w': `${e1rmShare}%` } as CSSProperties} />}
                    </i>
                  )}
                  {e1rmDelta != null && <small>+{hu1(e1rmDelta)} kg a korábbi csúcsod óta</small>}
                  {/* The caption belongs to the FIGURE — under an em dash it would caption
                      a number that is not there. */}
                  {hasE1rm && <small>Becslés, nem mérés</small>}
                </div>
                <div className="gy-rec">
                  <span className="tr-eyebrow">Legjobb szett</span>
                  <strong>
                    {record.bestSet
                      ? record.bestSet.weightKg != null && record.bestSet.weightKg > 0
                        ? <>{hu1(record.bestSet.weightKg)} <small>kg × {record.bestSet.reps}</small></>
                        : <>{record.bestSet.reps} <small>ismétlés</small></>
                      : '—'}
                  </strong>
                  {/* Same rule as the 1RM card above: no figure ⇒ no rail, no fill, no
                      caption. The full bar means „ez A rekord" — under an em dash it would
                      be painting a record that does not exist, and the date caption would
                      be an em dash captioning an em dash. */}
                  {record.bestSet && (
                    <>
                      <i className="gy-rec-bar"><b style={{ '--w': '100%' } as CSSProperties} /></i>
                      <small>{huMonthDayAged(record.bestSet.date)}</small>
                    </>
                  )}
                </div>
                <div className="gy-rec">
                  <span className="tr-eyebrow">Legtöbb volumen</span>
                  <strong>
                    {record.bestSessionVolume
                      ? <>{huInt(record.bestSessionVolume.volumeKg)} <small>kg × rep</small></>
                      : '—'}
                  </strong>
                  {record.bestSessionVolume && (
                    <>
                      <i className="gy-rec-bar"><b style={{ '--w': '100%' } as CSSProperties} /></i>
                      <small>
                        {`${huMonthDayAged(record.bestSessionVolume.date)} a csúcs · ${volumeLabel(record.totalVolume)} összesen`}
                      </small>
                    </>
                  )}
                </div>
              </div>

              {target && (
                // A TARGET, not a forecast: the app is not predicting this, it is naming
                // the smallest next step past a record you already hold.
                <p className="gy-next rise" style={{ ...accent, ...delay(100) }}>
                  <ClayIcon name="i-erme" size={20} className="icon" />
                  <span>
                    Következő cél:{' '}
                    <b>{target.kg != null ? `${hu1(target.kg)} kg × ${target.reps}` : `${target.reps} ismétlés`}</b>
                    {' '}— {target.note}.
                  </span>
                </p>
              )}

              <h3 className="pl-h3">
                Az erőd íve
                <InfoButton
                  title="Mit mutat a vonal?"
                  copy="A becsült egyismétléses maximumod alakulása alkalomról alkalomra. A szaggatott rész a terv várakozása a következő hetekre — becslés, nem ígéret."
                />
              </h3>
              <div className="rise" style={{ ...accent, ...delay(130) }}>
                <StrengthCurve points={series} />
              </div>
            </>
          )}

          <h3 className="pl-h3">Medáljaid</h3>
          {myMedals.length > 0 ? (
            <div className="gy-medal-rows rise" style={delay(160)}>
              {myMedals.map((m, i) => (
                <span key={`${m.date}-${m.type}-${i}`} className="gy-medal">
                  <ClayIcon name="i-erme" size={24} className="icon" />
                  <span>
                    <strong>{MEDAL_TYPE_LABEL[m.type] ?? m.type}</strong>
                    <small>{medalValueLabel(m)}</small>
                  </span>
                  <small className="gy-medal-date">{huMonthDayAged(m.date)}</small>
                </span>
              ))}
            </div>
          ) : (
            <p className="pl-foot-say">Ezen a gyakorlaton még nincs medálod.</p>
          )}

          <h3 className="pl-h3">Hol szerepel</h3>
          {usedPending ? (
            <Skeleton variant="card" height={56} />
          ) : used.days.length + used.templates.length === 0 ? (
            <p className="pl-foot-say">Ez a gyakorlat most egyetlen tervedben és sablonodban sem szerepel.</p>
          ) : (
            <div className="rise" style={delay(190)}>
              {used.days.map((d) => (
                <button
                  key={`${d.mesoId}-${d.day}`}
                  type="button"
                  className="pl-row"
                  onClick={() => navigate(`/train/mesocycles/${d.mesoId}/days/${encodeURIComponent(d.day)}`)}
                >
                  <span><strong>{d.type}</strong><small>A futó tervedben · {d.day}</small></span>
                  <b aria-hidden="true">›</b>
                </button>
              ))}
              {used.templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="pl-row"
                  onClick={() => navigate(`/train/templates/${t.id}`)}
                >
                  <span><strong>{t.name}</strong><small>Sablon a polcodon</small></span>
                  <b aria-hidden="true">›</b>
                </button>
              ))}
            </div>
          )}

          {/* The authoring half — only what the server says this viewer may do. Nothing
              renders at all for a read-only row, so the section cannot promise an
              affordance that would come back 403. */}
          {item && (item.editable || item.mediaEditable) && (
            <>
              <h3 className="pl-h3">Gyakorlat kezelése</h3>
              <div className="rise" style={delay(220)}>
                {item.editable && (
                  <button type="button" className="pl-row" onClick={() => setEditing(true)}>
                    <span><strong>Szerkesztés</strong><small>Név, izom, típus — és a törlés</small></span>
                    <b aria-hidden="true">›</b>
                  </button>
                )}
                {item.mediaEditable && (
                  <button type="button" className="pl-row" onClick={() => setVideoing(true)}>
                    <span>
                      <strong>Demó videó</strong>
                      <small>{item.videoUrl ? 'Csere vagy eltávolítás' : 'Még nincs videó — tegyél fel egyet'}</small>
                    </span>
                    <b aria-hidden="true">›</b>
                  </button>
                )}
              </div>
            </>
          )}
        </PageBody>
      </EntranceGroup>

      {editing && item && (
        // A DELETE from this sheet removes the row this route names; the page then falls
        // to its own „nincs a tárban" ghost above, which still carries the back pill.
        // No redirect is fired from here: the catalogue query is invalidated by the
        // mutation, and reading a stale closure to decide would be guessing.
        <CatalogExerciseSheet edit={item} onClose={() => setEditing(false)} />
      )}
      {videoing && item && (
        <VideoUrlSheet
          exercise={{ id: item.catalogId ?? item.id, name: item.name, videoUrl: item.videoUrl ?? null }}
          onClose={() => setVideoing(false)}
        />
      )}
    </MozaikPage>
  )
}
