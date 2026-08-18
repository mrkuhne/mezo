// ============================================================
// Mezo · MesoTemplatesPage (mezo-tlwa) — the dedicated `Sablonok` Train tab at
// /train/templates. The template half of the mezo-meyc.1 template/run split now
// lives HERE instead of on top of the run library (which became runs-only and
// keeps a `.mesorow` nav row pointing at this page): a blueprint list is a
// different job from "how are my blocks going", and templates gained enough
// actions to need the room.
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
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMesoTemplates } from '@/data/hooks'
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

      <div style={{ padding: '8px 24px 24px' }}>
        <div style={{ marginBottom: 12 }}>
          <Eyebrow>Sablonok · {templates.length}</Eyebrow>
        </div>
        {templates.length === 0 && (
          <div style={{ marginBottom: 12 }}>
            <GhostState lines={2} message="Még nincs sablonod." />
          </div>
        )}
        <div className="col gap-sm">
          {templates.map((t) => (
            <MesoTemplateCard
              key={t.id}
              template={t}
              onEdit={() => openEditor(t.id)}
              onStart={() => setStartTemplate({ id: t.id, title: t.title })}
              onDuplicate={() => duplicate(t)}
              onDelete={() => remove(t.id)}
            />
          ))}
          {/* The shared dashed "add one more" CTA every DS list closes with. */}
          <button type="button" onClick={openPlanner} className="card dashedcta">
            + Új sablon tervezése
          </button>
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
