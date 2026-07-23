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
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'
import type { CatalogExerciseCreateRequest } from '@/data/train/trainApi'
import type { ExerciseLibraryItem } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Display } from '@/shared/ui/Display'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
import { cn } from '@/shared/lib/cn'

// The 13 catalog muscle tokens, in the contract's union order. `as const` keeps
// the literal types so the built request satisfies the strict API muscle union.
const MUSCLE_KEYS = [
  'back-mid', 'lats', 'chest', 'shoulder', 'rear-delt', 'biceps', 'triceps',
  'quad', 'ham', 'glute', 'calf', 'core', 'traps',
] as const
type MuscleKey = (typeof MUSCLE_KEYS)[number]

const TYPES = ['compound', 'isolation', 'plyo'] as const
type ExType = (typeof TYPES)[number]

// Clamp + round to a 0.05 grid without float drift (0.7 + 0.05 → 0.75, not 0.7500001).
const round2 = (n: number) => Math.round(n * 100) / 100

// --- DecimalStep: label + display + 44px ± buttons over a 0–1 / step-0.05 range ---
function DecimalStep({ label, val, onChange }: { label: string; val: number; onChange: (n: number) => void }) {
  return (
    <div className="col gap-sm">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label-mono">{label}</span>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
          {val.toFixed(2)}
        </span>
      </div>
      <div className="stepper rad-12">
        <button type="button" aria-label={`${label} csökkentése`} onClick={() => onChange(round2(Math.max(0, val - 0.05)))}>
          <Icon name="minus" size={14} />
        </button>
        <span className="stepper-display" aria-hidden="true">{val.toFixed(2)}</span>
        <button type="button" aria-label={`${label} növelése`} onClick={() => onChange(round2(Math.min(1, val + 0.05)))}>
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  )
}

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  background: 'var(--surface-1)',
  border: '1px solid var(--border-subtle)',
} as const

interface CatalogExerciseSheetProps {
  onClose: () => void
  // When present the sheet edits this catalog row (seeds the fields, calls
  // updateCatalogExercise); otherwise it authors a new one.
  edit?: ExerciseLibraryItem
}

export function CatalogExerciseSheet({ onClose, edit }: CatalogExerciseSheetProps) {
  const { createCatalogExercise, updateCatalogExercise, deleteCatalogExercise } = useTrain()
  const [name, setName] = useState(edit?.name ?? '')
  const [muscle, setMuscle] = useState<MuscleKey>((edit?.muscle as MuscleKey) ?? 'back-mid')
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
    } satisfies CatalogExerciseCreateRequest
    setSaving(true)
    // Defer the animated close until the mutation lands (mock resolves synchronously). onError
    // re-enables the CTA so a real-mode failure (e.g. contract rejection) doesn't leave Mentés
    // permanently disabled.
    if (isEdit) updateCatalogExercise(edit.catalogId ?? edit.id, body, { onSuccess: close, onError: () => setSaving(false) })
    else createCatalogExercise(body, { onSuccess: close, onError: () => setSaving(false) })
  }

  return (
    <Sheet onClose={onClose} labelledBy="catalog-exercise-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow brand">Gyakorlat · Katalógus</span>
              <div id="catalog-exercise-title" style={{ marginTop: 4 }}>
                <Display size="md">{isEdit ? 'Gyakorlat szerkesztése' : 'Új gyakorlat'}</Display>
              </div>
            </div>
            <button className="chip" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Name */}
          <div className="col gap-sm" style={{ marginBottom: 14 }}>
            <span className="label-mono">Név</span>
            <input
              aria-label="Név"
              className="rad-12"
              placeholder="pl. Cable Pull-Around"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={fieldStyle}
            />
          </div>

          {/* Muscle segmented picker (13 tokens, wraps) */}
          <div className="col gap-sm" style={{ marginBottom: 14 }}>
            <span className="label-mono">Izomcsoport</span>
            <div className="row gap-xs" style={{ flexWrap: 'wrap' }} role="group" aria-label="Izomcsoport">
              {MUSCLE_KEYS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={muscle === m}
                  onClick={() => setMuscle(m)}
                  className={cn('chip', muscle === m && 'brand')}
                  style={{ fontSize: 10, padding: '6px 10px' }}
                >
                  {MUSCLE_LABELS[m] ?? m}
                </button>
              ))}
            </div>
          </div>

          {/* Type segmented */}
          <div className="col gap-sm" style={{ marginBottom: 14 }}>
            <span className="label-mono">Típus</span>
            <div className="row gap-xs" role="group" aria-label="Típus">
              {TYPES.map((t) => {
                const active = type === t
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setType(t)}
                    className="flex-1 rad-12"
                    style={{
                      padding: '10px',
                      background: active ? 'color-mix(in srgb, var(--coral) 8%, transparent)' : 'var(--surface-1)',
                      border: `1px solid ${active ? 'color-mix(in srgb, var(--coral) 40%, transparent)' : 'var(--border-subtle)'}`,
                      color: active ? 'var(--coral)' : 'var(--text-secondary)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Stim + fatigue steppers */}
          <div className="col gap-md" style={{ marginBottom: 14 }}>
            <DecimalStep label="Stim" val={stim} onChange={setStim} />
            <DecimalStep label="Fáradtság" val={fatigue} onChange={setFatigue} />
          </div>

          {/* Video URL */}
          <div className="col gap-sm" style={{ marginBottom: 4 }}>
            <span className="label-mono">Videó URL</span>
            <input
              aria-label="Videó URL"
              className="rad-12"
              placeholder="https://youtu.be/…"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              style={fieldStyle}
            />
          </div>

          {/* Delete — edit mode only; two-tap confirm, then the mutation closes the sheet */}
          {isEdit && (
            <button
              type="button"
              className="chip"
              aria-label="Gyakorlat törlése"
              onClick={() => {
                if (!confirmDelete) { setConfirmDelete(true); return }
                deleteCatalogExercise(edit.catalogId ?? edit.id, { onSuccess: close })
              }}
              style={{
                alignSelf: 'center', marginTop: 14, background: 'transparent',
                borderColor: 'transparent', color: 'var(--warning)',
              }}
            >
              <Icon name="trash" size={12} color="var(--warning)" />
              {confirmDelete ? 'Biztos? Koppints a törléshez' : 'Gyakorlat törlése'}
            </button>
          )}

          {/* Footer */}
          <div className="row gap-sm mt-lg">
            <CtaGhost className="flex-1" onClick={close}>
              Mégse
            </CtaGhost>
            <CtaPrimary className="flex-1" disabled={!trimmed || saving} onClick={() => submit(close)}>
              <Icon name="check" size={14} /> Mentés
            </CtaPrimary>
          </div>
          <div style={{ height: 8 }} />
        </>
      )}
    </Sheet>
  )
}
