// ============================================================
// Mezo · MesoKonyvtarPage (Train Titanium T9 Task 2, mezo-88iwa.10) — the plan
// library, moved intact behind a quiet doorway at /train/mesocycles/konyvtar.
// The landing (`MesocycleLibraryPage`) inverted to the running block's own
// page (T3 renames it `MesoTervPage`); everything that used to be the hub's
// real navigation — Sablonok/Új blokk/Futóblokkok tiles, the Tervezett list,
// the Történet section with the mezo-meyc.4 Összevetés selection mode — moved
// here VERBATIM (markup + handlers unchanged) so nothing loses its entry (the
// T4 reachability lesson). T10 refaces this page; until then it keeps the
// DS-era section faces as-is.
// Ported from MesocycleLibraryPage.tsx (mezo-d20.3.6 / mezo-tlwa / mezo-meyc.4).
// ============================================================
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import type { Mesocycle } from '@/data/types'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Icon } from '@/shared/ui/Icon'
import { CtaGhost } from '@/shared/ui/Cta'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PlannedMesoCard } from '@/features/train/components/PlannedMesoCard'
import { ArchivedMesoCard } from '@/features/train/components/ArchivedMesoCard'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import { runToTemplate } from '@/features/train/logic/runToTemplate'
import { Mosaic, Tile, MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import MesocycleSkeleton from '@/features/train/pages/MesocycleSkeleton'

export function MesoKonyvtarPage() {
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
  // on it before rendering. Mock seeds synchronously → no skeleton.
  if (workoutPending || templatesPending) return <MesocycleSkeleton />

  const planned = mesocycles.filter((m) => m.status === 'planned')
  const archived = mesocycles.filter((m) => m.status === 'archived')

  const openBuilder = (id: string) => navigate(`/train/mesocycles/${id}`)
  // A closed run opens its FROZEN report, not the builder (mezo-meyc.2) — the builder
  // redirects there anyway, so route the card straight at the destination.
  const openReport = (id: string) => navigate(`/train/mesocycles/${id}/report`)
  const openPlanner = () => navigate('/train/mesocycles/new')
  const openTemplateEditor = (id: string) => navigate(`/train/mesocycles/templates/${id}`)
  const openTemplates = () => navigate('/train/templates')
  // Futóblokkok entry (final-review fix wave, mezo-88iwa.5): the hub retirement left
  // `Futás` (owned by Terv — navModel.ts) with no entry point of its own once the
  // six-tile hub disappeared. Same mosaic-tile idiom as the other nav tiles.
  const openFutas = () => navigate('/train/futas')
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
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/train/mesocycles')} label="‹ Terv">
        <PageTitle style={{ margin: 0 }}>Edzéstervek</PageTitle>
      </PageHead>
      <PageBody>
        <EntranceGroup>
          {/* The library's real navigation — Sablonok/Új blokk/Futóblokkok tiles
              (mezociklus prototype's base panel), moved intact from the landing. */}
          <div style={{ padding: '8px 0 16px' }} data-kalauz-anchor="konyvtar-mosaic">
            <Mosaic>
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
                /* One screen since mezo-yty6 — the 3-step wizard is gone. */
                line="Egy képernyő · AI ›"
                delayMs={160}
                onClick={openPlanner}
                aria-label="Új blokk tervezése"
              />
              <Tile
                wash="sky"
                icon="i-futas"
                eyebrow="Futóblokkok"
                line="Terv · napló"
                delayMs={200}
                onClick={openFutas}
                aria-label="Futóblokkok"
              />
            </Mosaic>
          </div>

          {/* Planned */}
          <div style={{ padding: '8px 0 16px' }}>
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
          <div ref={historyRef} style={{ padding: '8px 0 24px' }}>
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
      </PageBody>
    </MozaikPage>
  )
}
