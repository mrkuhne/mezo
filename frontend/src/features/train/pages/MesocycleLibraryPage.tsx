// ============================================================
// Mezo · MesocycleLibraryPage (Mezociklus hub, mezo-d20.3.6) — Mozaik re-face.
// Source of truth: the mezociklus prototype's base panel (meso-body.html,
// px ×1.18) — the active-run hero (unchanged ActiveMesoCard) sits above a
// 4-tile mosaic that is the hub's real navigation: `Volumen` → the active
// run's MesoOverviewPage, `Sablonok` → MesoTemplatesPage, `Új blokk` → the
// planner. The prototype's `Történet` tile has no route of its own to jump
// to (the wizard + a dedicated history route are out of this slice's scope,
// F2.7) — it scrolls the ALREADY-RENDERED history section into view, which
// is where the mezo-meyc.4 Összevetés selection mode still lives, unchanged.
// Template/run split (mezo-meyc.1): a blueprint list is a different job from
// "how are my blocks going", so templates live on their own `Sablonok` tab
// (mezo-tlwa) reached via the mosaic tile now, not a `.mesorow` nav row.
// Ported from prototype mesocycles.jsx MesocycleLibrary.
// ============================================================
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import type { Mesocycle } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { CtaGhost } from '@/shared/ui/Cta'
import { ActiveMesoCard } from '@/features/train/components/ActiveMesoCard'
import { PlannedMesoCard } from '@/features/train/components/PlannedMesoCard'
import { ArchivedMesoCard } from '@/features/train/components/ArchivedMesoCard'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import { runToTemplate } from '@/features/train/logic/runToTemplate'
import { runBands } from '@/features/train/logic/mesoBands'
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import MesocycleSkeleton from '@/features/train/pages/MesocycleSkeleton'

export function MesocycleLibraryPage() {
  const { mesocycles, workoutPending } = useTrain()
  const { templates, pending: templatesPending, rerun, createTemplate } = useMesoTemplates()
  const navigate = useNavigate()
  // The template the start sheet is open on (null = closed). A rerun resolves its
  // template id first, then lands here — one start surface for both entries.
  const [startTemplate, setStartTemplate] = useState<{ id: string; title?: string } | null>(null)
  // „Összevetés" mode over the Történet section (mezo-meyc.4): while it is on, a history card
  // tap SELECTS the run instead of opening its report. Two ids max — the compare view is
  // strictly pairwise — kept in TAP ORDER, which is what makes the tap the `a`/`b` choice.
  const [compareMode, setCompareMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // The `Történet` tile has nowhere else to jump (F2.7 owns a dedicated history route) —
  // the section is already rendered below the mosaic, so the tile scrolls it into view.
  const historyRef = useRef<HTMLDivElement>(null)

  // Real-mode loading: show the layout-aware skeleton until the meso + template lists
  // resolve. `mesocycles` comes from the meso query that drives workoutPending, so branch
  // on it before the T0 empty-state. After all hooks. Mock seeds synchronously → no skeleton.
  if (workoutPending || templatesPending) return <MesocycleSkeleton />

  const active = mesocycles.filter((m) => m.status === 'active')
  const planned = mesocycles.filter((m) => m.status === 'planned')
  const archived = mesocycles.filter((m) => m.status === 'archived')

  const openBuilder = (id: string) => navigate(`/train/mesocycles/${id}`)
  // A closed run opens its FROZEN report, not the builder (mezo-meyc.2) — the builder
  // redirects there anyway, so route the card straight at the destination.
  const openReport = (id: string) => navigate(`/train/mesocycles/${id}/report`)
  const openPlanner = () => navigate('/train/mesocycles/new')
  const openTemplateEditor = (id: string) => navigate(`/train/mesocycles/templates/${id}`)
  const openTemplates = () => navigate('/train/templates')
  // The hub's first tile (mesocycle pages v2 Task 2, mezo-d20.15). Its route lands in
  // Task 4 — navigating there now hits the router's no-match, same as any other
  // not-yet-built destination mid-slice.
  const openWeek = (id: string) => navigate(`/train/mesocycles/${id}/week`)
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
  const scrollToHistory = () => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Edzés · Mesociklusok</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>Mesociklusok</PageTitle>
        </div>
        <button type="button" onClick={openPlanner} className="pgact">
          <Icon name="plus" size={14} /> Új
        </button>
      </div>

      {/* T0 clean slate: brand-new library gets a short orientation hint; the header's
          `+ Új` chip stays the creation action (the planner saves a template). */}
      {mesocycles.length === 0 && (
        <div style={{ padding: '8px 24px 0' }}>
          <GhostState lines={2} message="Még nincs mesociklusod — itt fognak élni a blokkjaid." />
        </div>
      )}

      <EntranceGroup>
        {/* The hub's real navigation — Volumen/Történet/Sablonok/Új blokk tiles
            (mezociklus prototype's base panel). */}
        <div style={{ padding: '8px 24px 16px' }} data-kalauz-anchor="mesociklus-mosaic">
          <Mosaic>
            {active[0] && (
              <Tile
                wash="coral"
                icon="i-heti"
                eyebrow="Heti vizsgálat"
                line={`W${active[0].currentWeek} · ${runBands(active[0]).reduce((s, r) => s + r.current, 0)} szett`}
                delayMs={40}
                onClick={() => openWeek(active[0].id)}
              />
            )}
            <Tile
              wash="white"
              icon="i-naplo"
              eyebrow="Történet"
              line={`${archived.length} futam`}
              delayMs={80}
              onClick={scrollToHistory}
              aria-label={`Történet · ${archived.length}`}
            />
            <Tile
              wash="gold"
              icon="i-polc"
              eyebrow="Sablonok"
              line={String(templates.length)}
              delayMs={120}
              onClick={openTemplates}
              aria-label={`Sablonok · ${templates.length}`}
            />
            <Tile
              wash="coral"
              icon="i-edzes"
              eyebrow="Új blokk"
              line="3 lépés · AI ›"
              delayMs={160}
              onClick={openPlanner}
              aria-label="Új blokk tervezése"
            />
          </Mosaic>
        </div>

        {/* Active */}
        <div style={{ padding: '8px 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow>Aktív · {active.length}</Eyebrow>
          {active[0] ? (
            <Eyebrow brand>
              Hét {active[0].currentWeek}/{active[0].weeks}
            </Eyebrow>
          ) : null}
        </div>
        {active.map((m) => (
          <ActiveMesoCard key={m.id} meso={m} onOpen={() => openBuilder(m.id)} />
        ))}
      </div>

      {/* Planned */}
      <div style={{ padding: '8px 24px 16px' }}>
        <div style={{ marginBottom: 12 }}>
          <Eyebrow>Tervezett · {planned.length}</Eyebrow>
        </div>
        <div className="col gap-sm">
          {planned.map((m) => (
            <PlannedMesoCard key={m.id} meso={m} onOpen={() => openBuilder(m.id)} />
          ))}
        </div>
      </div>

      {/* History — the closed runs */}
      <div ref={historyRef} style={{ padding: '8px 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Eyebrow>Történet · {archived.length}</Eyebrow>
          {/* Nothing to compare with fewer than two closed runs — the toggle stays away. */}
          {archived.length >= 2 && (
            <button
              type="button"
              className="chip tapchip"
              aria-pressed={compareMode}
              onClick={toggleCompareMode}
            >
              Összevetés
            </button>
          )}
        </div>
        <div className="col gap-sm">
          {archived.map((m) => (
            <ArchivedMesoCard
              key={m.id}
              meso={m}
              // One card, two meanings — the mode decides which (mezo-meyc.4).
              onOpen={() => (compareMode ? toggleSelected(m.id) : openReport(m.id))}
              onRerun={() => rerunMeso(m.id, m.title)}
              onSaveAsTemplate={() => saveAsTemplate(m)}
              selectMode={compareMode}
              selected={selectedIds.includes(m.id)}
            />
          ))}
          {compareMode && (
            selectedIds.length < 2 ? (
              <span className="text-secondary" style={{ fontSize: 13, padding: '0 2px' }}>
                {`Válassz két lezárt futamot (${selectedIds.length}/2).`}
              </span>
            ) : (
              <CtaGhost style={{ padding: 12 }} onClick={openCompare}>
                <Icon name="chevron-right" size={12} /> Összevetés megnyitása
              </CtaGhost>
            )
          )}
        </div>
      </div>
      </EntranceGroup>

      {startTemplate && (
        <MesoStartSheet
          templateId={startTemplate.id}
          title={startTemplate.title}
          onClose={() => setStartTemplate(null)}
        />
      )}
    </>
  )
}
