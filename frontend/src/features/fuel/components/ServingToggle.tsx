// ============================================================
// Mezo · ServingToggle (/adag ↔ egész)
// The segmented basis switch from docs/design/recipes-detail.html (.segtoggle).
// Used by RecipeDetailPage's macro hero and RecipeEditorPage's live total card.
// `servings` is the real recipe value; the "whole" label echoes it.
// ============================================================
export type ServingBasis = 'serving' | 'whole'

export interface ServingToggleProps {
  value: ServingBasis
  servings: number
  onChange: (b: ServingBasis) => void
}

const SEGS: { id: ServingBasis; label: (n: number) => string }[] = [
  { id: 'serving', label: () => '1 adag' },
  { id: 'whole', label: n => `Egész · ${n} adag` },
]

export function ServingToggle({ value, servings, onChange }: ServingToggleProps) {
  return (
    <div className="row" style={{ gap: 5, padding: 4, background: 'var(--surface-2)', borderRadius: 10 }}>
      {SEGS.map(s => {
        const active = value === s.id
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className="rad-12 flex-1"
            style={{
              padding: '7px 0', textAlign: 'center',
              fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.06em',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              background: active ? 'var(--coral)' : 'transparent',
            }}
          >
            {s.label(servings)}
          </button>
        )
      })}
    </div>
  )
}
