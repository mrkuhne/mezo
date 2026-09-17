import { useId, useState } from 'react'
import type { CSSProperties } from 'react'
import type { MacroSet } from '@/data/types'
import '@/features/today/components/NapFuelGraphic.css'

interface NapFuelGraphicProps {
  consumed: MacroSet
  targets: MacroSet
  isPending?: boolean
  isError?: boolean
  onRetry?: () => void
}

const macros = [
  { key: 'p', label: 'Fehérje', goalName: 'fehérjecél', color: 'var(--dv-sky)', radius: 115 },
  { key: 'c', label: 'Szénhidrát', goalName: 'szénhidrátcél', color: 'var(--dv-amber)', radius: 94 },
  { key: 'f', label: 'Zsír', goalName: 'zsírcél', color: 'var(--dv-lav)', radius: 73 },
] as const
const format = (value: number) => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1, useGrouping: true }).format(value).replace(/\u00a0/g, ' ')
const amount = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0
const hasGoal = (value: number) => Number.isFinite(value) && value > 0

/** A presentational instrument: no estimated macros, mock fallback, or data fetching. */
export function NapFuelGraphic({ consumed, targets, isPending, isError, onRetry }: NapFuelGraphicProps) {
  const id = useId()
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

  return <section className="nap-fuel" aria-label="Mai energiabevitel és makrotápanyagok" data-active={active ?? undefined}>
    <div className="nap-fuel-heading"><h2>A napod üzemanyaga</h2><span>Fuel · ma</span></div>
    {isError ? <div className="nap-fuel-state" role="alert">Nem sikerült betölteni a táplálkozási adatokat.{onRetry && <button type="button" onClick={onRetry}>Újra</button>}</div>
      : isPending ? <div className="nap-fuel-state" role="status">Táplálkozási adatok betöltése…</div>
      : <>
        <div className="nap-fuel-reactor">
          <svg viewBox="0 0 340 274" aria-hidden="true" focusable="false">
            <defs>{macros.map(macro => <linearGradient key={macro.key} id={`${id}-${macro.key}`} x1="0" y1="1" x2="1" y2="0">
              <stop stopColor={macro.color} stopOpacity=".45" />
              <stop offset=".4" stopColor={macro.color} />
              <stop offset=".73" stopColor={`color-mix(in srgb, ${macro.color} 25%, var(--text-inverse))`} />
              <stop offset="1" stopColor={macro.color} />
            </linearGradient>)}</defs>
            {macros.map(macro => {
              const progress = hasGoal(targets[macro.key]) ? Math.min(1, amount(consumed[macro.key]) / targets[macro.key]) * 75 : 0
              return <g key={macro.key} data-macro={macro.key} transform="rotate(135 170 132)" style={{ color: macro.color }}>
                <circle cx="170" cy="132" r={macro.radius} fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="11" pathLength="100" strokeDasharray="75 25" strokeLinecap="round" />
                {progress > 0 && <circle className="nap-fuel-arc" cx="170" cy="132" r={macro.radius} fill="none" stroke={`url(#${id}-${macro.key})`} strokeWidth="11" pathLength="100" strokeDasharray={`${progress} 100`} strokeLinecap="round" />}
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
        <div className="nap-fuel-choices">{macros.map(macro => <button type="button" key={macro.key} className="nap-fuel-macro" aria-pressed={active === macro.key} style={{ '--fuel-color': macro.color } as CSSProperties} onClick={() => setActive(macro.key)}>
          <i className="nap-fuel-bead" aria-hidden="true" />
          <span>{macro.label}</span><strong>{format(amount(consumed[macro.key]))} g</strong>
          <small>{hasGoal(targets[macro.key]) ? `/ ${format(targets[macro.key])} g cél` : 'Nincs beállított cél'}</small>
        </button>)}</div>
        <p className="nap-fuel-detail" role="status" aria-live="polite">{detail}</p>
      </>}
  </section>
}
