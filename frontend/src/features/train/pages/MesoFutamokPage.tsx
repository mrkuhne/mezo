// ============================================================
// Mezo · MesoFutamokPage — „Lezárt futamaid" at /train/mesocycles/futamok.
// Folyadék F3 (mezo-n4wf5.3), prototype vilagos/edzes.js `futamok()`.
//
//   hero     — „{n} lezárt futam, {w} hét összesen." Each closed run is a vessel: its level is
//              its number of weeks, a run WITHOUT a frozen report is hatched. A vessel opens
//              the run's report — or, in „Összevetés" mode, selects it.
//   1 Futamok — one block per closed run: name, its window (ending at the actual close stamp),
//              its weeks, the closing sentence when it has one, the report state stamp; under
//              it „Sablonná" and „Újrafuttatás".
//
// HONESTY — what this page does NOT draw (and why). Completion, session counts and records
// live ONLY in the frozen report (`MesocycleReportResponse.adherence` / `.records`), one
// fetch per run; fetching every closed run's report to decorate a list would turn it into N
// requests. So the page states what the rows genuinely carry — how many runs closed, how
// many weeks they add up to, and whether each has a report. A number we cannot read is left
// out entirely rather than guessed.
//
// KEPT: the mezo-meyc.4 „Összevetés" pairing mode (a tap SELECTS instead of opening the
// report; two runs max, in tap order — the order is the a / b choice), „Újrafuttatás"
// (mezo-meyc.1 — reruns a closed run and opens `MesoStartSheet` on its originating template)
// and „Sablonná" (mezo-tlwa — forks the run's plan into a new template and opens its editor).
// While selecting, both of those step aside.
//
// Language: plain Hungarian, no jargon.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import type { Mesocycle } from '@/data/types'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import { runToTemplate } from '@/features/train/logic/runToTemplate'
import { huDate } from '@/features/train/logic/mesoDates'
import MesoFutamokSkeleton from '@/features/train/pages/MesoFutamokSkeleton'
import {
  Btn, Card, Chev, EmptyTank, FrameBack, Hero, Lk, Note, Page, Row, Section, St, Tubes, useFrameTitle,
} from '@/shared/ui/folyadek'

/** The hero holds this many vessels; a longer history stays whole in the list below. */
const HERO_RUNS_MAX = 6

/** „Feb 12 – Ápr 23" — the run's own window, ending at the actual close stamp when one
 *  exists (a run closed early ended when it was CLOSED, not when the plan said it would).
 *  Both ends go through `huDate`, so a real-mode ISO date reads like the mock's HU one. */
function rangeLabel(m: Mesocycle): string | null {
  const from = huDate(m.startDate)
  const to = huDate(m.closedAt ? m.closedAt.slice(0, 10) : m.endDate)
  if (!from && !to) return null
  if (!from) return `${to}-ig`
  if (!to) return `${from}-tól`
  return `${from} – ${to}`
}

export function MesoFutamokPage() {
  const { mesocycles, workoutPending } = useTrain()
  const { pending: templatesPending, rerun, createTemplate } = useMesoTemplates()
  const navigate = useNavigate()
  // The template the start sheet is open on (null = closed). A rerun resolves its
  // template id first, then lands here — one start surface for both entries.
  const [startTemplate, setStartTemplate] = useState<{ id: string; title?: string } | null>(null)
  // „Összevetés" mode (mezo-meyc.4): while it is on, a card tap SELECTS the run instead of
  // opening its report. Two ids max — the compare view is strictly pairwise — kept in TAP
  // ORDER, which is what makes the tap the `a`/`b` choice.
  const [compareMode, setCompareMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useFrameTitle({ title: 'Lezárt futamaid', eyebrow: 'Edzéstervek' })

  if (workoutPending || templatesPending) return <MesoFutamokSkeleton />

  const archived = mesocycles.filter((m) => m.status === 'archived')
  // The one total the ROWS themselves can honestly give (see the honesty note above).
  const totalWeeks = archived.reduce((n, m) => n + (m.weeks ?? 0), 0)

  // A closed run opens its FROZEN report, not the builder (mezo-meyc.2) — the builder
  // redirects there anyway, so route the card straight at the destination.
  const openReport = (id: string) => navigate(`/train/mesocycles/${id}/report`)
  const openTemplateEditor = (id: string) => navigate(`/train/mesocycles/templates/${id}`)
  // Leaving the mode clears the pick: a selection surviving an invisible mode would fire the
  // next time the user turns it on, out of nowhere.
  const toggleCompareMode = () => {
    setCompareMode((on) => !on)
    setSelectedIds([])
  }
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? prev : [...prev, id],
    )
  const openCompare = () =>
    navigate(`/train/mesocycles/compare?a=${selectedIds[0]}&b=${selectedIds[1]}`)
  const rerunMeso = (id: string, title: string) => {
    rerun(id)
      .then(({ templateId }) => setStartTemplate({ id: templateId, title }))
      // Failed mutations are toasted globally (§7a) — nothing extra to do but stay put.
      .catch(() => {})
  }
  // „Sablonná" (mezo-tlwa): freeze this closed run's plan into a NEW template and land in
  // its editor — a new blueprint is made to be tweaked, and the editor is also the only
  // place that proves the copy exists. Rerun is the other, unchanged direction (reuse the
  // run's ORIGINATING template); this one forks the plan.
  const saveAsTemplate = (meso: Mesocycle) => {
    createTemplate(runToTemplate(meso))
      .then((created) => openTemplateEditor(created.id))
      .catch(() => {})
  }

  const back = <FrameBack className="ep-back" history fallback="/train/mesocycles/konyvtar">‹ Edzéstervek</FrameBack>
  const sheet = startTemplate && (
    <MesoStartSheet templateId={startTemplate.id} title={startTemplate.title} onClose={() => setStartTemplate(null)} />
  )

  if (archived.length === 0) {
    return (
      <Page className="ep-page">
        {back}
        <Hero label="Lezárt futamaid" verdict="Még nincs lezárt futamod." sub="Az első terved lezárása után itt lesz a története.">
          <EmptyTank icon="t-history">Még nincs lezárt futamod — az első terved lezárása után itt lesz a története.</EmptyTank>
        </Hero>
        {sheet}
      </Page>
    )
  }

  // Nothing to compare with fewer than two closed runs — the toggle stays away.
  const canCompare = archived.length >= 2
  const selecting = compareMode && canCompare
  const ready = selecting && selectedIds.length === 2
  const heroRuns = archived.slice(0, HERO_RUNS_MAX)
  const maxWeeks = Math.max(1, ...heroRuns.map((m) => m.weeks ?? 0))
  // One tap, two meanings — the mode decides which (mezo-meyc.4).
  const tap = (m: Mesocycle) => (selecting ? toggleSelected(m.id) : openReport(m.id))

  return (
    <Page className="ep-page">
      {back}
      <Hero label="Amit lezártál"
        verdict={totalWeeks > 0 ? `${archived.length} lezárt futam, ${totalWeeks} hét összesen.` : `${archived.length} lezárt futam.`}
        sub={selecting
          ? `Válassz két lezárt futamot (${selectedIds.length}/2).`
          : 'Minden lezárt terv itt őrzi a történetét — nyisd meg, és megnézheted, mit hozott.'}
        actions={canCompare ? (
          <>
            {ready && <Btn onClick={openCompare}>Összevetés megnyitása</Btn>}
            <Btn ghost={ready} aria-pressed={compareMode} onClick={toggleCompareMode}>{selecting ? 'Mégsem' : 'Összevetés'}</Btn>
            {ready && <Note className="ep-actnote">A két kiválasztott futam egymás mellett</Note>}
          </>
        ) : undefined}>
        <div className="ep-hg">
          <Tubes className={heroRuns.length > 3 ? 'ep-n3 many' : 'ep-n3'} height={124} size={heroRuns.length > 3 ? 'wk' : undefined}
            aria-label="Lezárt futamaid: egy edény egy futam"
            items={heroRuns.map((m) => {
              const at = selectedIds.indexOf(m.id)
              const state = selecting ? (at >= 0 ? `${at + 1}. kiválasztva` : 'kiválaszt') : m.hasReport ? 'riport' : 'nincs riport'
              const short = m.shortTitle ?? m.title
              return {
                label: short, value: `${m.weeks} hét`, note: state,
                pct: ((m.weeks ?? 0) / maxWeeks) * 94, hatch: !m.hasReport, sel: selecting && at >= 0,
                onClick: () => tap(m), pressed: selecting ? at >= 0 : undefined,
                ariaLabel: `${short}, ${m.weeks} hét, ${state}`,
              }
            })} />
        </div>
      </Hero>

      <Section n={1} title="Futamok" />
      <Card>
        {archived.map((m) => {
          const at = selectedIds.indexOf(m.id)
          const range = rangeLabel(m)
          const sub = (
            <>
              {[range, `${m.weeks} hét`].filter(Boolean).join(' · ')}
              {m.summary && <><br />{m.summary}</>}
            </>
          )
          return (
            <div key={m.id} className="ep-log">
              {selecting ? (
                <Row as="div" title={m.title} sub={sub}
                  left={<span className={at >= 0 ? 'ep-tk on' : 'ep-tk'} aria-hidden="true">{at >= 0 && <b>{at + 1}</b>}</span>}
                  aria-label={`Lezárt futam · ${m.title}`} aria-pressed={at >= 0}
                  onClick={() => tap(m)} />
              ) : (
                <>
                  {/* The report state (mezo-meyc.4): a legacy closed run may carry no frozen report, and
                      finding that out only after tapping through is a dead end. A plain stamp, never a
                      button — the row is what opens the report. */}
                  <Row icon="t-scroll" title={m.title} sub={sub}
                    right={<span className="ep-rowchev"><St tone={m.hasReport ? 'ok' : 'q'}>{m.hasReport ? 'riport' : 'nincs riport'}</St><Chev /></span>}
                    aria-label={`Lezárt futam · ${m.title}`}
                    onClick={() => tap(m)} />
                  {/* While selecting, the only meaningful tap is the selection itself — BOTH
                      actions step aside (mezo-meyc.4 / mezo-tlwa). */}
                  <div className="ep-in">
                    <Lk onClick={() => saveAsTemplate(m)}>Sablonná</Lk>
                    <Lk onClick={() => rerunMeso(m.id, m.title)}>Újrafuttatás</Lk>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </Card>
      {sheet}
    </Page>
  )
}
