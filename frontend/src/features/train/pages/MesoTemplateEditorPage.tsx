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
import { useMesoTemplates, useTimingProfile } from '@/data/hooks'
import type { ExerciseLibraryItem, GymExercise, MesoDay, MesoTemplate, MusclePriorities } from '@/data/types'
import type { MesoTemplateUpsertRequest } from '@/data/train/trainApi'
import { GOAL_PRESETS } from '@/data/train/train'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { CtaGhost } from '@/shared/ui/Cta'
import { GhostState } from '@/shared/ui/GhostState'
import { MesoEditor } from '@/features/train/components/MesoEditor'
import { MusclePriorityPicker } from '@/features/train/components/MusclePriorityPicker'
import { addExerciseWithDefaults } from '@/features/train/logic/exerciseDefaults'
import { seedDays, toDayInputs } from '@/features/train/logic/mesoDays'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'

// The Cél select's options — the six wizard presets plus an empty "unset" one
// (labeled with the fallback it actually behaves as — SCHEMES defaults an
// unset/unknown preset to hypertrophy, see exerciseDefaults.ts).
const GOAL_PRESET_OPTIONS = [{ value: '', label: '— (hypertrophy)' }, ...GOAL_PRESETS.map((p) => ({ value: p.id, label: p.label }))]

// Same full-replace shape as the exercise-save path (a template has no per-field PATCH) —
// shared here so the Cél select AND the Fókusz tier picker persist through the identical
// upsert helper.
function toUpsert(
  template: MesoTemplate,
  days: MesoDay[],
  goalPreset = template.goalPreset,
  musclePriorities = template.musclePriorities,
): MesoTemplateUpsertRequest {
  return {
    title: template.title,
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
      {/* Remounts (and reseeds) only when the route points at another template. */}
      <TemplateDayEditor
        key={template.id}
        template={template}
        onPersist={(days, goalPreset, musclePriorities) => updateTemplate(template.id, toUpsert(template, days, goalPreset, musclePriorities))
          // Failed mutations are toasted globally (§7a); the local edit stands and the
          // next change retries the whole document.
          .catch(() => {})}
      />
    </div>
  )
}

// The editable day plan. Mounted only once the template has resolved, so the
// one-shot seed always sees real days (MesoExercises gets the same guarantee
// from its parent resolving the meso first).
//
// The Cél select also lives here rather than on the parent page: it must build
// its upsert from THIS component's live `days` state, not the parent's
// `template` (query-cache) copy — otherwise a goal change between an exercise
// edit and the refetch landing (or after a failed day PUT, whose local edit
// deliberately stands) full-replaces the template with the pre-edit day list,
// silently reverting an edit the UI still shows as applied.
function TemplateDayEditor({ template, onPersist }: {
  template: MesoTemplate
  onPersist: (days: MesoDay[], goalPreset?: string | null, musclePriorities?: MusclePriorities | null) => void
}) {
  const [days, setDays] = useState<MesoDay[]>(() => seedDays(template.days ?? []))
  // Same local-authoritative idiom as `days` above: seeded once from the prop, then the
  // single source of truth for the picker AND the editor's budgets/lint. updateTemplate is
  // invalidate-only (no optimistic cache write), so reading `template.musclePriorities`
  // directly here would lag until refetch — two rapid picks would both build off the same
  // stale map and the second onChange would full-replace away the first pick (mezo-3m5m
  // final review, fix 2).
  const [priorities, setPriorities] = useState<MusclePriorities>(() => template.musclePriorities ?? {})
  const [pickerDay, setPickerDay] = useState<string | null>(null)
  // Calibrated pacing (Task 12, mezo-dzbm) for the MesoEditor hero below — fetched here
  // (a pages/ component) and passed down as a prop: components/ stay presentational, pages/
  // own data fetching (frontend_conventions.md).
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()

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
    apply(days.map((d) => (d.day === dayKey ? addExerciseWithDefaults(d, item, template.goalPreset) : d)))
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
      <div className="row gap-md" style={{ padding: '4px 24px 8px', alignItems: 'center' }}>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{template.weeks} hét</span>
        {template.split ? (
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{template.split}</span>
        ) : null}
        <select
          aria-label="Cél"
          value={template.goalPreset ?? ''}
          // Built from THIS render's `days`/`priorities` state (current, possibly
          // unsaved-to-server edits included) — never the parent's query-cache
          // `template.days`/`template.musclePriorities` copy (the latter would otherwise
          // clobber a tier pick still in flight — mezo-3m5m final review, fix 2).
          onChange={(e) => onPersist(days, e.target.value || null, priorities)}
          style={{ fontSize: 9, color: 'var(--text-primary)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', padding: '3px 6px' }}
        >
          {GOAL_PRESET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <details style={{ padding: '0 24px 8px' }}>
        <summary className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
          Fókusz
        </summary>
        <div style={{ marginTop: 8 }}>
          <MusclePriorityPicker
            value={priorities}
            // Built from THIS render's `days` state — same stale-cache rule as the Cél
            // select above (:121-130): never the parent's query-cache `template.days` copy.
            onChange={(next) => {
              setPriorities(next)
              onPersist(days, undefined, next)
            }}
          />
        </div>
      </details>
      <div style={{ padding: '12px 24px' }}>
        <MesoEditor
          days={days}
          onAddClick={setPickerDay}
          onRemove={removeExercise}
          onChange={updateExercise}
          onReorder={reorderExercises}
          priorities={priorities}
          volumePerMuscle={template.volumePerMuscle ?? undefined}
          timingProfile={timingProfile}
          timingProfilePending={timingProfilePending}
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
