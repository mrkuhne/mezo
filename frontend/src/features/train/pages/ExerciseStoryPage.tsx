// ============================================================
// Mezo · ExerciseStoryPage — ONE exercise's whole story at `/train/exercises/:key`.
//
// Train parity P2 Task 5 (mezo-lf3cv), first ported from the Titanium prototype's exercise detail. Until this
// page existed, Task 4's catalogue routed every card here and the router's catch-all
// dropped the reader on `/nap`; and the ONLY per-exercise story production had was the
// pre-Titanium `REKORDOK` modal (`sheets/ExerciseRecordSheet.tsx`, retired with this
// commit — this page is its replacement, and it had no other caller).
//
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `exercise()`), top to bottom:
//   hero                 the muscle chip, „{izom} · Saját / Közös · {név}" as the label (the
//                        AUTHORSHIP stamp, server-derived), the NEXT TARGET as the verdict
//                        (`nextTarget` over the real best set — a target, not a forecast), the
//                        three facts `N alkalom · <dátum> óta · N t összsúly` in the support
//                        line, and `StrengthCurve` (the liquid area with the „now" mark and the
//                        record drops). The middle fact is only an absolute date when the series
//                        covers the whole history; a wire-capped series says „ebből az utolsó N
//                        látszik" instead (`sinceFact`). A never-logged exercise gets its own
//                        empty-state sentence and the empty vessel.
//   Rekordjaid           three rows. Every absent figure is an EM DASH — a record you do not
//                        have is never a 0.
//   Medáljaid            this exercise's medals, filtered from `useMedals`.
//   Hol szerepel         the running plan's days + the shelf's templates that prescribe it,
//                        derived client-side (`whereUsed`) — no endpoint.
//   Gyakorlat kezelése   the AUTHORING row(s) — see below.
//
// NOT here, deliberately: a technique sheet and „alternatives" (nothing in production carries
// per-exercise cue text or a substitution model), and a projected branch on the curve.
//
// THREE capabilities that had no reachable home after Task 4 retired the old catalogue
// shell, and that live here now (the house rule: no feature dies silently):
//   · per-exercise EDIT/DELETE → `CatalogExerciseSheet` in edit mode, offered ONLY when
//     the server says `editable` (it is server-derived per viewer; the FE never reasons
//     about roles, and an absent flag — the mock-mode static seed — means no).
//   · the DEMO-VIDEO url → `VideoUrlSheet`, gated the same way on `mediaEditable`.
//     WATCHING a demo already survives elsewhere (the workout card glass, the picker);
//     this is the AUTHORING half, and it is one quiet row that also states whether a
//     video is attached.
//   · the `Saját` / `Közös · {név}` AUTHORSHIP stamps (`authoredByMe` / `authorName`,
//     mapped in trainHooks.ts since mezo-qw37.5 and rendered nowhere in the app until
//     now) — they sit in the hero, where the exercise says who it belongs to.
//
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMedals, useMesoTemplates, useTrain } from '@/data/hooks'
import { huMonthDayAged } from '@/shared/lib/dates'
import { hu1, huInt } from '@/shared/lib/huNum'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { InfoButton } from '@/features/train/components/InfoButton'
import { StrengthCurve } from '@/features/train/components/StrengthCurve'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { CatalogExerciseSheet } from '@/features/train/sheets/CatalogExerciseSheet'
import { VideoUrlSheet } from '@/features/train/sheets/VideoUrlSheet'
import {
  buildLibraryRows, exerciseKey, medalsForExercise, nextTarget, sinceFact, whereUsed,
} from '@/features/train/logic/exerciseLibrary'
import { MedalRow } from '@/features/train/components/folyadek'
import {
  Acts, Card, EmptyTank, FrameBack, Hero, Level, Note, Page, Row, Section, Skel, useFrameTitle,
} from '@/shared/ui/folyadek'

/** Volume in reader units: tonnes above 1 t, whole kg below it. */
const volumeLabel = (kg: number) => (kg >= 1000 ? `${hu1(kg / 1000)} t` : `${huInt(kg)} kg`)

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

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
  const pendingAll = exercisesPending || medalsPending
  const rows = pendingAll ? [] : buildLibraryRows(exerciseLibrary, exerciseRecords, medals)
  const row = rows.find((r) => r.key === key)
  useFrameTitle({ title: row?.name ?? 'Gyakorlat', eyebrow: 'Gyakorlatok' })
  const back = <FrameBack className="fo-backpill" onBack={goBack}>‹ Gyakorlatok</FrameBack>

  if (pendingAll) return <Page className="er-page">{back}<Skel blocks={[260, 78, 78, 78]} /></Page>

  if (!row) {
    return (
      <Page className="er-page">
        {back}
        <Card><EmptyTank icon="t-other">Ez a gyakorlat nincs a tárban.</EmptyTank></Card>
      </Page>
    )
  }

  const item = exerciseLibrary.find((e) => exerciseKey(e) === row.key)
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

  // The record drops on the curve: the days an estimated-1RM record was set on this exercise.
  const recordDates = myMedals.filter((m) => m.type === 'E1RM').map((m) => m.date)

  const facts = record ? [
    `${record.sessionCount} alkalom`,
    // An absolute „óta" only when the series covers the whole history; a bounded one says so
    // (see `sinceFact`) rather than passing a window start off as a start.
    since && (since.kind === 'since' ? `${huMonthDayAged(since.date)} óta` : `ebből az utolsó ${since.sessions} látszik`),
    // A bodyweight exercise really has moved 0 kg — that is not a missing figure to em-dash,
    // it is a different fact, so it says the true one.
    record.totalVolume > 0 ? `${volumeLabel(record.totalVolume)} összsúly` : `${huInt(record.totalReps)} ismétlés`,
  ].filter(Boolean).join(' · ') : ''
  const heroLabel = authorStamp ? `${row.muscleLabel} · ${authorStamp}` : row.muscleLabel
  const canManage = !!item && (item.editable || item.mediaEditable)
  let n = 0

  return (
    <Page className="er-page er-cards">
      {back}
      {record ? (
        <Hero
          label={heroLabel}
          // A TARGET, not a forecast: the app is not predicting this, it is naming the
          // smallest next step past a record you already hold.
          verdict={target
            ? `Következő cél: ${target.kg != null ? `${hu1(target.kg)} kg × ${target.reps}` : `${target.reps} ismétlés`}.`
            : `${record.sessionCount} naplózott alkalom.`}
          sub={target ? `${cap(target.note)}. · ${facts}` : facts}
          left={<Mchp muscle={row.muscle} />}
          actions={(
            <InfoButton
              eyebrow="Az erőd íve"
              title="Mit mutat a vonal?"
              copy="A becsült egyismétléses maximumod alakulása alkalomról alkalomra. Becslés, nem mérés."
            />
          )}
        >
          <StrengthCurve points={series} muscle={row.muscle} recordDates={recordDates} />
        </Hero>
      ) : (
        <Hero
          label={heroLabel}
          verdict="Ezzel a gyakorlattal még nincs naplózott alkalmad."
          sub="Az első edzés után itt gyűlnek a rekordjaid."
          left={<Mchp muscle={row.muscle} />}
        >
          <StrengthCurve points={[]} />
        </Hero>
      )}

      {record && (
        <>
          <Section n={++n} title="Rekordjaid" />
          <Card>
            <Row
              icon="t-ring"
              title="Becsült 1RM"
              // The caption belongs to the FIGURE — under an em dash it would caption a
              // number that is not there.
              sub={[e1rmDelta != null && `+${hu1(e1rmDelta)} kg a korábbi csúcsod óta`, hasE1rm && 'Becslés, nem mérés'].filter(Boolean).join(' · ') || undefined}
              more={e1rmShare != null && (
                <span className="fo-rowbar"><Level pct={e1rmShare} color={deepMuscle(row.muscle)} height={10} /></span>
              )}
              value={hasE1rm ? `${hu1(bestE1rm!)} kg` : '—'}
            />
            <Row
              icon="t-weight"
              title="Legjobb szett"
              sub={record.bestSet ? huMonthDayAged(record.bestSet.date) : undefined}
              value={record.bestSet
                ? record.bestSet.weightKg != null && record.bestSet.weightKg > 0
                  ? `${hu1(record.bestSet.weightKg)} kg × ${record.bestSet.reps}`
                  : `${record.bestSet.reps} ismétlés`
                : '—'}
            />
            <Row
              icon="t-protocol"
              title="Legtöbb volumen"
              sub={record.bestSessionVolume
                ? `${huMonthDayAged(record.bestSessionVolume.date)} a csúcs · ${volumeLabel(record.totalVolume)} összesen`
                : undefined}
              value={record.bestSessionVolume ? `${huInt(record.bestSessionVolume.volumeKg)} kg × rep` : '—'}
            />
            <Acts>
              <InfoButton
                eyebrow="Rekordjaid"
                title="Mi számít rekordnak?"
                copy="A legjobb szett a legnagyobb súly a hozzá tartozó ismétléssel. A becsült maximum egy képletből jön a szettjeidből — becslés, nem mérés. A volumen egy alkalom összes megmozgatott súlya."
              />
            </Acts>
          </Card>
        </>
      )}

      <Section n={++n} title="Medáljaid" />
      <Card>
        {myMedals.length > 0
          ? myMedals.map((m, i) => <MedalRow key={`${m.date}-${m.type}-${i}`} medal={m} titled="type" date={huMonthDayAged(m.date)} />)
          : <Note className="er-none">Ezen a gyakorlaton még nincs medálod.</Note>}
      </Card>

      <Section n={++n} title="Hol szerepel" />
      {usedPending ? (
        <Skel blocks={[78]} />
      ) : (
        <Card>
          {used.days.length + used.templates.length === 0 && (
            <Note className="er-none">Ez a gyakorlat most egyetlen tervedben és sablonodban sem szerepel.</Note>
          )}
          {used.days.map((d) => (
            <Row
              key={`${d.mesoId}-${d.day}`}
              icon="t-peak"
              title={d.type}
              sub={`A futó tervedben · ${d.day}`}
              onClick={() => navigate(`/train/mesocycles/${d.mesoId}/days/${encodeURIComponent(d.day)}`)}
            />
          ))}
          {used.templates.map((t) => (
            <Row
              key={t.id}
              icon="t-stack"
              title={t.name}
              sub="Sablon a polcodon"
              onClick={() => navigate(`/train/templates/${t.id}`)}
            />
          ))}
        </Card>
      )}

      {/* The authoring half — only what the server says this viewer may do. Nothing
          renders at all for a read-only row, so the section cannot promise an
          affordance that would come back 403. */}
      {canManage && (
        <>
          <Section n={++n} title="Gyakorlat kezelése" />
          <Card>
            {item.editable && (
              <Row icon="t-note" title="Szerkesztés" sub="Név, izom, típus — és a törlés" onClick={() => setEditing(true)} />
            )}
            {item.mediaEditable && (
              <Row
                icon="t-camera"
                title="Demó videó"
                sub={item.videoUrl ? 'Csere vagy eltávolítás' : 'Még nincs videó — tegyél fel egyet'}
                onClick={() => setVideoing(true)}
              />
            )}
          </Card>
        </>
      )}

      {editing && item && (
        // A DELETE from this sheet removes the row this route names; the page then falls
        // to its own „nincs a tárban" face above, which still carries the back control.
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
    </Page>
  )
}
