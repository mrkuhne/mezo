// ============================================================
// Mezo · MesoDayPage — ONE day of the running block, on its own route
// (/train/mesocycles/:id/days/:day — the day token is URL-encoded, e.g. H%C3%A9t).
// Train Titanium T9 Task 4 (mezo-88iwa.10): the day opens on a body-map hero, not the
// older PageHero letter tile — `.pl-dhero`, ported from the prototype's `planDay`
// (docs/design_2.0/prototypes/companion-titanium/plan-pages.js:133-190): a full-bleed
// poster in the day's tone carrying `BodyMap` (views="auto", heat = the day's own
// muscles, all at 'in' — this is a single session, not a week-long fatigue read) in
// the art slot, the day's working-set count as the one dominant numeral, and pills
// (calibrated minutes, exercise count, the week-share drawn as a mini bar + words —
// never a bare percent). Below the poster: `.pl-mrows`, one line per muscle worked
// (icon, name, a bar to the shared session-cap marker, the set count) — this page's own
// answer to the old `StatStrip`/`StatCell` pair, now graphic instead of numeric tiles.
// Then `.pl-exs`, the exercise VIEW cells — index + `MuscleChip` + name + the 4-cell
// labelled prescription grid (szett×ismétlés tinted by muscle color, RIR, kg induló,
// bemelegítő), read-only and rendered from the same `day.exercises` rows the day editor
// route edits. This is BodyMap's first in-plan consumer.
// Honest words, not placeholders: 0 kg reads "saját testsúly" (not a dash — the model
// really has no weight to track there), and a plank-style hold (repMin AND repMax both
// 0) reads "tartás" in the szett×ismétlés cell instead of a nonsense "0–0" range.
// Train parity P1 Task 4 (mezo-e1ii9): the page is ONLY this. A whole pre-Titanium
// editor used to be welded onto the bottom of it — ⠿ drag handles, 🔥, English
// Grow/Maintain/Emphasize tier words, the `HETI SZETEK` typo, `⚠ 1 jelzés`,
// `CSÚCSHÉT · IDŐBECSLÉS`, `STRUKTÚRA`, a duplicate exercise list and a duplicate
// add-CTA. Nothing was deleted, it MOVED: the same `MesoExercises` (which owns the PUT
// …/days/{dayId}/exercises save path) now renders on its own route,
// /train/mesocycles/:id/days/:day/edit (`MesoDayEditPage`), the way the TEMPLATE's day
// plan is edited at /train/mesocycles/templates/:id. The page's tail carries the
// prototype's `.pl-add` into it (with `?add=1`, so the picker opens on arrival) plus a
// quiet „A nap szerkesztése" link for everything else the editor does.
// A real ROUTE, not page state: a day is a place you can link to, come back to and
// hit back out of — the wizard's ProgramDayView is page state because its draft is
// not saved anywhere yet; this one edits a persisted run.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTrain, useTimingProfile } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { MozaikPage, PageBody, PageHead, type PageTone } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { BodyMap, type BodyHeat } from '@/features/train/components/BodyMap'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { InfoButton } from '@/features/train/components/InfoButton'
import { huKg } from '@/features/train/logic/mesoDates'
import type { DayTone } from '@/features/train/logic/mesoLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { SESSION_CAP_PIN_PCT, daySessionBreakdown, sessionBarPct } from '@/features/train/logic/setBudget'
import { dayTileData } from '@/features/train/wizard/dayTiles'

const TONE: Record<string, PageTone> = { coral: 'coral', sage: 'sage', rose: 'rose', gold: 'gold' }

/** The poster's `--mus-color` per day tone — the house's own semantic tones (mesoLoad's
 *  `dayTone`), never the prototype's per-muscle `--mus-color`: the hero is one card for
 *  the whole day, so it carries the DAY's tone the way `.pl-poster`/`.pl-day` already do. */
const DAY_ACCENT: Record<DayTone, string> = {
  coral: 'var(--coral)', sage: 'var(--sage)', rose: 'var(--rose)', gold: 'var(--amber)',
}


/** Same shape as the sibling week/muscle pages' skeletons — real mode has no block until the
 *  list query lands, and a ghost („nincs a blokkban") shown in that window would call every
 *  valid deep link a dead one for a beat. Mirrors the poster + mrows + ex-cells anatomy below
 *  (T9 Task 4) so the loading state doesn't jump when the real content lands. */
function DaySkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <Skeleton width={90} height={12} style={{ margin: '12px 0 0 24px' }} />
      <Skeleton height={220} style={{ margin: '10px 0 14px' }} />
      <div className="col gap-sm" style={{ padding: '0 24px 24px' }}>
        <Skeleton width={150} height={11} />
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={`m${i}`} height={22} />)}
        <Skeleton width={150} height={11} style={{ marginTop: 12 }} />
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={`e${i}`} variant="card" height={98} />)}
      </div>
    </div>
  )
}

export function MesoDayPage() {
  const { id, day: dayParam } = useParams<{ id: string; day: string }>()
  const navigate = useNavigate()
  const goBack = useBackNav(`/train/mesocycles/${id}`)
  const { mesocycles, workoutPending } = useTrain()
  // Calibrated pacing (Task 12, mezo-dzbm) for the hero's minutes pill (fetched here —
  // before either early return below, since hooks must run unconditionally).
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()

  const meso = mesocycles.find((m) => m.id === id)
  const day = meso?.days?.find((d) => d.day === dayParam)

  // Real mode: the block list is still in flight — wait, do not accuse the link.
  if (workoutPending) return <DaySkeleton />

  // A RESOLVED block without this day is a dead link, and says so instead of rendering an
  // empty editor.
  if (!meso || !day) {
    return (
      <MozaikPage tone="coral">
        <PageHead glass onBack={goBack} label="A terved" />
        <PageBody className="tv-day-page">
          <GhostState message={meso ? 'Ez a nap nincs a tervedben.' : 'Ez a mesociklus nem található.'} />
        </PageBody>
      </MozaikPage>
    )
  }

  const tile = dayTileData(day)
  const muscleRows = daySessionBreakdown(day)
  // The day's own muscles, ALL at 'in' — a single session isn't a fatigue read against a
  // week-long budget (that's the muscle detail page's `.pl-scale-bar` job); the hero just
  // says "this is what today touches".
  const heat: BodyHeat[] = muscleRows.map((r) => ({ token: r.colorMuscle, level: 'in' }))
  // Held at 0 (the "no minutes yet" treatment) while the profile fetch is pending — never
  // the static fallback, which would render then swap under the user (MesoEditor's own rule).
  const minutes = timingProfilePending ? 0 : estimateSessionMinutes(day.exercises, timingProfile ?? undefined)
  const weekSets = (meso.days ?? []).reduce((a, d) => a + d.exercises.reduce((s, e) => s + e.workingSets, 0), 0)
  const share = weekSets > 0 ? Math.round((tile.sets / weekSets) * 100) : 0
  const accent = DAY_ACCENT[tile.tone]

  return (
    <MozaikPage tone={TONE[tile.tone]}>
      <PageHead glass onBack={goBack} label="A terved" />
      <EntranceGroup>
        {/* The day, as a poster: eyebrow, the body-map spot graphic, one dominant numeral. */}
        <section className="pl-dhero rise" style={{ '--mus-color': accent } as CSSProperties}>
          <span className="pl-dhero-wash" aria-hidden="true" />
          {/* Not aria-hidden — unlike the prototype's decorative icon slot, BodyMap carries
              its own accessible role="img"/aria-label and is the real content here. */}
          <span className="pl-dhero-art">
            <BodyMap heat={heat} views="auto" ariaLabel={`${day.type} nap — érintett izmok`} />
          </span>
          <span className="pl-dhero-tag tr-eyebrow">{day.day.toUpperCase()} · A TERV {meso.currentWeek}. HETE</span>
          <h2>{day.type} nap</h2>
          <div className="pl-dhero-number"><strong>{tile.sets}</strong><small>szett</small></div>
          <div className="pl-dhero-pills">
            <span>{minutes} perc</span>
            <span>{day.exercises.length} gyakorlat</span>
            <span className="pl-share">
              <i style={{ '--w': `${Math.min(100, share)}%` } as CSSProperties}><b /></i>
              a heted {share}%-a
            </span>
          </div>
        </section>

        <PageBody className="tv-day-page">
          {/* The per-muscle breakdown: icon, name, a bar to the shared session-cap marker,
              count. Both the track's scale and the marker's position come from
              SESSION_MUSCLE_CAP (setBudget.ts) — neither number is written here. */}
          {muscleRows.length > 0 && (
            <>
              <h3 className="pl-h3 rise">
                Mit terhel ez a nap
                <InfoButton
                  title="Miért nyolcnál a jelölés?"
                  copy="Egy izomra egy edzésen belül nagyjából nyolc szett fölött már nem hoz többet a munka. Nem tiltás — csak egy jelölés, hogy lásd, hol jársz."
                />
              </h3>
              <div className="pl-mrows">
                {muscleRows.map((r) => (
                  <div
                    key={r.group}
                    className="pl-mrow rise"
                    style={{ '--mus-color': muscleColor(r.colorMuscle).rail } as CSSProperties}
                  >
                    <span className="pl-mrow-art"><MuscleChip token={r.colorMuscle} size={28} /></span>
                    <span className="pl-mrow-name">{r.label}</span>
                    <span className="pl-mrow-bar">
                      <i style={{ '--w': `${sessionBarPct(r.sets)}%` } as CSSProperties} />
                      <u style={{ '--at': `${SESSION_CAP_PIN_PCT}%` } as CSSProperties} />
                    </span>
                    <span className="pl-mrow-count">{r.sets}<i>szett</i></span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* The exercise VIEW cells — read-only, rendered from the SAME rows the editor
              below edits. Index + MuscleChip + name + the 4-cell prescription grid. */}
          {day.exercises.length > 0 && (
            <>
              <h3 className="pl-h3 rise">
                A nap gyakorlatai
                <InfoButton
                  title="Mikortól él a változtatás?"
                  copy="Amit itt átírsz, a következő edzésedtől számít. A most futó edzésedet nem írja át — azt végigviszed úgy, ahogy elkezdted."
                />
              </h3>
              <div className="pl-exs">
                {day.exercises.map((e, i) => {
                  const isHold = e.repMin === 0 && e.repMax === 0
                  const bodyweight = e.anchorWeightKg === 0
                  return (
                    <div
                      key={e.id}
                      className="pl-ex glass rise"
                      style={{ '--ex-color': muscleColor(e.muscle).rail } as CSSProperties}
                    >
                      <span className="pl-ex-index">{String(i + 1).padStart(2, '0')}</span>
                      <span className="pl-ex-art"><MuscleChip token={e.muscle} size={38} /></span>
                      <span className="pl-ex-copy">
                        <strong>{e.name}</strong>
                        <small>{MUSCLE_LABELS[e.muscle] ?? e.muscle}</small>
                      </span>
                      <span className="pl-ex-grid">
                        <span className="is-main">
                          <b>{e.workingSets} × {isHold ? 'tartás' : `${e.repMin}–${e.repMax}`}</b>
                          <i>szett × ismétlés</i>
                        </span>
                        <span><b>{e.targetRIR}</b><i>RIR</i></span>
                        <span>
                          <b>{bodyweight ? 'saját testsúly' : e.anchorWeightKg != null ? huKg(e.anchorWeightKg) : '—'}</b>
                          <i>kg induló</i>
                        </span>
                        <span><b>{e.warmupSets || '—'}</b><i>bemelegítő</i></span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* The prototype's end-of-screen affordance (`.pl-add`), and the ONLY one here:
              the editing itself lives on its own route (MesoDayEditPage), the way the
              template's day plan does. `?add=1` opens the picker on arrival so this button
              still adds an exercise. */}
          <div className="pl-dayfoot rise">
            <button
              type="button"
              className="pl-add"
              onClick={() => navigate(`/train/mesocycles/${meso.id}/days/${encodeURIComponent(day.day)}/edit?add=1`)}
            >
              ＋ Gyakorlat hozzáadása
            </button>
            <button
              type="button"
              className="pl-editlink"
              onClick={() => navigate(`/train/mesocycles/${meso.id}/days/${encodeURIComponent(day.day)}/edit`)}
            >
              A nap szerkesztése
            </button>
          </div>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
