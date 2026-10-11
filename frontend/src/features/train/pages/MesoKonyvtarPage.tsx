// ============================================================
// Mezo · MesoKonyvtarPage — „Edzéstervek", the plan library at /train/mesocycles/konyvtar.
// Folyadék F3 (mezo-n4wf5.3), prototype vilagos/edzes.js `konyvtar()`.
//
//   hero          — „Itt élnek a terveid." The plans as a PIPELINE: the running one half full
//                   (week X of Y), the coming ones waiting behind it; a vessel's length is the
//                   plan's number of weeks. Under it the four real counts — „N fut · N
//                   következik · N sablon · N lezárva" (0 renders as 0, because 0 is the truth
//                   about this library). The one loud button: „Új terv összeállítása" → the
//                   planner.
//   1 Most fut    — the ACTIVE run (name, split, week X of Y) → the Terv landing. With no
//                   active run the card says so in one quiet line.
//   2 Következnek — one block per planned run: name, split, start date, weeks and frequency.
//                   NO activation here: activating a plan silently archives the running one
//                   with no close ceremony or report (`activateMesocycle` →
//                   `TrainService.archiveActiveMesos`), so the row opens the plan's own page,
//                   whose DATED „Aktiválás · <date>" button is the deliberate path. A line says
//                   when it starts (a running plan is ahead of it) or hints at the plan page.
//   3 A polcod    — „Sablonjaid" → /train/templates and „Lezárt futamaid" → …/futamok.
//
// Language: plain Hungarian — „terv", never „blokk".
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import MesocycleSkeleton from '@/features/train/pages/MesocycleSkeleton'
import { huDate } from '@/features/train/logic/mesoDates'
import { Btn, Card, Facts, FrameBack, Hero, Note, Page, Row, Section, Tags, useFrameTitle } from '@/shared/ui/folyadek'

/** The split's head („Upper / Lower · 4×/hét" → „Upper / Lower") — the „×/hét" half is said
 *  by the frequency fact under it. */
const splitHead = (split: string) => split.split(' · ')[0]

/** The split's „×/hét" tail („Upper / Lower · 4×/hét" → „4×/hét"), or null when the split
 *  carries no such tail (a legacy/direct run's split may be name-only) — the frequency fact
 *  is dropped rather than drawn empty. */
function splitFrequency(split: string): string | null {
  const parts = split.split(' · ')
  return parts.length > 1 && /×\/hét$/.test(parts[1]) ? parts[1] : null
}

/** The pipeline shows the running plan and the next few — a long queue stays readable in the list below. */
const QUEUE_MAX = 4

export function MesoKonyvtarPage() {
  const { mesocycles, workoutPending } = useTrain()
  const { templates, pending: templatesPending } = useMesoTemplates()
  const navigate = useNavigate()
  useFrameTitle({ title: 'Edzéstervek', eyebrow: 'A terved' })

  // Real-mode loading: show the layout-aware skeleton until the meso + template lists
  // resolve. Mock seeds synchronously → no skeleton.
  if (workoutPending || templatesPending) return <MesocycleSkeleton />

  const active = mesocycles.find((m) => m.status === 'active') ?? null
  const planned = mesocycles.filter((m) => m.status === 'planned')
  const archived = mesocycles.filter((m) => m.status === 'archived')
  const queue = [...(active ? [active] : []), ...planned].slice(0, QUEUE_MAX)
  const openRun = (id: string) => navigate(`/train/mesocycles/${id}`)

  return (
    <Page className="ep-page">
      <FrameBack className="fo-backpill" history fallback="/train/mesocycles">‹ A terved</FrameBack>
      <Hero data-kalauz-anchor="konyvtar-hero" label="Edzéstervek" verdict="Itt élnek a terveid."
        sub="Ami fut, ami jön, és ami már mögötted van."
        actions={(
          <>
            <Btn onClick={() => navigate('/train/mesocycles/new')}>Új terv összeállítása</Btn>
            <Note>Sablonból indulsz, vagy nulláról építed</Note>
          </>
        )}>
        {queue.length > 0 && (
          <div className="ep-queue">
            {queue.map((m) => {
              const running = m.id === active?.id
              return (
                <button key={m.id} type="button" className={running ? 'now' : undefined} style={{ flex: m.weeks + 2 }}
                  aria-label={`${m.title} megnyitása`}
                  onClick={() => (running ? navigate('/train/mesocycles') : openRun(m.id))}>
                  <span>
                    {running && <i style={{ width: `${Math.min(100, (m.currentWeek / m.weeks) * 100)}%` }} />}
                    <b>{running ? `${m.currentWeek}/${m.weeks}` : `${m.weeks} hét`}</b>
                  </span>
                  <small>{m.shortTitle ?? m.title}</small>
                </button>
              )
            })}
          </div>
        )}
        <Tags items={[
          { icon: 't-play', label: `${active ? 1 : 0} fut` },
          { icon: 't-calendar', label: `${planned.length} következik` },
          { icon: 't-template', label: `${templates.length} sablon` },
          { icon: 't-history', label: `${archived.length} lezárva` },
        ]} />
      </Hero>

      <Section n={1} title="Most fut" />
      <Card>
        {active ? (
          <Row icon="t-peak" title={active.title} sub={active.split} value={`${active.currentWeek}. hét a ${active.weeks}-ból`}
            aria-label={`Most fut · ${active.title}`} onClick={() => navigate('/train/mesocycles')} />
        ) : (
          // No running plan is a real state, not an empty row: say it once, quietly.
          <Note className="ep-solo">Most nem fut terv — indíts egyet alább.</Note>
        )}
      </Card>

      {planned.length > 0 && (
        <>
          <Section n={2} title="Következnek" />
          <Card>
            {planned.map((m) => {
              const freq = splitFrequency(m.split)
              return (
                // No one-tap activation here — the row opens the plan's own page, whose dated
                // „Aktiválás · <date>" button is the deliberate path; the line below says what „opens" means.
                <div key={m.id} className="fo-log ep-log">
                  <Row icon="t-calendar" title={m.title} sub={splitHead(m.split)} value={`${huDate(m.startDate)}-tól`}
                    aria-label={`Tervezett · ${m.title}`} onClick={() => openRun(m.id)} />
                  <Facts items={[[m.weeks, 'hét'], ...(freq ? [[freq.replace('/hét', ''), 'hetente'] as [string, string]] : [])]} />
                  <Note>{active ? 'Akkor indul, amikor a mostani terved lezárul.' : 'Nyisd meg, és onnan indíthatod.'}</Note>
                </div>
              )
            })}
          </Card>
        </>
      )}

      <Section n={planned.length > 0 ? 3 : 2} title="A polcod" />
      <Card>
        <Row icon="t-template" title="Sablonjaid" sub={`${templates.length} sablon, amiből indíthatsz`}
          aria-label="Sablonjaid" onClick={() => navigate('/train/templates')} />
        <Row icon="t-history" title="Lezárt futamaid" sub={`${archived.length} lezárt terv története`}
          aria-label="Lezárt futamaid" onClick={() => navigate('/train/mesocycles/futamok')} />
      </Card>
    </Page>
  )
}
