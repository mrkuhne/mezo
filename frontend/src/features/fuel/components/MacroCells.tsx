// ============================================================
// Mezo · MacroCells (shared chamfer kcal/P/C/F strip)
// The `.mc` cell look from docs/design/recipes-*.html — used by the editorial
// RecipeCard body, the RecipeDetailPage ingredient rows, the editor pick-rows,
// and the IngredientPickerSheet cards. An optional left `perLabel` rail prints
// the basis (e.g. "160 g" for an editor row at its amount, "/100g" in the picker).
// ============================================================
export interface MacroCellsProps {
  macros: { kcal: number; p: number; c: number; f: number }
  perLabel?: string
  size?: 'sm' | 'md'
}

const CELLS = [
  { key: 'kcal' as const, label: 'kcal', color: 'var(--coral)' },
  { key: 'p' as const, label: 'Prot', color: 'var(--success)' },
  { key: 'c' as const, label: 'Carb', color: 'var(--text-primary)' },
  { key: 'f' as const, label: 'Fat', color: 'var(--text-primary)' },
]

export function MacroCells({ macros, perLabel, size = 'sm' }: MacroCellsProps) {
  const valFs = size === 'md' ? 15 : 13
  return (
    <div className="row" style={{ gap: 6, alignItems: 'stretch' }}>
      {perLabel && (
        <span
          className="label-mono"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7.5, letterSpacing: '0.06em', color: 'var(--text-quaternary)',
            writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '0 1px', flexShrink: 0,
          }}
        >
          {perLabel}
        </span>
      )}
      {CELLS.map(c => (
        <div
          key={c.key}
          className="rad-12"
          style={{ flex: 1, textAlign: 'center', padding: '6px 2px', background: 'var(--surface-glass)' }}
        >
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: valFs, fontWeight: 600, color: c.color }}>
            {macros[c.key]}
          </div>
          <div className="label-mono" style={{ fontSize: 7, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {c.label}
          </div>
        </div>
      ))}
    </div>
  )
}
