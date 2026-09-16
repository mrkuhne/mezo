// ============================================================
// Mezo · MesoFutamokPage — „Lezárt futamaid" at /train/mesocycles/futamok.
//
// Train Titanium T10 Task 2 (mezo-88iwa.11) — a DELIBERATE STUB. The library
// landing's Titanium reface drops its list of closed runs, so this page exists
// so that nothing becomes unreachable in the same commit (the T4 reachability
// lesson): the whole Történet section — the `ArchivedMesoCard` list, the
// mezo-meyc.4 „Összevetés" pairing mode, „Újrafuttatás" (which reruns a closed
// run and opens `MesoStartSheet` on its originating template) and „Sablonná"
// (which forks the run's plan into a new template) — moved here VERBATIM from
// `MesoKonyvtarPage`, markup and handlers unchanged.
//
// Task 4 gives this page its own Titanium face (`.pl-lhero.is-closed` hero with
// the run stars, `.pl-lib-card.is-closed` rows built on `logic/libraryStory.ts`).
// Until then it is intentionally markup-light: a heading, a back pill, and the
// moved section exactly as it was.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import type { Mesocycle } from '@/data/types'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Icon } from '@/shared/ui/Icon'
import { CtaGhost } from '@/shared/ui/Cta'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { ArchivedMesoCard } from '@/features/train/components/ArchivedMesoCard'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import { runToTemplate } from '@/features/train/logic/runToTemplate'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import MesocycleSkeleton from '@/features/train/pages/MesocycleSkeleton'

export function MesoFutamokPage() {
  const { mesocycles, workoutPending } = useTrain()
  const { pending: templatesPending, rerun, createTemplate } = useMesoTemplates()
  const navigate = useNavigate()
  // The template the start sheet is open on (null = closed). A rerun resolves its
  // template id first, then lands here — one start surface for both entries.
  const [startTemplate, setStartTemplate] = useState<{ id: string; title?: string } | null>(null)
  // „Összevetés" mode (mezo-meyc.4): while it is on, a history card tap SELECTS the run
  // instead of opening its report. Two ids max — the compare view is strictly pairwise —
  // kept in TAP ORDER, which is what makes the tap the `a`/`b` choice.
  const [compareMode, setCompareMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  if (workoutPending || templatesPending) return <MesocycleSkeleton />

  const archived = mesocycles.filter((m) => m.status === 'archived')

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
      <PageHead onBack={() => navigate('/train/mesocycles/konyvtar')} label="‹ Edzéstervek">
        <PageTitle style={{ margin: 0 }}>Lezárt futamaid</PageTitle>
      </PageHead>
      <PageBody>
        <EntranceGroup>
          <div style={{ padding: '8px 0 24px' }}>
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
