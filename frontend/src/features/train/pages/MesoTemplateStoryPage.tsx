// ============================================================
// Mezo · MesoTemplateStoryPage — ONE template, read-first, at /train/templates/:id.
//
// Train Titanium T10 Task 3 (mezo-88iwa.11). A NEW page: until now a template's only own
// surface was the raw day-plan EDITOR (/train/mesocycles/templates/:id) — you could not
// look at a recipe without standing in the form that edits it. Ported from the
// prototype's `planLibraryTemplate`
// (docs/design_2.0/prototypes/companion-titanium/plan-pages.js:456-515):
//   hero          — `.pl-lhero` with the back pill docked inside (→ Sablonjaid), the
//                   split as the eyebrow, the name, one plain sentence carrying
//                   hét × edzésnap, and the muscles as `MuscleChip` minis.
//   „A hét felépítése" — one `.pl-lib-card.is-open` per TRAINING day, every exercise
//                   spelled out in a `.pl-tpl-ex` row (muscle chip, name, szett×ismétlés,
//                   induló súly). Rest/sport days stay as quiet `.pl-row.is-quiet` lines
//                   — a week is also its off days, and hiding them would misread the
//                   split. Honest words, the MesoDayPage rule: a hold (repMin AND repMax
//                   both 0) reads „tartás", 0 kg reads „saját testsúly".
//   „Heti szettek izmonként" — `.pl-wload` bars over `templateWeekSets` (the shared
//                   `daySessionBreakdown` summed across the week — never inline page
//                   math), scaled to the biggest muscle's own total.
//   „Futamok ebből a sablonból" — `.pl-row` list over `templateRuns`: the running one →
//                   the Terv landing, a queued one → its own page (the builder, whose
//                   dated „Aktiválás" CTA is the deliberate path — the Task 2 lesson),
//                   a closed one → its FROZEN report. No run yet says so in one line.
//   CTAs          — „Futam indítása ebből" opens the ONE shared `MesoStartSheet` (the
//                   same POST …/start flow the DS template cards fired), „Szerkesztés"
//                   opens the raw editor. Under them the lifecycle pair the DS list card
//                   carried behind ⋯ — Másolat (createTemplate from this template's own
//                   document → the copy's editor) and Törlés (two-tap confirm, a soft
//                   delete that leaves past runs and their reports untouched) — so the
//                   reface made nothing unreachable (the T4 lesson).
//
// A bad/stale :id is a dead link and says so (the MesoDayPage idiom: page head + a
// GhostState line), never an empty page pretending to be a template.
// ============================================================
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import type { MesoDay, MesoTemplate } from '@/data/types'
import { ClayIcon } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { BodyMap, type BodyHeat } from '@/features/train/components/BodyMap'
import { huKg } from '@/features/train/logic/mesoDates'
import { isLegacyPlan } from '@/features/train/logic/mesoPlan'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { InfoButton } from '@/features/train/components/InfoButton'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import {
  splitLabel,
  templateRuns,
  templateSessionMinutes,
  templateWeekSets,
  trainingDayCount,
} from '@/features/train/logic/libraryStory'
import { huDate } from '@/features/train/logic/mesoDates'
import { toDayInputs } from '@/features/train/logic/mesoDays'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { isOffDay } from '@/features/train/logic/offDay'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** Fixed one decimal: `hu1` strips a trailing ",0", which reads as a typo next to `2,7 volt`. */

/** Working sets on one day — the card's own fact box (the weekly bars below do the
 *  budget-aware sum; this is just "how much work is this session"). */
const daySets = (day: MesoDay) => day.exercises.reduce((n, e) => n + e.workingSets, 0)

/** Mirrors the real page's geometry: hero → two day cards → the bars → two rows. */
function TemplateStorySkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <Skeleton height={230} radius={0} />
      <div className="col gap-sm" style={{ padding: '14px 17px 19px' }}>
        <Skeleton width={150} height={11} />
        {Array.from({ length: 2 }, (_, i) => <Skeleton key={`d${i}`} variant="card" height={150} radius={20} />)}
        <Skeleton width={170} height={11} style={{ marginTop: 12 }} />
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={`m${i}`} height={22} />)}
        <Skeleton width={170} height={11} style={{ marginTop: 12 }} />
        {Array.from({ length: 2 }, (_, i) => <Skeleton key={`r${i}`} height={58} radius={16} />)}
      </div>
    </div>
  )
}

export function MesoTemplateStoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { templates, pending, createTemplate, createPending, deleteTemplate, deletePending } = useMesoTemplates()
  const { mesocycles, workoutPending } = useTrain()
  const [startOpen, setStartOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteRowRef = useRef<HTMLDivElement>(null)

  const goBack = () => navigate('/train/templates')

  // Care on Törlés (Task 3 fix round, mezo-88iwa.11): the armed confirm auto-disarms the
  // moment the user taps anything else on the page — a capture-phase document listener
  // (simplest reliable option) rather than threading a click handler through MozaikPage,
  // which accepts no such prop.
  useEffect(() => {
    if (!confirmDelete) return
    const onDocClick = (e: MouseEvent) => {
      if (!deleteRowRef.current?.contains(e.target as Node)) setConfirmDelete(false)
    }
    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
  }, [confirmDelete])

  // Real mode: the lists are still in flight — wait, do not accuse the link.
  if (pending || workoutPending) return <TemplateStorySkeleton />

  const template = templates.find((t) => t.id === id)

  // A RESOLVED list without this template is a dead link, and says so.
  if (!template) {
    return (
      <MozaikPage tone="gold">
        <PageHead onBack={goBack} label="‹ Sablonjaid" />
        <PageBody className="tv-tpl">
          <GhostState message="Ez a sablon nem található." />
        </PageBody>
      </MozaikPage>
    )
  }

  const days = template.days ?? []
  const trainingDays = trainingDayCount(template)
  const split = splitLabel(template)
  const muscles = templateWeekSets(template)
  const topSets = Math.max(1, ...muscles.map((m) => m.sets))
  const minutes = templateSessionMinutes(template)
  const runs = templateRuns(template.id, template.title, mesocycles)
  // Highlighted = trained by this template — a flat 'in' level (the MesoDayPage idiom for
  // "this muscle is in the plan", not a graded weekly load like TrainWeekPage's map).
  const heat: BodyHeat[] = muscles.map((m) => ({ token: m.colorMuscle, level: 'in' }))

  const openEditor = (templateId: string) => navigate(`/train/mesocycles/templates/${templateId}`)
  // Failed mutations are toasted globally (§7a) — the handlers have nothing richer to add.
  const duplicate = (t: MesoTemplate) => {
    createTemplate({
      title: `${t.title} (másolat)`,
      shortTitle: t.shortTitle,
      goal: t.goal,
      goalPreset: t.goalPreset,
      musclePriorities: t.musclePriorities,
      weeks: t.weeks,
      split: t.split,
      style: t.style,
      phaseCurve: t.phaseCurve,
      notes: t.notes,
      volumePerMuscle: t.volumePerMuscle,
      days: toDayInputs(t.days),
    })
      .then((created) => openEditor(created.id))
      .catch(() => {})
  }
  const remove = () => {
    deleteTemplate(template.id).then(goBack).catch(() => {})
  }

  return (
    <MozaikPage tone="gold">
      <EntranceGroup>
        <header
          className="pl-dhero pl-lhero rise"
          style={{ '--mus-color': 'var(--tag-gym)', ...delay(40) } as CSSProperties}
        >
          <span className="pl-dhero-wash" aria-hidden="true" />
          <button type="button" className="mz-backbtn glass uv-back" aria-label="Vissza" onClick={goBack}>
            ‹ Sablonjaid
          </button>
          {muscles.length > 0 && (
            <span className="pl-lhero-map">
              <BodyMap heat={heat} views="auto" className="pl-lhero-body" ariaLabel={`${template.title} — érintett izmok`} />
            </span>
          )}
          <span className="pl-dhero-tag tr-eyebrow">{split ? `Sablon · ${split}` : 'Sablon'}</span>
          <h2>{template.title}</h2>
          <p className="pl-say">
            {template.weeks} hét, hetente {trainingDays} edzésnap.
          </p>
          {muscles.length > 0 && (
            <span className="pl-lib-mus" style={{ position: 'relative', marginTop: 10 }}>
              {muscles.map((m) => (
                <i key={m.group} style={{ '--mus-color': muscleColor(m.colorMuscle).rail } as CSSProperties}>
                  <MuscleChip token={m.colorMuscle} size={21} />
                </i>
              ))}
            </span>
          )}
          <div className="pl-poster-foot">
            {minutes > 0 && <span>~{minutes} perc egy edzés</span>}
            <span>{muscles.length} izomcsoport</span>
            {/* The legacy signal the retired MesoTemplateCard used to carry (mezo-88iwa.11):
                a plan built on the old model still starts, but its tiers are display-only. */}
            {isLegacyPlan(template) && <span data-testid="template-legacy">régi modell</span>}
          </div>
        </header>

        <PageBody className="pl-lib pl-sub tv-tpl">
          <h3 className="pl-h3">A hét felépítése</h3>
          {days.length === 0 && <p className="pl-foot-say">Ennek a sablonnak még nincs heti beosztása.</p>}
          {days.map((day, i) =>
            isOffDay(day) ? (
              <div key={day.day} className="pl-row is-quiet rise" style={delay(70 + i * 25)}>
                <span>
                  <strong>{day.day}</strong>
                  <small>{day.muscle === 'sport' ? day.type : 'Pihenő'}</small>
                </span>
              </div>
            ) : day.exercises.length === 0 ? (
              // A TRAINING day with no exercises yet is not a rest day — say so honestly
              // instead of misreading it as „Pihenő" (Task 3 fix round, mezo-88iwa.11).
              <div key={day.day} className="pl-row is-quiet rise" style={delay(70 + i * 25)}>
                <span>
                  <strong>{day.day}</strong>
                  <small>{day.type} · még nincs gyakorlat</small>
                </span>
              </div>
            ) : (
              <div key={day.day} className="pl-lib-card is-open rise" style={delay(70 + i * 25)}>
                <span className="pl-lib-head">
                  <strong>{day.day}</strong>
                  <em>{day.type}</em>
                </span>
                <span className="pl-day-facts">
                  <i><ClayIcon name="i-stack" size={22} className="icon" /><b>{day.exercises.length}</b><small>gyakorlat</small></i>
                  <i><ClayIcon name="i-edzes" size={22} className="icon" /><b>{daySets(day)}</b><small>szett</small></i>
                  <i><ClayIcon name="i-heti" size={22} className="icon" /><b>~{estimateSessionMinutes(day.exercises)}</b><small>perc</small></i>
                </span>
                <span className="pl-tpl-exs">
                  {day.exercises.map((e) => {
                    const isHold = e.repMin === 0 && e.repMax === 0
                    return (
                      <span
                        key={e.id}
                        className="pl-tpl-ex"
                        style={{ '--mus-color': muscleColor(e.muscle).rail } as CSSProperties}
                      >
                        <MuscleChip token={e.muscle} size={24} />
                        <strong>{e.name}</strong>
                        <b>{isHold ? `${e.workingSets}× tartás` : `${e.workingSets}×${e.repMin}–${e.repMax}`}</b>
                        <small>
                          {e.anchorWeightKg === 0
                            ? 'saját testsúly'
                            : e.anchorWeightKg != null
                              ? `${huKg(e.anchorWeightKg)} kg`
                              : '—'}
                        </small>
                      </span>
                    )
                  })}
                </span>
              </div>
            ),
          )}

          {muscles.length > 0 && (
            <>
              {/* The explanation lives BEHIND the ⓘ, as the prototype keeps it
                  (plan-pages.js:489) — the static paragraph that used to print it here
                  went with the button, so the sentence is not said twice (mezo-b516k). */}
              <h3 className="pl-h3">
                Heti szettek izmonként
                <InfoButton
                  title="Mit jelent a szám?"
                  copy="Ennyi munkaszettet kap az izom egy héten, ha ebből a sablonból indítasz. A futam első hete indul ennyivel — onnan hétről hétre emelkedhet."
                />
              </h3>
              <div className="pl-wload pl-tpl-load rise" style={delay(160)}>
                {muscles.map((m) => (
                  <span
                    key={m.group}
                    className="pl-wload-row"
                    style={{ '--mus-color': muscleColor(m.colorMuscle).rail } as CSSProperties}
                  >
                    <MuscleChip token={m.colorMuscle} size={22} />
                    <small>{m.label}</small>
                    <i style={{ '--w': `${Math.min(100, (m.sets / topSets) * 100)}%` } as CSSProperties} />
                    <b>{m.sets}</b>
                  </span>
                ))}
              </div>
            </>
          )}

          <h3 className="pl-h3">Futamok ebből a sablonból</h3>
          {runs.active === null && runs.planned.length === 0 && runs.closed.length === 0 && (
            <p className="pl-foot-say">Még nem indult futam ebből.</p>
          )}
          {runs.active && (
            <button
              type="button"
              className="pl-row rise"
              style={delay(190)}
              aria-label={`Most fut · ${runs.active.title}`}
              onClick={() => navigate('/train/mesocycles')}
            >
              <span>
                <strong>{runs.active.title}</strong>
                <small>Most fut — {runs.active.currentWeek}. hét a {runs.active.weeks}-ból</small>
              </span>
              <b aria-hidden="true">›</b>
            </button>
          )}
          {runs.planned.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className="pl-row rise"
              style={delay(210 + i * 25)}
              aria-label={`Tervezett · ${m.title}`}
              onClick={() => navigate(`/train/mesocycles/${m.id}`)}
            >
              <span>
                <strong>{m.title}</strong>
                <small>{huDate(m.startDate)}-tól következik</small>
              </span>
              <b aria-hidden="true">›</b>
            </button>
          ))}
          {runs.closed.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className="pl-row rise"
              style={delay(240 + i * 25)}
              aria-label={`Lezárt futam · ${m.title}`}
              onClick={() => navigate(`/train/mesocycles/${m.id}/report`)}
            >
              <span>
                <strong>{m.title}</strong>
                <small>Lezárva · {m.weeks} hét</small>
              </span>
              <b aria-hidden="true">›</b>
            </button>
          ))}

          <button
            type="button"
            className="pl-lib-new is-start rise"
            style={delay(280)}
            aria-label="Futam indítása ebből"
            onClick={() => setStartOpen(true)}
          >
            <span className="pl-lib-new-art"><ClayIcon name="i-lang" size={30} className="icon" /></span>
            <span>
              <strong>Futam indítása ebből</strong>
              <small>A sablon marad, a terv a tiéd lesz</small>
            </span>
            <b aria-hidden="true">›</b>
          </button>

          <button
            type="button"
            className="pl-row rise"
            style={delay(300)}
            aria-label="Szerkesztés"
            onClick={() => openEditor(template.id)}
          >
            <span>
              <strong>Szerkesztés</strong>
              <small>A napok és a gyakorlatok átírása</small>
            </span>
            <b aria-hidden="true">›</b>
          </button>

          {/* The lifecycle pair the DS list card carried behind ⋯ — kept reachable here. */}
          <button
            type="button"
            className="pl-row is-quiet rise"
            style={delay(320)}
            aria-label="Másolat készítése"
            disabled={createPending}
            onClick={() => duplicate(template)}
          >
            <span>
              <strong>Másolat készítése</strong>
              <small>Egy saját változat, amit szabadon átírhatsz</small>
            </span>
            <b aria-hidden="true">›</b>
          </button>
          <div
            ref={deleteRowRef}
            className={confirmDelete ? 'pl-row is-quiet is-danger rise' : 'pl-row is-quiet rise'}
            style={delay(340)}
          >
            <button
              type="button"
              className="pl-row-main"
              disabled={deletePending}
              onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
            >
              <span>
                <strong>{confirmDelete ? 'Biztos? Törlés' : 'Sablon törlése'}</strong>
                <small>A már elindult futamok és a riportjaik megmaradnak</small>
              </span>
              <b aria-hidden="true">›</b>
            </button>
            {confirmDelete && (
              <button type="button" className="pl-row-cancel" onClick={() => setConfirmDelete(false)}>
                Mégsem
              </button>
            )}
          </div>
        </PageBody>
      </EntranceGroup>

      {startOpen && (
        <MesoStartSheet
          templateId={template.id}
          title={template.title}
          onClose={() => setStartOpen(false)}
        />
      )}
    </MozaikPage>
  )
}
