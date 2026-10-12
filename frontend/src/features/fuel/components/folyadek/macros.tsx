// Fuel · Folyadék macro pieces (mezo-n4wf5.5). Prototype: fuel.js `mk`, `macroVials` / `macroV`, `mealCells`, `m3`, `nutri`.
// One colour per macro everywhere (`MACRO_COLOR`); words from the `fuelKozos` catalog; numbers through format.ts.
import { useM } from '@/shared/i18n'
import { fmtGrouped, fmtNum } from '@/shared/lib/format'
import { Level, Mini, Vials, type VialItem } from '@/shared/ui/folyadek'

/** The stable category colours of the Fuel domain (tokens in folyadek-fuel-kozos.css). */
export const MACRO_COLOR = {
  protein: 'var(--fx-protein)', carbs: 'var(--fx-carb)', fat: 'var(--fx-fat)', fiber: 'var(--fx-fiber)', water: 'var(--fx-water)', lilac: 'var(--fx-lilac)',
} as const

/** The energy share of the three macros in % (4 / 4 / 9 kcal per gram; prototype `mk`). All zero → 0 / 0 / 0. */
export function energyShares(p: number, c: number, f: number): { p: number; c: number; f: number } {
  const t = p * 4 + c * 4 + f * 9
  if (!(t > 0)) return { p: 0, c: 0, f: 0 }
  return { p: Math.round((p * 4 / t) * 100), c: Math.round((c * 4 / t) * 100), f: Math.round((f * 9 / t) * 100) }
}

/** The three macros in vials (`macroVials`): the number is the gram, the level is the share of the energy. A `null` gram is
 *  an honest „—" with „nincs adat" (then no vial shows a share — prototype `macroV`). `onPick` makes each vial a button. */
export function MacroVials({ p, c, f, height = 104, onPick }: {
  p: number | null; c: number | null; f: number | null; height?: number; onPick?: (key: 'protein' | 'carbs' | 'fat') => void
}) {
  const M = useM()
  const K = M.fuelKozos
  const known = p != null && c != null && f != null
  const sh = known ? energyShares(p, c, f) : null
  const rows: Array<['protein' | 'carbs' | 'fat', VialItem['icon'], number | null, number]> = [
    ['protein', 't-meat', p, sh?.p ?? 0], ['carbs', 't-carb', c, sh?.c ?? 0], ['fat', 't-avocado', f, sh?.f ?? 0],
  ]
  const items: VialItem[] = rows.map(([key, icon, g, share]) => ({
    label: K.macro[key], icon, color: MACRO_COLOR[key],
    pct: g == null ? 0 : sh ? Math.max(6, share) : Math.max(6, Math.min(100, g)),
    value: g == null ? '—' : `${fmtNum(g)} g`,
    note: g == null ? K.noData : sh ? K.vials.share(share) : undefined,
    ...(onPick && g != null ? { onClick: () => onPick(key), ariaLabel: sh ? K.vials.aria(K.macro[key], fmtNum(g), share) : `${K.macro[key]}: ${fmtNum(g)} g` } : {}),
  }))
  return <Vials className="fx-mv" items={items} height={height} />
}

/** A meal's four small capsules (`mealCells`): protein / carbs / fat levels are the shares of the meal's OWN energy, fibre is
 *  the share of the day's fibre amount; the number is the gram. `fiber: null` = no data („—"). A MISSING macro gram is an
 *  honest „—", and then NO capsule shows a share: a truncated composition has no energy split. */
export function MealCells({ protein, carbs, fat, fiber, fiberTarget }: {
  protein: number | null; carbs: number | null; fat: number | null; fiber: number | null; fiberTarget: number
}) {
  const M = useM()
  const K = M.fuelKozos
  if (protein == null || carbs == null || fat == null) {
    const cells: Array<['protein' | 'carbs' | 'fat' | 'fiber', number | null]> = [['protein', protein], ['carbs', carbs], ['fat', fat], ['fiber', fiber]]
    const partial = cells.map(([key, g]) => (g == null ? K.cells.none(K.macroLower[key]) : K.cells.known(K.macroLower[key], fmtNum(g)))).join('; ')
    return (
      <span className="fx-cells" role="img" aria-label={partial}>
        {cells.map(([key, g]) => <Mini key={key} pct={0} color={MACRO_COLOR[key]} value={g == null ? '—' : `${fmtNum(g)} g`} label={K.macroShort[key]} />)}
      </span>
    )
  }
  const sh = energyShares(protein, carbs, fat)
  const fp = fiber == null || !(fiberTarget > 0) ? null : Math.min(100, Math.round((fiber / fiberTarget) * 100))
  const label = K.cells.aria(fmtNum(protein), sh.p, fmtNum(carbs), sh.c, fmtNum(fat), sh.f,
    fiber == null || fp == null ? K.noData : K.cells.fiber(fmtNum(fiber), fp))
  const cell = (key: 'protein' | 'carbs' | 'fat' | 'fiber', g: number | null, pct: number | null) => (
    <Mini key={key} pct={g == null || pct == null ? 0 : Math.max(6, pct)} color={MACRO_COLOR[key]} value={g == null ? '—' : `${fmtNum(g)} g`} label={K.macroShort[key]} />
  )
  return (
    <span className="fx-cells" role="img" aria-label={label}>
      {cell('protein', protein, sh.p)}{cell('carbs', carbs, sh.c)}{cell('fat', fat, sh.f)}{cell('fiber', fiber, fp)}
    </span>
  )
}

/** Three thin macro levels with their grams (`m3`): a recipe / pantry row's fingerprint. Levels are relative to the largest of
 *  the three; `null` = „—". */
export function M3({ p, c, f }: { p: number | null; c: number | null; f: number | null }) {
  const M = useM()
  const K = M.fuelKozos.macroShort
  const max = Math.max(p ?? 0, c ?? 0, f ?? 0) || 1
  const one = (key: 'protein' | 'carbs' | 'fat', g: number | null) => (
    <span key={key}>
      <Level pct={g == null ? 0 : (g / max) * 100} color={MACRO_COLOR[key]} height={8} />
      <small><b>{g == null ? '—' : fmtNum(g)}</b>{g == null ? '' : ' g'} {K[key]}</small>
    </span>
  )
  return <span className="fx-m3">{one('protein', p)}{one('carbs', c)}{one('fat', f)}</span>
}

/** The four stored facts in a row of quiet cells (`nutri`): fibre · sugar · salt · saturated fat, in grams; `null` = „—". */
export function Nutri({ fiber, sugar, salt, satFat }: { fiber: number | null; sugar: number | null; salt: number | null; satFat: number | null }) {
  const M = useM()
  const K = M.fuelKozos.facts
  const cells: Array<[string, number | null]> = [[K.fiber, fiber], [K.sugar, sugar], [K.salt, salt], [K.satFat, satFat]]
  return (
    <span className="fx-nut">
      {cells.map(([l, v]) => <span key={l}><b>{v == null ? '—' : `${fmtNum(v)} g`}</b><small>{l}</small></span>)}
    </span>
  )
}

/** A line's three macros in tinted cells (`.fu-lnm`): grams, `null` = „—". With `kcal` (a number, or `null` for „—") a
 *  fourth cell leads the row in the domain's tint: an imported item's draft, one eaten serving of a recipe. */
export function MacroTriple({ p, c, f, kcal, className }: { p: number | null; c: number | null; f: number | null; kcal?: number | null; className?: string }) {
  const M = useM()
  const K = M.fuelKozos.macroShort
  const cells: Array<['protein' | 'carbs' | 'fat', number | null]> = [['protein', p], ['carbs', c], ['fat', f]]
  return (
    <span className={className ? `fx-lnm ${className}` : 'fx-lnm'}>
      {kcal !== undefined && <span style={{ ['--c' as string]: 'var(--dom)' }}><b>{kcal == null ? '—' : fmtGrouped(kcal)}</b><small>kcal</small></span>}
      {cells.map(([key, g]) => <span key={key} style={{ ['--c' as string]: MACRO_COLOR[key] }}><b>{g == null ? '—' : `${fmtNum(g)} g`}</b><small>{K[key]}</small></span>)}
    </span>
  )
}
