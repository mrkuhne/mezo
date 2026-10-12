// ============================================================
// Mezo · NutrientCells (a négy tárolt tény: rost · cukor · só · telített zsír)
// Folyadék (mezo-n4wf5.5, prototípus fuel.js `nutri`): négy csendes cella egy sorban. A `null` itt
// információ: `—`-ként jelenik meg, mert a forrás nem hordozott értéket (nem 0 g); a kijelzési lépésnél
// kisebb pozitív érték `<0,1`, mert a „0" azt mondaná: nincs benne.
// A recept-hero, a hozzávaló-sorok, a naplózó és az ImportItemSheet előnézete használja (mezo-m6uv).
// ============================================================
import type { Nutrients } from '@/data/types'
import { useM } from '@/shared/i18n'
import { fmtNum } from '@/shared/lib/format'

export interface NutrientCellsProps {
  nutrients: Nutrients
  perLabel?: string
  size?: 'sm' | 'md'
  /** 'hide' (default): mind-null esetén nem renderel · 'dashes': kirajzolja a négy `—`-t. */
  empty?: 'hide' | 'dashes'
}

/** One decimal at most, in the app language; a positive value under the display step prints `<0,1` (never `0`: that would
 *  read as "none" — the rule of `shared/lib/grams.formatGram`, here through `format.ts` so English gets its point). */
function gram(v: number): string {
  const rounded = Math.round(v * 10 + Number.EPSILON) / 10
  return rounded === 0 && v > 0 ? `<${fmtNum(0.1, 1)}` : fmtNum(rounded, 1)
}

const CELLS = [
  { key: 'fiberG' as const, word: 'fiber' as const },
  { key: 'sugarG' as const, word: 'sugar' as const },
  { key: 'saltG' as const, word: 'salt' as const },
  { key: 'saturatedFatG' as const, word: 'satFat' as const },
]

export function NutrientCells({ nutrients, perLabel, size = 'sm', empty = 'hide' }: NutrientCellsProps) {
  const M = useM()
  const allMissing = CELLS.every(c => nutrients[c.key] == null)
  if (allMissing && empty === 'hide') return null
  return (
    <span className={size === 'md' ? 'fg-nut md' : 'fg-nut'}>
      {perLabel && <small className="fg-per">{perLabel}</small>}
      {CELLS.map(c => {
        const v = nutrients[c.key]
        return <span key={c.key}><b>{v == null ? '—' : `${gram(v)} g`}</b><small>{M.fuelKozos.facts[c.word]}</small></span>
      })}
    </span>
  )
}
