// ============================================================
// Mezo · dimensionFace (mezo-jcpt.1) — the ONE place a score dimension's Mozaik 2.0
// face is declared: which wash the tile wears and which clay icon sits on it.
// Taken from the approved „Napi értékelés" prototype, 3. képernyő: makró → sage,
// NOVA → gold (the prototype calls the wash „amber"; the shared token family names it
// `--mz-wash-gold`), időzítés → sky, rost/mikro → rose, and the compact secondary
// dimensions ride white tiles so the four rich ones keep the colour budget.
// A DEGRADED dimension (weight 0) overrides all of this with the ghost tone —
// see DimensionCard.
// ============================================================
import type { ClayIconName } from '@/shared/ui/clay'
import type { MealDimension } from '@/data/types'

/** Tone class suffix → `.sb-t-<tone>` in prototype.css (wash + colored shadow token pair). */
export type DimTone = 'sage' | 'gold' | 'sky' | 'rose' | 'lav' | 'coral' | 'white' | 'ghost'

export interface DimFace { tone: DimTone; icon: ClayIconName }

// Icon names are the clay kit's REAL symbols (`frontend/src/shared/ui/clay/index.tsx`),
// which all carry the `i-` prefix — the brief's map was written without it.
const FACE: Record<MealDimension['id'], DimFace> = {
  macro: { tone: 'sage', icon: 'i-fuel' },
  nova: { tone: 'gold', icon: 'i-termes' },
  context: { tone: 'sky', icon: 'i-idozito' },
  micro: { tone: 'rose', icon: 'i-eletjel' },
  who: { tone: 'white', icon: 'i-rend' },
  fat_quality: { tone: 'white', icon: 'i-lombik' },
  plant_diversity: { tone: 'white', icon: 'i-kamra' },
  energy_density: { tone: 'white', icon: 'i-erme' },
  // Not in the brief's map (it lists 8); `portion` is the 9th id the contract allows and the
  // one the mock fixture degrades. `i-suly` (a scale) is the nearest real clay symbol.
  portion: { tone: 'white', icon: 'i-suly' },
}

export function dimensionFace(dim: MealDimension): DimFace {
  const face = FACE[dim.id] ?? { tone: 'white' as const, icon: 'i-eletjel' as const }
  // Weight 0 = no input coverage: the tile must LOOK weightless, whatever its id.
  return dim.weight > 0 ? face : { tone: 'ghost', icon: face.icon }
}
