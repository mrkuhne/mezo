// ============================================================
// Mezo · MesoTemplatesPage (mezo-tlwa) — the dedicated `Sablonok` Train tab at
// /train/templates. The template half of the mezo-meyc.1 template/run split now
// lives HERE instead of on top of the run library (which became runs-only and
// keeps a Mosaic tile pointing at this page): a blueprint list is a
// different job from "how are my blocks going", and templates gained enough
// actions to need the room. A Train page (a full-page sibling of the Edzés hub, mezo-d20.3.6
// hub slice) — it keeps the Train sub-nav around it, NOT a full-screen sibling
// (train.nav.test.tsx pins this), so it stays on the plain DS page-header shell
// rather than the MozaikPage/PageHero scaffold its full-screen siblings
// (MesoOverviewPage/MesoReportPage/MesoComparePage) use.
//
// Layout: DS page head (`Edzés · Sablonok` + `+ Új` → the planner) → a counted
// section of `MesoTemplateCard`s → the shared dashed "plan one more" CTA. Each
// card offers four actions: Szerkesztés (the template editor), Indítás (the one
// shared MesoStartSheet), Duplikálás and Törlés.
//
// Duplikálás re-sends the template's OWN document as a fresh create (days via the
// shared `toDayInputs`, volume baselines passed through) under a `(másolat)`
// title, then lands in the copy's editor — a duplicate exists to be changed, so
// the editor is where the flow wants to end. Törlés is a soft delete: past runs
// and their frozen reports are untouched (the confirm lives in the card).
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMesoTemplates } from '@/data/hooks'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import type { MesoTemplate } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { MesoTemplateCard } from '@/features/train/components/MesoTemplateCard'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import { toDayInputs } from '@/features/train/logic/mesoDays'
import MesoTemplatesSkeleton from '@/features/train/pages/MesoTemplatesSkeleton'

export function MesoTemplatesPage() {
  const { templates, pending, createTemplate, deleteTemplate } = useMesoTemplates()
  const navigate = useNavigate()
  // The template the start sheet is open on (null = closed) — same wiring the library
  // uses for a rerun, one start surface for every entry (mezo-meyc.1).
  const [startTemplate, setStartTemplate] = useState<{ id: string; title?: string } | null>(null)

  // Real-mode loading: the list query is the whole page, so wait it out behind the
  // layout-matched skeleton. Mock seeds synchronously → never shows. After all hooks.
  if (pending) return <MesoTemplatesSkeleton />

  const openPlanner = () => navigate('/train/mesocycles/new')
  const openEditor = (id: string) => navigate(`/train/mesocycles/templates/${id}`)
  // Failed mutations are toasted globally (§7a) — the handlers have nothing richer to
  // add, so they swallow the rejection and leave the list as it was.
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
  const remove = (id: string) => {
    deleteTemplate(id).catch(() => {})
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Edzés · Sablonok</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>Sablonok</PageTitle>
        </div>
        <button type="button" onClick={openPlanner} className="pgact">
          <Icon name="plus" size={14} /> Új
        </button>
      </div>

      {/* One-shot entrance choreography (mezo-d20.11): the page had none. The
          prototype does not draw a standalone Sablonok PAGE (it is a section on
          Mesociklus), so the FACE stays as-is — F7 territory — but its list
          speaks the same staggered `.rise` cadence as every other Edzés list. */}
      <EntranceGroup>
      <div style={{ padding: '8px 24px 24px' }}>
        <div className="rise" style={{ marginBottom: 12, '--d': '30ms' } as CSSProperties}>
          <Eyebrow>Sablonok · {templates.length}</Eyebrow>
        </div>
        {templates.length === 0 && (
          <div className="rise" style={{ marginBottom: 12, '--d': '60ms' } as CSSProperties}>
            <GhostState lines={2} message="Még nincs sablonod." />
          </div>
        )}
        <div className="col gap-sm">
          {templates.map((t, i) => (
            <div key={t.id} className="rise" style={{ '--d': `${60 + i * 45}ms` } as CSSProperties}>
              <MesoTemplateCard
                template={t}
                onEdit={() => openEditor(t.id)}
                onStart={() => setStartTemplate({ id: t.id, title: t.title })}
                onDuplicate={() => duplicate(t)}
                onDelete={() => remove(t.id)}
              />
            </div>
          ))}
          {/* The shared dashed "add one more" CTA every DS list closes with. */}
          <button
            type="button"
            onClick={openPlanner}
            className="card dashedcta rise"
            style={{ '--d': `${60 + templates.length * 45}ms` } as CSSProperties}
          >
            + Új sablon tervezése
          </button>
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
