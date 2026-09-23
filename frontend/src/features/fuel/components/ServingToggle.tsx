// ============================================================
// Mezo · ServingToggle (/adag ↔ egész)
// The segmented basis switch from docs/design/recipes-detail.html (.segtoggle).
// Used by RecipeDetailPage's macro hero, RecipeEditorPage's live total card and the Műhely hero.
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
  // Üveg U2 (mezo-me75u.2, prototype `.seg`): a flat recessed pill; the active basis fills sage
  // and glows. Styled in prototype.css `── uveg fuel receptek (`.
  return (
    <div className="fkx-seg" role="group" aria-label="Makró-bázis">
      {SEGS.map(s => {
        const active = value === s.id
        return (
          <button key={s.id} type="button" className={active ? 'is-on' : undefined}
            aria-pressed={active} onClick={() => onChange(s.id)}>
            {s.label(servings)}
          </button>
        )
      })}
    </div>
  )
}
