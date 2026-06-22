// ============================================================
// Mezo · AddPantryItemSheet
// Manual add/edit form for a Kamra item. Real CRUD via usePantryActions:
//   - add mode (no editId): addItem(input) → appends to the ['pantry'] cache
//   - edit mode (editId set): updateItem(editId, input)
// Reuses the shared <Sheet> shell (portal + drag-to-close + Escape) so styling
// and aria match ImportItemSheet / NewRecipeSheet. Kind toggle switches the
// macro/dose field; name + (kcal | dose) are the minimal fields.
// ============================================================
import { useState } from 'react'
import { usePantryActions } from '@/data/hooks'
import type { PantryItemInput, PantryItemKind } from '@/data/types'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'

const kinds: { id: PantryItemKind; label: string }[] = [
  { id: 'food', label: 'Étel' },
  { id: 'supplement', label: 'Supplement' },
  { id: 'stim', label: 'Stimuláns' },
  { id: 'med', label: 'Gyógyszer' },
]

const fieldCardStyle = { padding: '10px 12px', marginBottom: 10 } as const
const fieldLabelStyle = { fontSize: 9, color: 'var(--text-tertiary)' } as const
const fieldInputStyle = { fontSize: 14, color: 'var(--text-primary)', marginTop: 4, width: '100%' } as const

export function AddPantryItemSheet({
  open,
  onClose,
  editId,
  initial,
}: {
  open: boolean
  onClose: () => void
  editId?: string
  initial?: Partial<PantryItemInput>
}) {
  const { addItem, updateItem } = usePantryActions()
  const [kind, setKind] = useState<PantryItemKind>(initial?.kind ?? 'food')
  const [name, setName] = useState(initial?.name ?? '')
  const [kcal, setKcal] = useState(initial?.kcal?.toString() ?? '')
  const [dose, setDose] = useState(initial?.dose ?? '')

  function submit() {
    const input: PantryItemInput =
      kind === 'food'
        ? {
            kind,
            name,
            unit: initial?.unit ?? 'g',
            kcal: Number(kcal) || 0,
            proteinG: initial?.proteinG,
            carbsG: initial?.carbsG,
            fatG: initial?.fatG,
            source: 'manual',
          }
        : { kind, name, dose, source: 'manual' }
    if (editId) updateItem(editId, input)
    else addItem(input)
    onClose()
  }

  if (!open) return null

  return (
    <Sheet onClose={onClose} labelledBy="add-pantry-item-title">
      {(close) => (
        <>
          {/* Header */}
          <div
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}
          >
            <div className="col">
              <Eyebrow brand>{editId ? 'Tétel · szerkesztés' : 'Új tétel · kézi'}</Eyebrow>
              <div id="add-pantry-item-title" style={{ marginTop: 4 }}>
                <Display size="md">{editId ? 'Tétel szerkesztése' : 'Új kamra-tétel'}</Display>
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Kind toggle */}
          <div className="card notch-4" style={{ padding: '10px 12px', marginBottom: 10 }}>
            <label className="label-mono" style={fieldLabelStyle}>
              Típus
              <select
                value={kind}
                onChange={e => setKind(e.target.value as PantryItemKind)}
                style={{ ...fieldInputStyle, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', padding: '6px 8px' }}
              >
                {kinds.map(k => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Name */}
          <div className="card notch-4" style={fieldCardStyle}>
            <label className="label-mono" style={fieldLabelStyle}>
              Név
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="pl. Görög joghurt 10%"
                style={fieldInputStyle}
              />
            </label>
          </div>

          {/* kcal | dose (kind-dependent) */}
          <div className="card notch-4" style={{ ...fieldCardStyle, marginBottom: 14 }}>
            {kind === 'food' ? (
              <label className="label-mono" style={fieldLabelStyle}>
                kcal / {initial?.unit ?? 'g'}
                <input
                  inputMode="numeric"
                  value={kcal}
                  onChange={e => setKcal(e.target.value)}
                  placeholder="pl. 119"
                  style={fieldInputStyle}
                />
              </label>
            ) : (
              <label className="label-mono" style={fieldLabelStyle}>
                Dózis
                <input
                  value={dose}
                  onChange={e => setDose(e.target.value)}
                  placeholder="pl. 5 g"
                  style={fieldInputStyle}
                />
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="row gap-sm">
            <button className="cta-ghost notch-4 flex-1" onClick={close}>
              Mégse
            </button>
            <button className="cta-primary notch-4 flex-1" disabled={!name.trim()} onClick={submit}>
              <Icon name="check" size={14} /> {editId ? 'Mentés' : 'Polcra'}
            </button>
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
