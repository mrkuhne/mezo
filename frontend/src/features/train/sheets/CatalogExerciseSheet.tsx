// ============================================================
// Mezo · CatalogExerciseSheet — author (create/edit) a user-owned catalog
// exercise. Name input, muscle segmented picker (13 tokens), type segmented
// (compound|isolation|plyo), stim + fatigue decimal steppers (0–1, step 0.05),
// video URL input, Mentés CTA (disabled when the name is blank). Create mode
// calls createCatalogExercise; edit mode (edit prop) calls updateCatalogExercise
// and also hosts the destructive path: a two-tap-confirm Törlés button calling
// deleteCatalogExercise (moved here from the page's RowActions, mezo-kaui).
// The mutation's onSuccess closes the sheet (animated). Follows the
// ExercisePickerSheet / SportLogSheet visual idiom (chip picker + notch cards).
//
// Üveg (mezo-me75u.4, bible U2 rule 15): ONE floating amber glass sheet (10px off the
// edges, 30px radius), the t-muscle 3D art in the head; every control inside is a flat
// cell or a lit flat pill (never glass in glass) — the active chip / type filled amber,
// Mentés a lit amber pill. CSS: the `── uveg edzes gyakorlatok (` block, `.gyx-sheet`.
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'
import { REGION_MUSCLES, REGION_LABELS } from '@/features/train/logic/muscleColors'
import type { CatalogExerciseCreateRequest } from '@/data/train/trainApi'
import type { ExerciseLibraryItem } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'

// The 21 head/zone-specific catalog muscle tokens (mezo-wu1s), region-grouped for the
// picker below. This mirrors the contract's CatalogExerciseCreateRequest.muscle enum;
// the built request body is validated against that union by `satisfies`.
type MuscleKey = CatalogExerciseCreateRequest['muscle']
const DEFAULT_MUSCLE: MuscleKey = 'back-mid'

const TYPES = ['compound', 'isolation', 'plyo'] as const
type ExType = (typeof TYPES)[number]

// Clamp + round to a 0.05 grid without float drift (0.7 + 0.05 → 0.75, not 0.7500001).
const round2 = (n: number) => Math.round(n * 100) / 100

// --- DecimalStep: label + display + 44px ± buttons over a 0–1 / step-0.05 range ---
function DecimalStep({ label, val, onChange }: { label: string; val: number; onChange: (n: number) => void }) {
  return (
    <div className="gyx-sh-field">
      <div className="gyx-sh-steprow">
        <span className="uv-eyebrow">{label}</span>
        <span className="gyx-sh-num">{val.toFixed(2)}</span>
      </div>
      <div className="gyx-sh-stepper uv-flat">
        <button type="button" aria-label={`${label} csökkentése`} onClick={() => onChange(round2(Math.max(0, val - 0.05)))}>
          <Icon name="minus" size={14} />
        </button>
        <span className="gyx-sh-stepval" aria-hidden="true">{val.toFixed(2)}</span>
        <button type="button" aria-label={`${label} növelése`} onClick={() => onChange(round2(Math.min(1, val + 0.05)))}>
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  )
}

interface CatalogExerciseSheetProps {
  onClose: () => void
  // When present the sheet edits this catalog row (seeds the fields, calls
  // updateCatalogExercise); otherwise it authors a new one.
  edit?: ExerciseLibraryItem
}

export function CatalogExerciseSheet({ onClose, edit }: CatalogExerciseSheetProps) {
  const { createCatalogExercise, updateCatalogExercise, deleteCatalogExercise } = useTrain()
  const [name, setName] = useState(edit?.name ?? '')
  const [muscle, setMuscle] = useState<MuscleKey>((edit?.muscle as MuscleKey) ?? DEFAULT_MUSCLE)
  const [type, setType] = useState<ExType>((edit?.type as ExType) ?? 'compound')
  const [stim, setStim] = useState(edit?.stim ?? 0.7)
  const [fatigue, setFatigue] = useState(edit?.fatigue ?? 0.3)
  const [videoUrl, setVideoUrl] = useState(edit?.videoUrl ?? '')
  const [saving, setSaving] = useState(false)
  // Two-tap delete confirm: first tap arms the button, second fires the mutation.
  const [confirmDelete, setConfirmDelete] = useState(false)

  const trimmed = name.trim()
  const isEdit = edit != null

  const submit = (close: () => void) => {
    if (!trimmed || saving) return
    const body = {
      name: trimmed,
      muscle,
      type,
      stim,
      fatigue,
      videoUrl: videoUrl.trim() || null,
      // Carry the row's existing demo stills through unchanged (mezo-qw37.5 fix-wave):
      // the backend writes these fields unconditionally on update, so omitting them
      // here would silently wipe them — including on rows the OWNER doesn't own.
      imageStartUrl: edit?.imageStartUrl ?? null,
      imageEndUrl: edit?.imageEndUrl ?? null,
    } satisfies CatalogExerciseCreateRequest
    setSaving(true)
    // Defer the animated close until the mutation lands (mock resolves synchronously). onError
    // re-enables the CTA so a real-mode failure (e.g. contract rejection) doesn't leave Mentés
    // permanently disabled.
    if (isEdit) updateCatalogExercise(edit.catalogId ?? edit.id, body, { onSuccess: close, onError: () => setSaving(false) })
    else createCatalogExercise(body, { onSuccess: close, onError: () => setSaving(false) })
  }

  return (
    <Sheet onClose={onClose} labelledBy="catalog-exercise-title" className="glass is-still gyx-sheet">
      {(close) => (
        <>
          {/* Header */}
          <div className="gyx-shh">
            <Icon3D name="t-muscle" size={48} />
            <div className="gyx-shh-copy">
              <span className="uv-eyebrow">Gyakorlat · Katalógus</span>
              <h3 id="catalog-exercise-title">{isEdit ? 'Gyakorlat szerkesztése' : 'Új gyakorlat'}</h3>
            </div>
            <button type="button" className="gyx-shh-x" onClick={close} aria-label="Bezárás">
              <Icon name="x" size={14} />
            </button>
          </div>

          {/* Name */}
          <div className="gyx-sh-field">
            <span className="uv-eyebrow">Név</span>
            <input
              aria-label="Név"
              className="gyx-sh-input"
              placeholder="pl. Cable Pull-Around"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Muscle picker (21 tokens, region-grouped) */}
          <div className="gyx-sh-field">
            <span className="uv-eyebrow">Izomcsoport</span>
            <div className="gyx-sh-groups" role="group" aria-label="Izomcsoport">
              {REGION_MUSCLES.map((g) => (
                <div key={g.region} className="gyx-sh-group">
                  <span className="gyx-sh-sub">{REGION_LABELS[g.region]}</span>
                  <div className="gyx-sh-chips">
                    {g.muscles.map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={muscle === m}
                        onClick={() => setMuscle(m as MuscleKey)}
                        className={cn('gyx-chip', muscle === m && 'is-on')}
                      >
                        {MUSCLE_LABELS[m] ?? m}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Type segmented */}
          <div className="gyx-sh-field">
            <span className="uv-eyebrow">Típus</span>
            <div className="gyx-sh-types" role="group" aria-label="Típus">
              {TYPES.map((t) => {
                const active = type === t
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setType(t)}
                    className={cn('gyx-chip gyx-sh-type', active && 'is-on')}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Stim + fatigue steppers */}
          <div className="gyx-sh-steps">
            <DecimalStep label="Stim" val={stim} onChange={setStim} />
            <DecimalStep label="Fáradtság" val={fatigue} onChange={setFatigue} />
          </div>

          {/* Video URL */}
          <div className="gyx-sh-field">
            <span className="uv-eyebrow">Videó URL</span>
            <input
              aria-label="Videó URL"
              className="gyx-sh-input"
              placeholder="https://youtu.be/…"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>

          {/* Delete — edit mode only; two-tap confirm, then the mutation closes the sheet */}
          {isEdit && (
            <button
              type="button"
              className={cn('gyx-sh-del', confirmDelete && 'is-armed')}
              aria-label="Gyakorlat törlése"
              onClick={() => {
                if (!confirmDelete) { setConfirmDelete(true); return }
                deleteCatalogExercise(edit.catalogId ?? edit.id, { onSuccess: close })
              }}
            >
              <Icon name="trash" size={13} />
              {confirmDelete ? 'Biztos? Koppints a törléshez' : 'Gyakorlat törlése'}
            </button>
          )}

          {/* Footer */}
          <div className="gyx-sh-two">
            <button type="button" className="gyx-sh-btn" onClick={close}>
              Mégse
            </button>
            <button
              type="button"
              className="gyx-sh-btn is-primary"
              disabled={!trimmed || saving}
              onClick={() => submit(close)}
            >
              <Icon3D name="t-tick" size={20} /> Mentés
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
