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
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js sheet `cat`): the light sheet with the
// kit head (t-muscle bubble), the kit text field, pills for the muscle (grouped by region) and
// the type, the kit − value + stepper for Stim / Fáradtság, the delete as a red text link, and
// the kit sheet foot (Mentés + Mégse).
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'
import { REGION_MUSCLES, REGION_LABELS } from '@/features/train/logic/muscleColors'
import type { CatalogExerciseCreateRequest } from '@/data/train/trainApi'
import type { ExerciseLibraryItem } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, FoSheetHead, Input, Lab, Lk, Pill, Pills, SheetActs, Stepper } from '@/shared/ui/folyadek'

// The 21 head/zone-specific catalog muscle tokens (mezo-wu1s), region-grouped for the
// picker below. This mirrors the contract's CatalogExerciseCreateRequest.muscle enum;
// the built request body is validated against that union by `satisfies`.
type MuscleKey = CatalogExerciseCreateRequest['muscle']
const DEFAULT_MUSCLE: MuscleKey = 'back-mid'

const TYPES = ['compound', 'isolation', 'plyo'] as const
type ExType = (typeof TYPES)[number]
/** The type as the owner reads it (the wire keeps the English token). */
const TYPE_LABEL: Record<ExType, string> = { compound: 'összetett', isolation: 'izolált', plyo: 'plyo' }

// Clamp + round to a 0.05 grid without float drift (0.7 + 0.05 → 0.75, not 0.7500001).
const round2 = (n: number) => Math.round(n * 100) / 100
const dec2 = (n: number) => n.toFixed(2).replace('.', ',')

// --- DecimalStep: label + the kit − value + stepper over a 0–1 / step-0.05 range ---
function DecimalStep({ label, val, onChange, first }: { label: string; val: number; onChange: (n: number) => void; first?: boolean }) {
  return (
    <div className={first ? 'er-sjl first' : 'er-sjl'}>
      <span>{label}</span>
      <Stepper
        name={label}
        value={dec2(val)}
        onDec={() => onChange(round2(Math.max(0, val - 0.05)))}
        onInc={() => onChange(round2(Math.min(1, val + 0.05)))}
      />
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
    <Sheet onClose={onClose} labelledBy="catalog-exercise-title" className="fo-sheet">
      {(close) => (
        <>
          <FoSheetHead
            icon="t-muscle"
            eyebrow="Gyakorlat · Katalógus"
            title={isEdit ? 'Gyakorlat szerkesztése' : 'Új gyakorlat'}
            titleId="catalog-exercise-title"
            onClose={close}
          />

          <Lab htmlFor="catalog-exercise-name">Név</Lab>
          <Input
            id="catalog-exercise-name"
            aria-label="Név"
            placeholder="pl. Cable Pull-Around"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* Muscle picker (21 tokens, region-grouped) */}
          <Lab>Izomcsoport</Lab>
          <div className="er-catm" role="group" aria-label="Izomcsoport">
            {REGION_MUSCLES.map((g) => (
              <div key={g.region}>
                <small>{REGION_LABELS[g.region]}</small>
                <Pills>
                  {g.muscles.map((m) => (
                    <Pill key={m} on={muscle === m} onClick={() => setMuscle(m as MuscleKey)}>
                      {MUSCLE_LABELS[m] ?? m}
                    </Pill>
                  ))}
                </Pills>
              </div>
            ))}
          </div>

          <Lab>Típus</Lab>
          <Pills role="group" aria-label="Típus">
            {TYPES.map((t) => (
              <Pill key={t} on={type === t} onClick={() => setType(t)}>{TYPE_LABEL[t]}</Pill>
            ))}
          </Pills>

          <DecimalStep first label="Stim" val={stim} onChange={setStim} />
          <DecimalStep label="Fáradtság" val={fatigue} onChange={setFatigue} />

          <Lab htmlFor="catalog-exercise-video">Videó URL</Lab>
          <Input
            id="catalog-exercise-video"
            aria-label="Videó URL"
            placeholder="https://youtu.be/…"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />

          {/* Delete — edit mode only; two-tap confirm, then the mutation closes the sheet */}
          {isEdit && (
            <Acts>
              <Lk
                className="er-bad"
                aria-label="Gyakorlat törlése"
                onClick={() => {
                  if (!confirmDelete) { setConfirmDelete(true); return }
                  deleteCatalogExercise(edit.catalogId ?? edit.id, { onSuccess: close })
                }}
              >
                {confirmDelete ? 'Biztos? Koppints a törléshez' : 'Gyakorlat törlése'}
              </Lk>
            </Acts>
          )}

          <SheetActs label="Mentés" disabled={!trimmed || saving} onSave={() => submit(close)} onCancel={close} />
        </>
      )}
    </Sheet>
  )
}
