// ============================================================
// Mezo · MesoTemplateEditorPage (mezo-meyc.1) — the template's own day-plan
// editor at /train/mesocycles/templates/:id. Full-screen sibling route (no
// sub-nav): the page resolves the template, then renders the UNIFIED
// MesoWeekEditor (mezo-yty6) in `template` mode — the very same editor the
// wizard's third step renders. The old `pghead-np` head + <details> chrome is
// retired: one task, one UI.
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
import { useMesoTemplates, useTimingProfile } from '@/data/hooks'
import type { GymExercise, MesoDay, MesoTemplate, MusclePriorities } from '@/data/types'
import type { MesoTemplateUpsertRequest } from '@/data/train/trainApi'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { CtaGhost } from '@/shared/ui/Cta'
import { GhostState } from '@/shared/ui/GhostState'
import { MesoWeekEditor } from '@/features/train/components/MesoWeekEditor'
import { addExerciseWithDefaults } from '@/features/train/logic/exerciseDefaults'
import { seedDays, toDayInputs } from '@/features/train/logic/mesoDays'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'

// Same full-replace shape as the exercise-save path (a template has no per-field PATCH) —
// every edit on this page (day plan, rename, tiers) travels through this one helper.
function toUpsert(
  template: MesoTemplate,
  days: MesoDay[],
  goalPreset = template.goalPreset,
  musclePriorities = template.musclePriorities,
  // The unified editor renames the template in place, and the new title must ride the same
  // full-replace body as everything else — defaulting to the cache copy would silently
  // revert a rename on the very next day edit.
  title = template.title,
): MesoTemplateUpsertRequest {
  return {
    title,
    shortTitle: template.shortTitle,
    goal: template.goal,
    goalPreset,
    // Full-replace body (mezo-3m5m): the template's own musclePriorities map must ride
    // along every day/goal edit here or it silently resets to all-grow on the next PUT
    // (this editor has no per-field PATCH — see the module doc above; caught by the
    // mandated goalPreset grep-audit, mirroring the mezo-dq60 unlisted-site precedent).
    musclePriorities,
    weeks: template.weeks,
    split: template.split,
    style: template.style,
    phaseCurve: template.phaseCurve,
    notes: template.notes,
    volumePerMuscle: template.volumePerMuscle,
    days: toDayInputs(days),
  }
}

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

  // Remounts (and reseeds) only when the route points at another template.
  return (
    <TemplateDayEditor
      key={template.id}
      template={template}
      onPersist={(days, goalPreset, musclePriorities, title) =>
        updateTemplate(template.id, toUpsert(template, days, goalPreset, musclePriorities, title))
          // Failed mutations are toasted globally (§7a); the local edit stands and the
          // next change retries the whole document.
          .catch(() => {})}
    />
  )
}

// The editable day plan, rendered on the shared MesoWeekEditor in `template` mode.
// Mounted only once the template has resolved, so the one-shot seed always sees real
// days (MesoExercises gets the same guarantee from its parent resolving the meso first).
//
// Every write builds its upsert from THIS component's live state, never from the parent's
// `template` (query-cache) copy: updateTemplate is invalidate-only, so between an edit and
// the refetch landing (or after a failed PUT, whose local edit deliberately stands) the
// cache copy is stale, and full-replacing from it would silently revert an edit the UI
// still shows as applied.
//
// NOTE (mezo-yty6): the tier (`Fókusz`) picker moved into the wizard interview; there is no
// tier editing on a saved template this round. `priorities` is still read off the template
// and still rides along EVERY PUT below — dropping it from the body would reset the map to
// all-grow on the next write (mezo-3m5m).
function TemplateDayEditor({ template, onPersist }: {
  template: MesoTemplate
  onPersist: (
    days: MesoDay[],
    goalPreset?: string | null,
    musclePriorities?: MusclePriorities | null,
    title?: string,
  ) => void
}) {
  const goBack = useBackNav('/train/mesocycles')
  const [days, setDays] = useState<MesoDay[]>(() => seedDays(template.days ?? []))
  const [priorities] = useState<MusclePriorities>(() => template.musclePriorities ?? {})
  const [name, setName] = useState(template.title)
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [pickerDay, setPickerDay] = useState<string | null>(null)
  // Calibrated pacing (mezo-dzbm) fetched here (a pages/ component) and passed down as a
  // prop: components/ stay presentational, pages/ own data fetching (frontend_conventions).
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()

  // The title AND the priority map ride along the same full-replace document as every
  // other edit; `title` is overridable because setName's new value is not readable yet
  // in the same tick as the rename that produced it.
  const persist = (next: MesoDay[], title = name) => onPersist(next, undefined, priorities, title)

  const apply = (next: MesoDay[]) => {
    setDays(next)
    persist(next)
  }

  const patchDay = (dayKey: string, fn: (d: MesoDay) => MesoDay) =>
    apply(days.map((d) => (d.day === dayKey ? fn(d) : d)))

  const withExercises = (d: MesoDay, exercises: GymExercise[]): MesoDay =>
    ({ ...d, exercises, exerciseCount: exercises.length })

  const pickerLabel = (() => {
    const d = pickerDay ? days.find((x) => x.day === pickerDay) : undefined
    return d ? `${d.day} · ${d.type}` : undefined
  })()

  return (
    <>
      <MesoWeekEditor
        mode="template"
        name={name}
        meta={[`${template.weeks} hét`, template.split, `${template.runCount}× futtatva`]
          .filter(Boolean).join(' · ')}
        note={template.goal ?? undefined}
        days={days}
        priorities={priorities}
        volumePerMuscle={template.volumePerMuscle ?? null}
        timingProfile={timingProfile}
        timingProfilePending={timingProfilePending}
        activeDay={activeDay}
        onOpenDay={(day) => {
          setActiveDay(day)
          // A closing day page must not leave the exercise picker able to reopen against a
          // stale day (Task 9's rule, mirrored here).
          if (day === null) setPickerDay(null)
        }}
        onBack={goBack}
        onRename={(next) => { setName(next); persist(days, next) }}
        onRenameDay={(dayKey, next) => patchDay(dayKey, (d) => ({ ...d, type: next }))}
        onChangeExercise={(dayKey, exId, patch) => patchDay(dayKey, (d) =>
          withExercises(d, d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e))))}
        onMoveExercise={(dayKey, exId, dir) => patchDay(dayKey, (d) => {
          const i = d.exercises.findIndex((e) => e.id === exId)
          const j = i + dir
          if (i < 0 || j < 0 || j >= d.exercises.length) return d
          const next = [...d.exercises]
          ;[next[i], next[j]] = [next[j], next[i]]
          return withExercises(d, next)
        })}
        onRemoveExercise={(dayKey, exId) => patchDay(dayKey, (d) =>
          withExercises(d, d.exercises.filter((e) => e.id !== exId)))}
        onAddClick={setPickerDay}
      />
      {pickerDay && (
        <ExercisePickerSheet
          dayLabel={pickerLabel}
          onClose={() => setPickerDay(null)}
          onPick={(item) => patchDay(pickerDay, (d) =>
            addExerciseWithDefaults(d, item, template.goalPreset))}
        />
      )}
    </>
  )
}
