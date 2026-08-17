// ============================================================
// Mezo · MesocycleLibraryPage (Mesociklusok) — the mesocycle library.
// Template/run split (mezo-meyc.1): Sablonok (reusable blueprints + the "plan
// new" CTA — the planner saves templates now) → Aktív hero → Tervezett →
// Történet (closed runs, each rerunnable). Thin TrainSection shell ⇒ this view
// owns its own .page-header, whose `+ Új` chip and the Sablonok CTA navigate to
// the planner; live run cards navigate to their builder, a CLOSED run card to its
// frozen report (mezo-meyc.2), template cards to the template editor. Both
// „Indítás" (template) and „Újrafuttatás" (closed run) funnel into the one
// shared MesoStartSheet.
// Ported from prototype mesocycles.jsx MesocycleLibrary.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useMesoTemplates } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { ActiveMesoCard } from '@/features/train/components/ActiveMesoCard'
import { PlannedMesoCard } from '@/features/train/components/PlannedMesoCard'
import { ArchivedMesoCard } from '@/features/train/components/ArchivedMesoCard'
import { MesoTemplateCard } from '@/features/train/components/MesoTemplateCard'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import MesocycleSkeleton from '@/features/train/pages/MesocycleSkeleton'

export function MesocycleLibraryPage() {
  const { mesocycles, workoutPending } = useTrain()
  const { templates, pending: templatesPending, rerun } = useMesoTemplates()
  const navigate = useNavigate()
  // The template the start sheet is open on (null = closed). A rerun resolves its
  // template id first, then lands here — one start surface for both entries.
  const [startTemplate, setStartTemplate] = useState<{ id: string; title?: string } | null>(null)

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
  const rerunMeso = (id: string, title: string) => {
    rerun(id)
      .then(({ templateId }) => setStartTemplate({ id: templateId, title }))
      // Failed mutations are toasted globally (§7a) — nothing extra to do but stay put.
      .catch(() => {})
  }

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

      {/* T0 clean slate: brand-new library gets a short orientation hint; the
          Sablonok section's dashed CTA below stays the single creation action. */}
      {mesocycles.length === 0 && (
        <div style={{ padding: '8px 24px 0' }}>
          <GhostState lines={2} message="Még nincs mesociklusod — itt fognak élni a blokkjaid." />
        </div>
      )}

      {/* Templates — the reusable blueprints every run is stamped from */}
      <div style={{ padding: '8px 24px 16px' }}>
        <div style={{ marginBottom: 12 }}>
          <Eyebrow>Sablonok · {templates.length}</Eyebrow>
        </div>
        <div className="col gap-sm">
          {templates.map((t) => (
            <MesoTemplateCard
              key={t.id}
              template={t}
              onEdit={() => openTemplateEditor(t.id)}
              onStart={() => setStartTemplate({ id: t.id, title: t.title })}
            />
          ))}
          {/* The shared dashed "add one more" CTA the Mai/Heti/Sport lists close with. */}
          <button type="button" onClick={openPlanner} className="card dashedcta">
            + Új mesociklus tervezése
          </button>
        </div>
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
      <div style={{ padding: '8px 24px 24px' }}>
        <div style={{ marginBottom: 12 }}>
          <Eyebrow>Történet · {archived.length}</Eyebrow>
        </div>
        <div className="col gap-sm">
          {archived.map((m) => (
            <ArchivedMesoCard
              key={m.id}
              meso={m}
              onOpen={() => openReport(m.id)}
              onRerun={() => rerunMeso(m.id, m.title)}
            />
          ))}
        </div>
      </div>

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
