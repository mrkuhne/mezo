// ============================================================
// Mezo · MesoTemplatesPage — „Sablonjaid" at /train/templates.
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `sablonok()`): the hero counts the
// templates and the runs started from them (real counts) and carries the one create door
// („Új terv összeállítása" → the planner); then ONE card, a block per template: name + split,
// the week as seven capsules (a training day is a full one), the muscles as overlapping chips,
// the three facts (hét, nap hetente, ~perc when the week actually carries sessions) and ONE
// plain line about where the template stands (`templateUseLine` over `templateStory`).
// A block opens the template's own READ-FIRST page (`/train/templates/:id`), from which the
// editor, the start sheet and the lifecycle pair hang — the list carries no destructive action.
// ============================================================
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import { MuscleStack } from '@/features/train/components/folyadek'
import {
  splitLabel,
  templateSessionMinutes,
  templateStory,
  templateUseLine,
  templateWeekSets,
  trainingDayCount,
} from '@/features/train/logic/libraryStory'
import { isOffDay } from '@/features/train/logic/offDay'
import MesoTemplatesSkeleton from '@/features/train/pages/MesoTemplatesSkeleton'
import {
  Btn, Caps, Card, Chev, Facts, FrameBack, Hero, Note, Page, Section, Tags, useFrameTitle,
} from '@/shared/ui/folyadek'

/** The capsule's caption: the weekday's shortest form (the day keys are Hét … Vas). */
const DAY_CAP: Record<string, string> = { Hét: 'H', Kedd: 'K', Sze: 'Sze', Csü: 'Cs', Pén: 'P', Szo: 'Szo', Vas: 'V' }

export function MesoTemplatesPage() {
  const { templates, pending } = useMesoTemplates()
  const { mesocycles, workoutPending } = useTrain()
  const navigate = useNavigate()
  useFrameTitle({ title: 'Sablonjaid', eyebrow: 'Edzéstervek' })

  // Real-mode loading: both queries feed the blocks (the story line is a read across the
  // runs), so wait them both out behind the layout-matched skeleton. Mock seeds
  // synchronously → never shows. After all hooks.
  if (pending || workoutPending) return <MesoTemplatesSkeleton />

  const runsOut = templates.reduce((n, t) => n + t.runCount, 0)

  return (
    <Page className="er-page">
      <FrameBack className="fo-backpill" history fallback="/train/mesocycles/konyvtar">
        ‹ Edzéstervek
      </FrameBack>
      <Hero
        art="t-template"
        label="Sablonjaid"
        verdict={templates.length > 0 ? `${templates.length} sablonból indíthatsz.` : 'Még nincs sablonod.'}
        sub="Egy sablon a recept — futamot indítasz belőle, és az már a te terved."
        actions={(
          <>
            {/* The create affordance — the one loud button. */}
            <Btn onClick={() => navigate('/train/mesocycles/new')}>Új terv összeállítása</Btn>
            <Note>Sablonból indulsz, vagy nulláról építed</Note>
          </>
        )}
      >
        <Tags items={[
          { icon: 't-template', label: `${templates.length} sablon` },
          { icon: 't-play', label: `${runsOut} futam indult belőlük` },
        ]} />
      </Hero>

      <Section n={1} title="Sablonok · egy kapszula egy nap" />
      <Card>
        {templates.length === 0 && <Note className="er-none">Még nincs sablonod — az elsőt fent állíthatod össze.</Note>}
        {templates.map((t) => {
          const week = t.days ?? []
          const days = trainingDayCount(t)
          const minutes = templateSessionMinutes(t)
          const muscles = templateWeekSets(t)
          const split = splitLabel(t)
          const story = templateStory(t.id, t.title, mesocycles)
          const facts: [ReactNode, ReactNode][] = [[t.weeks, 'hét'], [days, 'nap hetente']]
          if (minutes > 0) facts.push([`~${minutes}`, 'perc'])
          return (
            <button
              key={t.id}
              type="button"
              className="er-tpl"
              aria-label={`Sablon · ${t.title}`}
              onClick={() => navigate(`/train/templates/${t.id}`)}
            >
              <span className="er-tpl-hd">
                <span className="g">
                  <strong>{t.title}</strong>
                  {split && <small>{split}</small>}
                </span>
                <Chev />
              </span>
              {(week.length > 0 || muscles.length > 0) && (
                <span className="er-tpl-wk">
                  {week.length > 0 && (
                    <Caps
                      n={week.length}
                      on={week.flatMap((d, i) => (isOffDay(d) ? [] : [i]))}
                      size="wide"
                      labels={week.map((d) => DAY_CAP[d.day] ?? d.day)}
                    />
                  )}
                  {muscles.length > 0 && <MuscleStack muscles={muscles.map((m) => m.colorMuscle)} max={4} />}
                </span>
              )}
              <Facts items={facts} />
              <small className="er-tpl-use">{templateUseLine(story, t.runCount)}</small>
            </button>
          )
        })}
      </Card>
    </Page>
  )
}
