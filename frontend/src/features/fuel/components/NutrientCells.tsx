// ============================================================
// Mezo · NutrientCells (tápérték-strip: telített / cukor / rost / só)
// A MacroCells halványabb testvére, ugyanazzal a chamfer-cella nyelvvel — a recept-hero,
// a hozzávaló-sorok, a LogMealSheet és az ImportItemSheet preview-ja használja (mezo-m6uv).
// A `null` itt információ: `—`-ként jelenik meg, mert a forrás nem hordozott értéket (nem 0 g).
// ============================================================
import type { Nutrients } from '@/data/types'
import { formatGram } from '@/shared/lib/grams'

export interface NutrientCellsProps {
  nutrients: Nutrients
  perLabel?: string
  size?: 'sm' | 'md'
  /** 'hide' (default): mind-null esetén nem renderel · 'dashes': kirajzolja a négy `—`-t. */
  empty?: 'hide' | 'dashes'
}

const CELLS = [
  { key: 'saturatedFatG' as const, label: 'Telített' },
  { key: 'sugarG' as const, label: 'Cukor' },
  { key: 'fiberG' as const, label: 'Rost' },
  { key: 'saltG' as const, label: 'Só' },
]

export function NutrientCells({ nutrients, perLabel, size = 'sm', empty = 'hide' }: NutrientCellsProps) {
  const allMissing = CELLS.every(c => nutrients[c.key] == null)
  if (allMissing && empty === 'hide') return null
  const valFs = size === 'md' ? 13 : 11.5
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
          style={{ flex: 1, textAlign: 'center', padding: '5px 2px', background: 'var(--surface-glass)' }}
        >
          <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: valFs, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {formatGram(nutrients[c.key])}
          </div>
          <div className="label-mono" style={{ fontSize: 7, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {c.label}
          </div>
        </div>
      ))}
    </div>
  )
}
