// ============================================================
// Mezo · MesoFutamokPage — „Lezárt futamaid" at /train/mesocycles/futamok.
//
// Train Titanium T10 Task 4 (mezo-88iwa.11): THE REFACE. Task 2 parked the
// library landing's whole Történet section here verbatim (DS-era
// archived-run card rows, since removed) so nothing became unreachable; this is the Titanium
// closed list, ported from the prototype's `planLibraryClosedList` + `closedCard`
// (docs/design_2.0/prototypes/companion-titanium/plan-pages.js:410-452):
//   `.pl-lhero.is-slim` — the slim poster hero with the back pill DOCKED INSIDE
//                   it (the Task 2/3 idiom), one plain sentence, and a facts row.
//   `.pl-lib-card.is-closed` — one row per closed run: name, date range, the
//                   real facts the run itself carries, and the report state stamp.
//
// HONESTY — what this page does NOT draw (and why). The prototype's closed card
// carries a star row, „N edzés a M-ből" and a record count, and its hero sums the
// last two across every run. NONE of those three numbers exists on a `Mesocycle`
// (data/types.ts:1307): completion, session counts and records live ONLY in the
// frozen report (`MesocycleReportResponse.adherence` / `.records`), one fetch per
// run. Fetching every closed run's report just to sum a hero line would turn a
// list into N requests, so:
//   · the STARS live on the report page (`MesoReportPage`'s new star hero), which
//     is the one screen that already holds the run's `completionPct`;
//   · the hero's facts row states what the rows genuinely carry — how many runs
//     closed, and how many weeks of training they add up to;
//   · each card states the run's own weeks + whether a frozen report exists,
//     instead of an em-dashed „— edzés a —-ból" that says nothing.
// A number we cannot read is left out entirely rather than guessed.
//
// KEPT from the moved section, in the new anatomy: the mezo-meyc.4 „Összevetés"
// pairing mode (a card tap SELECTS instead of opening the report; two runs max, in
// tap order), „Újrafuttatás" (mezo-meyc.1 — reruns a closed run and opens
// `MesoStartSheet` on its originating template) and „Sablonná" (mezo-tlwa — forks
// the run's plan into a new template). The card cannot be ONE button any more
// because of those two footer actions (buttons do not nest), so the card is a box
// whose BODY is the button — `.pl-lib-open` — with `.pl-lib-foot` beneath it.
//
// Language: plain Hungarian, no jargon. Clay icons only, never emoji.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import type { Mesocycle } from '@/data/types'
import { ClayIcon } from '@/shared/ui/clay'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import { runToTemplate } from '@/features/train/logic/runToTemplate'
import { huDate } from '@/features/train/logic/mesoDates'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import MesoFutamokSkeleton from '@/features/train/pages/MesoFutamokSkeleton'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

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

  return (
    <MozaikPage tone="gold">
      <EntranceGroup>
        <header
          className="pl-dhero pl-lhero is-slim rise"
          style={{ '--mus-color': 'var(--tag-gym)', ...delay(40) } as CSSProperties}
        >
          <span className="pl-dhero-wash" aria-hidden="true" />
          <button
            type="button"
            className="mz-backbtn"
            aria-label="Vissza"
            onClick={() => navigate('/train/mesocycles/konyvtar')}
          >
            ‹ Edzéstervek
          </button>
          <span className="pl-lhero-art" aria-hidden="true">
            <ClayIcon name="i-erme" size={60} className="icon" />
            <i />
            <i />
          </span>
          <span className="pl-dhero-tag tr-eyebrow">Lezárt futamaid</span>
          <h2>Amit végigvittél</h2>
          <p className="pl-say">
            Minden lezárt terv itt őrzi a történetét — nyisd meg, és megnézheted, mit hozott.
          </p>
          <div className="pl-poster-foot">
            <span>{`${archived.length} lezárt futam`}</span>
            {totalWeeks > 0 && <span>{`${totalWeeks} hét összesen`}</span>}
          </div>
        </header>

        <PageBody className="pl-lib pl-sub">
          {archived.length === 0 ? (
            <p className="pl-foot-say rise" style={delay(90)}>
              Még nincs lezárt futamod — az első terved lezárása után itt lesz a története.
            </p>
          ) : (
            <>
              {/* Nothing to compare with fewer than two closed runs — the toggle stays away. */}
              {archived.length >= 2 && (
                <div className="row rise" style={{ justifyContent: 'flex-end', ...delay(70) }}>
                  <button
                    type="button"
                    className="chip tapchip"
                    aria-pressed={compareMode}
                    onClick={toggleCompareMode}
                  >
                    Összevetés
                  </button>
                </div>
              )}

              {archived.map((m, i) => {
                const picked = selectedIds.includes(m.id)
                const range = rangeLabel(m)
                return (
                  <div
                    key={m.id}
                    className={`pl-lib-card is-closed rise${picked ? ' is-picked' : ''}`}
                    style={delay(90 + i * 30)}
                  >
                    <button
                      type="button"
                      className="pl-lib-open"
                      aria-label={`Lezárt futam · ${m.title}`}
                      // One card, two meanings — the mode decides which (mezo-meyc.4).
                      onClick={() => (compareMode ? toggleSelected(m.id) : openReport(m.id))}
                      {...(compareMode ? { 'aria-pressed': picked } : {})}
                    >
                      <span className="pl-lib-head">
                        <strong>{m.title}</strong>
                        {range && <em>{range}</em>}
                        <b aria-hidden="true">{compareMode ? (picked ? '✓' : '○') : '›'}</b>
                      </span>
                      <span className="pl-lib-closed-row">
                        <span className="pl-lib-meta">
                          <ClayIcon name="i-idozito" size={16} className="icon" />
                          {`${m.weeks} hét`}
                        </span>
                        {/* The report state (mezo-meyc.4): a legacy closed run may carry no
                            frozen report, and finding that out only after tapping through is
                            a dead end. A plain stamp, never a button — the card body is what
                            opens the report. */}
                        <span className="pl-lib-meta">
                          <ClayIcon name="i-naplo" size={16} className="icon" />
                          {m.hasReport ? 'riport' : 'nincs riport'}
                        </span>
                      </span>
                      {m.summary && <small className="pl-lib-note">{m.summary}</small>}
                    </button>
                    {/* While selecting, the only meaningful tap on this card is the selection
                        itself — BOTH actions step aside (mezo-meyc.4 / mezo-tlwa). */}
                    {!compareMode && (
                      <div className="pl-lib-foot">
                        <button type="button" className="chip tapchip" onClick={() => saveAsTemplate(m)}>
                          Sablonná
                        </button>
                        <button
                          type="button"
                          className="chip tapchip"
                          onClick={() => rerunMeso(m.id, m.title)}
                        >
                          Újrafuttatás
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {compareMode && (
                selectedIds.length < 2 ? (
                  <p className="pl-foot-say">
                    {`Válassz két lezárt futamot (${selectedIds.length}/2).`}
                  </p>
                ) : (
                  <button type="button" className="pl-lib-new" onClick={openCompare}>
                    <span className="pl-lib-new-art"><ClayIcon name="i-retegek" size={30} className="icon" /></span>
                    <span>
                      <strong>Összevetés megnyitása</strong>
                      <small>A két kiválasztott futam egymás mellett</small>
                    </span>
                    <b aria-hidden="true">›</b>
                  </button>
                )
              )}
            </>
          )}
        </PageBody>
      </EntranceGroup>

      {startTemplate && (
        <MesoStartSheet
          templateId={startTemplate.id}
          title={startTemplate.title}
          onClose={() => setStartTemplate(null)}
        />
      )}
    </MozaikPage>
  )
}
