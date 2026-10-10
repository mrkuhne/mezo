import { useEffect, useRef, useState } from 'react'
import type { MacroSet } from '@/data/types'
import { remainingAfterSkips } from '@/features/fuel/logic/keretHero'
import type { FuelMode } from '@/features/fuel/logic/fuelMode'
import type { Icon3DName } from '@/shared/ui/clay'
import { Acts, Btn, ErrorRow, Note, Vials, Why } from '@/shared/ui/folyadek'

interface NapFuelGraphicProps {
  consumed: MacroSet
  targets: MacroSet
  isPending?: boolean
  isError?: boolean
  onRetry?: () => void
  /** Kímélő mód (Kihagyás S3): a GUIDANCE day has no kalóriacél — one calm line replaces the
   *  macro instrument. */
  guidance?: boolean
  /** The Fuel day's skipped-window kcal and mode — the same rule as the Fuel hero (`remainingAfterSkips`). */
  skippedKcal?: number
  fuelMode?: FuelMode | null
  /** „Fuel megnyitása" under the instrument (the sheet passes it). */
  onOpenFuel?: () => void
}

// A makró ARCA EGY helyen dől el az egész appban (owner 2026-09-18): ugyanaz a szín és ugyanaz a jel,
// amit a Fuel oldal visel — fehérje hús, szénhidrát gabona, zsír avokádó, a `--macro-*` sávon.
// A szín itt jelentés, nem bőr: egy makró egy szín, mindenhol.
const macros = [
  { key: 'p', label: 'Fehérje', goalName: 'fehérjecél', color: 'var(--macro-protein)', icon: 't-meat' },
  { key: 'c', label: 'Szénhidrát', goalName: 'szénhidrátcél', color: 'var(--macro-carbs)', icon: 't-carb' },
  { key: 'f', label: 'Zsír', goalName: 'zsírcél', color: 'var(--macro-fat)', icon: 't-avocado' },
] as const satisfies readonly { key: string; label: string; goalName: string; color: string; icon: Icon3DName }[]
const format = (value: number) => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1, useGrouping: true }).format(value).replace(/ /g, ' ')
const amount = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0
const hasGoal = (value: number) => Number.isFinite(value) && value > 0

/** „A napod üzemanyaga" lap törzse (Folyadék prototípus `SHEETS.uzemanyag`): a nagy szám a mai kalória a
 *  kerethez, alatta a három makró három kémcső; egy koppintás kiválaszt egyet, a nagy szám visszavisz az
 *  összképhez. Presentational: no estimated macros, mock fallback, or data fetching. */
export function NapFuelGraphic({ consumed, targets, isPending, isError, onRetry, guidance, skippedKcal = 0, fuelMode = null, onOpenFuel }: NapFuelGraphicProps) {
  const [active, setActive] = useState<'p' | 'c' | 'f' | null>(null)
  const vialsRef = useRef<HTMLDivElement>(null)
  const selected = macros.find(macro => macro.key === active)
  const kcal = amount(consumed.kcal)
  const energyGoal = hasGoal(targets.kcal)
  const energyRemaining = remainingAfterSkips(targets.kcal, kcal, skippedKcal)
  // ESTIMATE (travel): the keret is only a reference, so it is never "felett".
  const remainingWord = energyRemaining < 0 ? (fuelMode === 'ESTIMATE' ? ' körül' : ' felett') : 'ig'
  const empty = kcal === 0 && macros.every(macro => amount(consumed[macro.key]) === 0)
  const remaining = energyGoal ? `${format(Math.abs(energyRemaining))} kcal a napi keret${remainingWord}.` : 'A napi energiakeret még nincs beállítva.'
  let detail = empty
    ? 'Még nincs rögzített energiabevitel. Az étkezéseid itt töltik fel a szinteket.'
    : `${remaining} A három szint a saját napi célodhoz viszonyít; érints meg egy makrót a részletekhez.`
  if (selected) {
    const value = amount(consumed[selected.key])
    const goal = targets[selected.key]
    detail = hasGoal(goal)
      ? `${format(Math.abs(goal - value))} g a ${format(goal)} g-os ${value > goal ? 'cél felett' : 'célig'}.`
      : `Nincs beállított ${selected.goalName}. Ma ${format(value)} g-ot rögzítettél.`
  }
  const instrument = !isError && !isPending && !guidance
  // The kit's vial is a plain button: the selected state is announced here (aria-pressed), next to the „✓" mark.
  useEffect(() => {
    vialsRef.current?.querySelectorAll('button.fo-vial').forEach((button, i) => {
      button.setAttribute('aria-pressed', String(macros[i]?.key === active))
    })
  }, [active, instrument])

  const open = onOpenFuel && <Btn sm onClick={onOpenFuel}>Fuel megnyitása</Btn>
  return <section className="nm-fuel" aria-label="Mai energiabevitel és makrotápanyagok" data-active={active ?? undefined}>
    {isError ? <ErrorRow message="Az üzemanyagot most nem sikerült betölteni." onRetry={onRetry} />
      : isPending ? <Note role="status">Táplálkozási adatok betöltése…</Note>
      : guidance ? <Why icon="t-kimelo">Kímélő mód · ma nincs kalóriacél — folyadék, könnyű étel</Why>
      : <>
        <button type="button" className="nm-big" aria-label="Teljes energiabevitel megjelenítése" onClick={() => setActive(null)}>
          <b>{selected ? `${format(amount(consumed[selected.key]))} g` : format(kcal)}</b>
          <small>{selected
            ? `${selected.label.toLocaleLowerCase('hu')} · ${hasGoal(targets[selected.key]) ? `${Math.round(amount(consumed[selected.key]) / targets[selected.key] * 100)}% a napi célból` : 'nincs beállított cél'}`
            : `kcal ma · ${energyGoal ? `${format(targets.kcal)} kcal keret` : 'nincs beállított keret'}`}</small>
        </button>
        <div ref={vialsRef}>
          <Vials size="sm" height={124} items={macros.map(macro => {
            const goal = targets[macro.key]
            return {
              label: macro.label, icon: macro.icon, color: macro.color,
              value: `${format(amount(consumed[macro.key]))} g`,
              pct: hasGoal(goal) ? amount(consumed[macro.key]) / goal * 100 : 0,
              note: hasGoal(goal) ? `/ ${format(goal)} g cél` : 'nincs beállított cél',
              mark: active === macro.key ? '✓' : undefined,
              onClick: () => setActive(macro.key),
            }
          })} />
        </div>
        <Note role="status" aria-live="polite">{detail}</Note>
      </>}
    {(open || (instrument && selected)) && <Acts>
      {instrument && selected && <Btn sm ghost onClick={() => setActive(null)}>Vissza az összképhez</Btn>}
      {open}
    </Acts>}
  </section>
}
