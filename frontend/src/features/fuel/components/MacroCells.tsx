// ============================================================
// Mezo · MacroCells (kcal + a három makró egy sorban)
// Folyadék (mezo-n4wf5.5): négy csendes cella — a kcal semleges, a három makró a saját folyadékszínében
// (prototípus fuel.js `.fu-lnm`). A recept-szerkesztő sorai és a hozzávaló-választó kártyái használják;
// az opcionális `perLabel` a bázist írja ki (pl. „160 g", „/100g").
// ============================================================
import type { CSSProperties } from 'react'
import { useM } from '@/shared/i18n'
import { fmtNum } from '@/shared/lib/format'
import { MACRO_COLOR } from '@/features/fuel/components/folyadek'

export interface MacroCellsProps {
  /** Nullable since mezo-6omv: a null cell prints an em dash, a 0 prints "0". */
  macros: { kcal: number | null; p: number | null; c: number | null; f: number | null }
  perLabel?: string
  size?: 'sm' | 'md'
}

const CELLS = [
  { key: 'p' as const, word: 'protein' as const },
  { key: 'c' as const, word: 'carbs' as const },
  { key: 'f' as const, word: 'fat' as const },
]

export function MacroCells({ macros, perLabel, size = 'sm' }: MacroCellsProps) {
  const M = useM()
  const val = (v: number | null) => (v == null ? '—' : fmtNum(v))
  return (
    <span className={size === 'md' ? 'fg-mc md' : 'fg-mc'}>
      {perLabel && <small className="fg-per">{perLabel}</small>}
      <span><b>{val(macros.kcal)}</b><small>kcal</small></span>
      {CELLS.map(c => (
        <span key={c.key} style={{ '--c': MACRO_COLOR[c.word] } as CSSProperties}>
          <b>{val(macros[c.key])}</b><small>{M.fuelKozos.macroShort[c.word]}</small>
        </span>
      ))}
    </span>
  )
}
