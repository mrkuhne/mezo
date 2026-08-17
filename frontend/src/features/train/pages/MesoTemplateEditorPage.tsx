// ============================================================
// Mezo · MesoTemplateEditorPage (mezo-meyc.1) — the template's own day-plan
// editor at /train/mesocycles/templates/:id. Full-screen sibling route (no
// sub-nav, MesoOverviewPage idiom): sticky back breadcrumb → header (title +
// goal + weeks/split/run-count meta) → the shared MesoEditor over the
// template's days, with the exercise picker.
//
// Persistence mirrors MesoExercises: local day-state is authoritative and
// updates synchronously (instant UI), each add/remove/change/reorder fires a
// background write — here a full-template PUT via updateTemplate, since a
// template has no per-day row endpoint. The response is deliberately NOT
// reseeded into state: the server regenerates every exercise id on a full
// write, so re-seeding would swap the ids out from under the open accordion.
// ============================================================
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMesoTemplates } from '@/data/hooks'
import type { ExerciseLibraryItem, GymExercise, MesoDay, MesoTemplate } from '@/data/types'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { CtaGhost } from '@/shared/ui/Cta'
import { GhostState } from '@/shared/ui/GhostState'
import { MesoEditor } from '@/features/train/components/MesoEditor'
import { libraryToGymExercise } from '@/features/train/logic/exerciseDefaults'
import { seedDays, toDayInputs } from '@/features/train/logic/mesoDays'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'

export function MesoTemplateEditorPage() {
  const { id } = useParams<{ id: string }>()
  const goBack = useBackNav('/train/mesocycles')
  const { templates, pending, updateTemplate } = useMesoTemplates()
  const template = templates.find((t) => t.id === id)

  const backBar = (
    <div className="sticky-top" style={{ padding: '8px 24px' }}>
      <button type="button" onClick={goBack} className="row gap-sm">
        <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>←</span>
        <span className="eyebrow">Vissza</span>
      </button>
    </div>
  )

  // Real-mode load: the list query is what resolves the template, so wait it out
  // before deciding "not found" (mock seeds synchronously → never shows).
  if (pending) {
    return (
      <div>
        {backBar}
        <div style={{ padding: '12px 24px' }}>
          <GhostState lines={3} message="Sablon betöltése…" />
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div>
        {backBar}
        <div style={{ padding: '12px 24px' }}>
          <p className="text-secondary" style={{ fontSize: 14 }}>Ez a sablon nem található.</p>
          <div className="mt-lg">
            <CtaGhost onClick={goBack}>← Mesociklusok</CtaGhost>
          </div>
        </div>
      </div>
    )
  }

  return (
    // Inside AppLayout's .screen-content scroller — no nested wrapper (MesoOverviewPage idiom).
    <div>
      {backBar}
      <div style={{ padding: '6px 24px 0' }}>
        <span className="eyebrow">Sablon · {template.runCount}× futtatva</span>
      </div>
      <div className="pghead-np">
        <div>
          <div className="over">Edzés · Sablon</div>
          <h1>{template.title}</h1>
        </div>
      </div>
      {template.goal ? (
        <div style={{ padding: '6px 24px 4px' }}>
          <span className="text-secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>{template.goal}</span>
        </div>
      ) : null}
      <div className="row gap-md" style={{ padding: '4px 24px 8px' }}>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{template.weeks} hét</span>
        {template.split ? (
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{template.split}</span>
        ) : null}
      </div>

      {/* Remounts (and reseeds) only when the route points at another template. */}
      <TemplateDayEditor key={template.id} template={template} onPersist={(days) => updateTemplate(template.id, {
        title: template.title,
        shortTitle: template.shortTitle,
        goal: template.goal,
        weeks: template.weeks,
        split: template.split,
        style: template.style,
        phaseCurve: template.phaseCurve,
        notes: template.notes,
        volumePerMuscle: template.volumePerMuscle,
        days: toDayInputs(days),
      // Failed mutations are toasted globally (§7a); the local edit stands and the
      // next change retries the whole document.
      }).catch(() => {})} />
    </div>
  )
}

// The editable day plan. Mounted only once the template has resolved, so the
// one-shot seed always sees real days (MesoExercises gets the same guarantee
// from its parent resolving the meso first).
function TemplateDayEditor({ template, onPersist }: {
  template: MesoTemplate
  onPersist: (days: MesoDay[]) => void
}) {
  const [days, setDays] = useState<MesoDay[]>(() => seedDays(template.days ?? []))
  const [pickerDay, setPickerDay] = useState<string | null>(null)

  const apply = (next: MesoDay[]) => {
    setDays(next)
    onPersist(next)
  }

  const removeExercise = (dayKey: string, exId: string) => {
    apply(days.map((d) => {
      if (d.day !== dayKey) return d
      const exercises = d.exercises.filter((e) => e.id !== exId)
      return { ...d, exercises, exerciseCount: exercises.length }
    }))
  }

  const updateExercise = (dayKey: string, exId: string, patch: Partial<GymExercise>) => {
    apply(days.map((d) => {
      if (d.day !== dayKey) return d
      return { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)) }
    }))
  }

  const addExercise = (dayKey: string, item: ExerciseLibraryItem) => {
    apply(days.map((d) => {
      if (d.day !== dayKey) return d
      const exercises = [...d.exercises, libraryToGymExercise(item)]
      return { ...d, exercises, exerciseCount: exercises.length }
    }))
  }

  const reorderExercises = (dayKey: string, ids: string[]) => {
    apply(days.map((d) => {
      if (d.day !== dayKey) return d
      const byId = new Map(d.exercises.map((e) => [e.id, e]))
      return { ...d, exercises: ids.map((i) => byId.get(i)).filter(Boolean) as GymExercise[] }
    }))
  }

  return (
    <div className="col">
      <div style={{ padding: '12px 24px' }}>
        <MesoEditor
          days={days}
          onAddClick={setPickerDay}
          onRemove={removeExercise}
          onChange={updateExercise}
          onReorder={reorderExercises}
        />
      </div>

      {pickerDay && (
        <ExercisePickerSheet
          dayLabel={(() => {
            const d = days.find((x) => x.day === pickerDay)
            return d ? `${d.day} · ${d.type}` : undefined
          })()}
          onClose={() => setPickerDay(null)}
          onPick={(item) => addExercise(pickerDay, item)}
        />
      )}
    </div>
  )
}
