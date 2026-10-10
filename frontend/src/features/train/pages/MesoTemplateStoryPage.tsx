// ============================================================
// Mezo · MesoTemplateStoryPage — ONE template, read-first, at /train/templates/:id.
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `sablon()`):
//   hero   — split as the label, „N hét, hetente N edzésnap." as the verdict; the week as seven
//            tubes (a training day filled to its working sets in its first muscle's colour, an
//            off day hatched with the moon / sport glyph), the top muscles as chips, the facts
//            as tags; „Futam indítása ebből" on the liquid row opens the ONE shared
//            `MesoStartSheet`.
//   1 · A hét felépítése — every day in one card: a training day with each exercise spelled
//            out (muscle chip, name, szett×ismétlés, induló súly), rest/sport days as quiet
//            lines. Honest words: a hold (repMin AND repMax both 0) reads „tartás", 0 kg reads
//            „saját testsúly", a training day with no exercise says so (never „Pihenő").
//   2 · Heti szettek izmonként — levels over `templateWeekSets` (the shared
//            `daySessionBreakdown` summed across the week), scaled to the biggest muscle.
//   3 · Futamok ebből a sablonból — `templateRuns`: the running one → the Terv landing, a
//            queued one → its own page, a closed one → its FROZEN report.
//   4 · A sablon kezelése — Szerkesztés (the raw editor), Másolat készítése (createTemplate
//            from this template's own document → the copy's editor) and Sablon törlése: the
//            inline two-step confirm (a soft delete that leaves past runs and reports alone).
//
// A bad/stale :id is a dead link and says so, never an empty page pretending to be a template.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import type { MesoDay, MesoTemplate } from '@/data/types'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { huDate, huKg } from '@/features/train/logic/mesoDates'
import { isLegacyPlan } from '@/features/train/logic/mesoPlan'
import { InfoButton } from '@/features/train/components/InfoButton'
import { Mchp, MuscleRow, MuscleTags, deepMuscle } from '@/features/train/components/folyadek'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import {
  splitLabel,
  templateRuns,
  templateSessionMinutes,
  templateWeekSets,
  trainingDayCount,
} from '@/features/train/logic/libraryStory'
import { toDayInputs } from '@/features/train/logic/mesoDays'
import { isOffDay } from '@/features/train/logic/offDay'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import {
  Acts, Btn, Caps, Card, Chev, EmptyTank, FrameBack, Hero, Lk, Note, Page, Row, Section, Skel, Tags, Tubes,
  useFrameTitle, type TagItem, type VialItem,
} from '@/shared/ui/folyadek'

/** Working sets on one day (the weekly levels below do the budget-aware sum; this is just
 *  "how much work is this session"). */
const daySets = (day: MesoDay) => day.exercises.reduce((n, e) => n + e.workingSets, 0)

const clampPct = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** A management row that is a real button with a `disabled` state (the kit Row has none): the
 *  kit row's own markup and classes. */
function ActRow(p: { icon: Icon3DName; title: ReactNode; sub: ReactNode; onClick: () => void; disabled?: boolean; ariaLabel?: string }) {
  return (
    <button type="button" className="fo-row er-act" aria-label={p.ariaLabel} disabled={p.disabled} onClick={p.onClick}>
      <span className="si"><Icon3D name={p.icon} size={26} /></span>
      <span className="g"><strong>{p.title}</strong><small>{p.sub}</small></span>
      <Chev />
    </button>
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
  const template = templates.find((t) => t.id === id)
  useFrameTitle({ title: template?.title ?? 'Sablon', eyebrow: 'Sablonjaid' })
  const back = <FrameBack className="er-back" history fallback="/train/templates">‹ Sablonjaid</FrameBack>

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
  if (pending || workoutPending) return <Page className="er-page">{back}<Skel blocks={[300, 150, 150, 120]} /></Page>

  // A RESOLVED list without this template is a dead link, and says so.
  if (!template) {
    return (
      <Page className="er-page">
        {back}
        <Card><EmptyTank icon="t-other">Ez a sablon nem található.</EmptyTank></Card>
      </Page>
    )
  }

  const days = template.days ?? []
  const trainingDays = trainingDayCount(template)
  const split = splitLabel(template)
  const muscles = templateWeekSets(template)
  const topSets = Math.max(1, ...muscles.map((m) => m.sets))
  const minutes = templateSessionMinutes(template)
  const runs = templateRuns(template.id, template.title, mesocycles)
  const noRuns = runs.active === null && runs.planned.length === 0 && runs.closed.length === 0
  const topDaySets = Math.max(1, ...days.map(daySets))

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

  // The week as tubes: a training day filled to its working sets (against the week's biggest
  // day) in its first exercise's muscle colour; an off day is the hatched tube.
  const weekTubes: VialItem[] = days.map((day) => {
    const sets = daySets(day)
    if (isOffDay(day) || sets === 0) {
      return { label: day.day, value: '–', pct: 0, hatch: true, icon: day.muscle === 'sport' ? 't-volley' : isOffDay(day) ? 't-moon' : undefined }
    }
    return {
      label: day.day, value: sets, pct: (sets / topDaySets) * 94,
      color: deepMuscle(day.exercises[0].muscle), mark: day.type.split(' ')[0],
    }
  })
  const heroTags: (TagItem | string)[] = []
  if (minutes > 0) heroTags.push(`~${minutes} perc egy edzés`)
  heroTags.push(`${muscles.length} izomcsoport`)
  // The legacy signal (mezo-88iwa.11): a plan built on the old model still starts, but its
  // tiers are display-only.
  if (isLegacyPlan(template)) heroTags.push({ label: <span data-testid="template-legacy">régi modell</span> })

  const hasWeek = days.length > 0
  let n = 0

  return (
    <Page className="er-page er-cards">
      {back}
      <Hero
        label={split ? `Sablon · ${split}` : 'Sablon'}
        verdict={`${template.weeks} hét, hetente ${trainingDays} edzésnap.`}
        sub={hasWeek ? 'Ez a hét felépítése — a futam ebből készül.' : 'Ennek a sablonnak még nincs heti beosztása.'}
        actions={(
          <>
            <Btn onClick={() => setStartOpen(true)}>Futam indítása ebből</Btn>
            <Note className="er-heronote">A sablon marad, a terv a tiéd lesz</Note>
          </>
        )}
      >
        {hasWeek ? (
          <>
            <div className="er-hg"><Tubes items={weekTubes} height={96} size="wk" gap={6} aria-label={`${template.title} — a hét napjai`} /></div>
            {muscles.length > 0 && <MuscleTags items={muscles.slice(0, 5).map((m) => ({ muscle: m.colorMuscle, label: m.label }))} />}
          </>
        ) : (
          <EmptyTank icon="t-template">Ennek a sablonnak még nincs heti beosztása.</EmptyTank>
        )}
        <Tags items={heroTags} />
      </Hero>

      {hasWeek && (
        <>
          <Section n={++n} title="A hét felépítése" />
          <Card>
            {days.map((day) =>
              isOffDay(day) ? (
                <div key={day.day} className="er-tday muted">
                  <div className="dh"><b>{day.day}</b><span>{day.muscle === 'sport' ? day.type : 'Pihenő'}</span></div>
                </div>
              ) : day.exercises.length === 0 ? (
                // A TRAINING day with no exercises yet is not a rest day — say so honestly
                // instead of misreading it as „Pihenő" (Task 3 fix round, mezo-88iwa.11).
                <div key={day.day} className="er-tday muted">
                  <div className="dh"><b>{day.day}</b><span>{day.type} · még nincs gyakorlat</span></div>
                </div>
              ) : (
                <div key={day.day} className="er-tday">
                  <div className="dh">
                    <b>{day.day} · {day.type}</b>
                    <span>{day.exercises.length} gyakorlat · {daySets(day)} szett · ~{estimateSessionMinutes(day.exercises)} perc</span>
                  </div>
                  {day.exercises.map((e) => {
                    const isHold = e.repMin === 0 && e.repMax === 0
                    return (
                      <div key={e.id} className="ex">
                        <Mchp muscle={e.muscle} sm />
                        <span className="g">{e.name}</span>
                        <span className="v">
                          <b>{isHold ? `${e.workingSets}× tartás` : `${e.workingSets}×${e.repMin}–${e.repMax}`}</b>
                          {' · '}
                          {e.anchorWeightKg === 0
                            ? 'saját testsúly'
                            : e.anchorWeightKg != null
                              ? `${huKg(e.anchorWeightKg)} kg`
                              : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ),
            )}
          </Card>
        </>
      )}

      {muscles.length > 0 && (
        <>
          <Section n={++n} title="Heti szettek izmonként" />
          <Card>
            {muscles.map((m) => (
              <MuscleRow key={m.group} muscle={m.colorMuscle} label={m.label} value={`${m.sets} szett`} pct={clampPct((m.sets / topSets) * 100, 6, 100)} />
            ))}
            {/* The explanation lives BEHIND the link, as the prototype keeps it (mezo-b516k). */}
            <Acts>
              <InfoButton
                link
                eyebrow="Heti szettek izmonként"
                title="Mit jelent a szám?"
                copy="Ennyi munkaszettet kap az izom egy héten, ha ebből a sablonból indítasz. A futam első hete indul ennyivel — onnan hétről hétre emelkedhet."
              />
            </Acts>
          </Card>
        </>
      )}

      <Section n={++n} title="Futamok ebből a sablonból" />
      <Card>
        {noRuns && <Note className="er-none">Még nem indult futam ebből.</Note>}
        {runs.active && (
          <Row
            icon="t-peak"
            title={runs.active.title}
            sub={`Most fut — ${runs.active.currentWeek}. hét a ${runs.active.weeks}-ból`}
            right={(
              <span className="er-chev">
                <Caps n={runs.active.weeks} done={runs.active.currentWeek - 1} cur={runs.active.currentWeek - 1} />
                <Chev />
              </span>
            )}
            aria-label={`Most fut · ${runs.active.title}`}
            onClick={() => navigate('/train/mesocycles')}
          />
        )}
        {runs.planned.map((m) => (
          <Row
            key={m.id}
            icon="t-calendar"
            title={m.title}
            sub={`${huDate(m.startDate)}-tól következik`}
            aria-label={`Tervezett · ${m.title}`}
            onClick={() => navigate(`/train/mesocycles/${m.id}`)}
          />
        ))}
        {runs.closed.map((m) => (
          <Row
            key={m.id}
            icon="t-scroll"
            title={m.title}
            sub={`Lezárva · ${m.weeks} hét`}
            aria-label={`Lezárt futam · ${m.title}`}
            onClick={() => navigate(`/train/mesocycles/${m.id}/report`)}
          />
        ))}
      </Card>

      <Section n={++n} title="A sablon kezelése" />
      <Card>
        <Row
          icon="t-pencil"
          title="Szerkesztés"
          sub="A napok és a gyakorlatok átírása"
          aria-label="Szerkesztés"
          onClick={() => openEditor(template.id)}
        />
        {/* The lifecycle pair — kept reachable here. */}
        <ActRow
          icon="t-repeat"
          title="Másolat készítése"
          sub="Egy saját változat, amit szabadon átírhatsz"
          ariaLabel="Másolat készítése"
          disabled={createPending}
          onClick={() => duplicate(template)}
        />
        <div ref={deleteRowRef} className="er-del">
          <ActRow
            icon="t-trash"
            title={<span className="er-bad">{confirmDelete ? 'Biztos? Törlés' : 'Sablon törlése'}</span>}
            sub="A már elindult futamok és a riportjaik megmaradnak"
            disabled={deletePending}
            onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
          />
          {confirmDelete && <Acts><Lk onClick={() => setConfirmDelete(false)}>Mégsem</Lk></Acts>}
        </div>
      </Card>

      {startOpen && (
        <MesoStartSheet
          templateId={template.id}
          title={template.title}
          onClose={() => setStartOpen(false)}
        />
      )}
    </Page>
  )
}
