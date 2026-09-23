import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { MacroSet } from '@/data/types'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import '@/features/today/components/NapFuelGraphic.css'

interface NapFuelGraphicProps {
  consumed: MacroSet
  targets: MacroSet
  isPending?: boolean
  isError?: boolean
  onRetry?: () => void
}

// A makró ARCA EGY helyen dől el az egész appban (owner 2026-09-18): ugyanaz a szín és
// ugyanaz az agyag szimbólum, amit a Fuel oldal gyűrűi viselnek (`FuelMacroRings`) — fehérje
// hús, szénhidrát gabona, zsír avokádó, a `--macro-*` sávon. Korábban itt a Nap saját
// kék/arany/lila készlete állt elmosódott „kavicsokkal", és ugyanaz a mennyiség két lapon
// két arcot viselt. A hue itt jelentés, nem bőr: egy makró egy szín, mindenhol.
// Üvegesítés U3 (mezo-me75u.3): az arc a Titanium 3D készletből jön (t-meat/t-carb/t-avocado,
// a Fuel gyűrűinek `CLAY_TO_3D` párjai), az ív a makró saját színében izzik (bible §5 gyűrű).
const macros = [
  { key: 'p', label: 'Fehérje', goalName: 'fehérjecél', color: 'var(--macro-protein)', icon: 't-meat', radius: 115 },
  { key: 'c', label: 'Szénhidrát', goalName: 'szénhidrátcél', color: 'var(--macro-carbs)', icon: 't-carb', radius: 94 },
  { key: 'f', label: 'Zsír', goalName: 'zsírcél', color: 'var(--macro-fat)', icon: 't-avocado', radius: 73 },
] as const satisfies readonly { key: string; label: string; goalName: string; color: string; icon: Icon3DName; radius: number }[]
const format = (value: number) => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1, useGrouping: true }).format(value).replace(/\u00a0/g, ' ')
const amount = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0
const hasGoal = (value: number) => Number.isFinite(value) && value > 0

/** A presentational instrument: no estimated macros, mock fallback, or data fetching. */
export function NapFuelGraphic({ consumed, targets, isPending, isError, onRetry }: NapFuelGraphicProps) {
  const [active, setActive] = useState<'p' | 'c' | 'f' | null>(null)
  const selected = macros.find(macro => macro.key === active)
  const kcal = amount(consumed.kcal)
  const energyGoal = hasGoal(targets.kcal)
  const energyRemaining = targets.kcal - kcal
  const empty = kcal === 0 && macros.every(macro => amount(consumed[macro.key]) === 0)
  let detail = empty ? 'Még nincs rögzített energiabevitel. Az étkezéseid itt rajzolják ki a napod.' : 'A három ív a saját napi célodhoz viszonyít. Érints meg egy makrót a részletekhez.'
  if (selected) {
    const value = amount(consumed[selected.key])
    const goal = targets[selected.key]
    detail = hasGoal(goal)
      ? `${format(Math.abs(goal - value))} g a ${format(goal)} g-os ${value > goal ? 'cél felett' : 'célig'}. Középre koppintva visszatérsz az összképhez.`
      : `Nincs beállított ${selected.goalName}. Ma ${format(value)} g-ot rögzítettél.`
  }

  // Rangsor (bible §3.4): a kártya ÜVEG, amber akcentussal; az üres nap szabad hely, ezért
  // szaggatott keret üveg nélkül (U1 6. szabály). Töltés és hiba közben az üveg marad.
  const open = empty && !isPending && !isError
  return <section className={`nap-fuel rise ${open ? 'uv-empty is-empty' : 'glass'}`} style={{ '--c': 'var(--dv-amber)', '--i': 2 } as CSSProperties}
    aria-label="Mai energiabevitel és makrotápanyagok" data-active={active ?? undefined}>
    <div className="nap-fuel-heading"><h2>A napod üzemanyaga</h2><span className="nap-fuel-tag"><Icon3D name="t-bowl" size={18} />Fuel · ma</span></div>
    {isError ? <div className="nap-fuel-state" role="alert">Nem sikerült betölteni a táplálkozási adatokat.{onRetry && <button type="button" onClick={onRetry}>Újra</button>}</div>
      : isPending ? <div className="nap-fuel-state" role="status">Táplálkozási adatok betöltése…</div>
      : <>
        <div className="nap-fuel-reactor">
          <svg className="uv-ring" viewBox="0 0 340 274" aria-hidden="true" focusable="false">
            {macros.map(macro => {
              const progress = hasGoal(targets[macro.key]) ? Math.min(1, amount(consumed[macro.key]) / targets[macro.key]) * 75 : 0
              return <g key={macro.key} data-macro={macro.key} transform="rotate(135 170 132)" style={{ '--c': macro.color } as CSSProperties}>
                <circle className="uv-ring-track" cx="170" cy="132" r={macro.radius} strokeWidth="11" pathLength="100" strokeDasharray="75 25" strokeLinecap="round" />
                {progress > 0 && <circle className="nap-fuel-arc uv-ring-prog" cx="170" cy="132" r={macro.radius} strokeWidth="11" pathLength="100" strokeDasharray={`${progress} 100`} strokeLinecap="round" />}
              </g>
            })}
          </svg>
          <button type="button" className="nap-fuel-core" aria-label="Teljes energiabevitel megjelenítése" onClick={() => setActive(null)}>
            <strong>{selected ? `${format(amount(consumed[selected.key]))} g` : format(kcal)}</strong>
            <span>{selected?.label ?? 'kcal ma'}</span>
            <small>{selected ? hasGoal(targets[selected.key]) ? `${Math.round(amount(consumed[selected.key]) / targets[selected.key] * 100)}% a napi célból` : 'Nincs beállított cél' : energyGoal ? `${format(targets.kcal)} kcal keret` : 'Nincs beállított keret'}</small>
          </button>
          <div className="nap-fuel-remaining">{energyGoal ? `${format(Math.abs(energyRemaining))} kcal a napi keret${energyRemaining < 0 ? ' felett' : 'ig'}` : 'A napi energiakeret még nincs beállítva'}</div>
        </div>
        <div className="nap-fuel-choices">{macros.map(macro => <button type="button" key={macro.key} className="nap-fuel-macro" aria-pressed={active === macro.key} style={{ '--fuel-color': macro.color, '--c': macro.color } as CSSProperties} onClick={() => setActive(macro.key)}>
          <i className="nap-fuel-bead" aria-hidden="true"><Icon3D name={macro.icon} size={30} /></i>
          <span>{macro.label}</span><strong>{format(amount(consumed[macro.key]))} g</strong>
          <small>{hasGoal(targets[macro.key]) ? `/ ${format(targets[macro.key])} g cél` : 'Nincs beállított cél'}</small>
        </button>)}</div>
        <p className="nap-fuel-detail" role="status" aria-live="polite">{detail}</p>
      </>}
  </section>
}
