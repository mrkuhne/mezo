import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { DietSettings } from '@/data/types'
import {
  useDietSettings,
  useDietSettingsActions,
  useFuelDay,
  useFuelSettings,
  useFuelSettingsActions,
} from '@/data/hooks'
import { buildFuelSettingsMacroPreview } from '@/features/fuel/logic/fuelSettingsPreview'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const PRESET_LABELS: Record<DietSettings['splitPreset'], string> = {
  balanced: 'Kiegyensúlyozott',
  low_fat: 'Alacsony zsír',
  low_carb: 'Alacsony szénhidrát',
  high_carb: 'Magas szénhidrát',
  custom: 'Egyéni',
}

const PRESET_KEYS = Object.keys(PRESET_LABELS) as DietSettings['splitPreset'][]
const huInt = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0, useGrouping: true })

function arcPoint(progress: number) {
  return {
    x: 24 + progress * 272,
    y: 100 - Math.sin(progress * Math.PI) * 72,
  }
}

function NumberStepper({ label, actionLabel = label, value, min, max, step = 1, suffix, offAtZero, onChange }: {
  label: string
  actionLabel?: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  offAtZero?: boolean
  onChange: (value: number) => void
}) {
  const display = offAtZero && value === 0 ? 'ki' : `${value}${suffix ? ` ${suffix}` : ''}`
  return (
    <div className="fset-stepper">
      <button type="button" className="chip np-press" aria-label={`${actionLabel} csökkentése`}
        disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        <Icon name="minus" size={12} />
      </button>
      <span aria-label={label}>{display}</span>
      <button type="button" className="chip np-press" aria-label={`${actionLabel} növelése`}
        disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        <Icon name="plus" size={12} />
      </button>
    </div>
  )
}

export function FuelSettingsPage() {
  const navigate = useNavigate()
  const { settings, isPending } = useFuelSettings()
  const { setSettings, pending } = useFuelSettingsActions()
  const { settings: diet, isPending: dietPending } = useDietSettings()
  const { setSettings: setDiet, pending: dietSaving } = useDietSettingsActions()
  const { fuel } = useFuelDay()

  const [mealsPerDay, setMealsPerDay] = useState(settings.mealsPerDay)
  const [caffeineCutoff, setCaffeineCutoff] = useState(settings.caffeineCutoff)
  const [splitPreset, setSplitPreset] = useState(diet.splitPreset)
  const [pPct, setPPct] = useState(diet.proteinPctX10 != null ? diet.proteinPctX10 / 10 : 30)
  const [cPct, setCPct] = useState(diet.carbsPctX10 != null ? diet.carbsPctX10 / 10 : 40)
  const [fPct, setFPct] = useState(diet.fatPctX10 != null ? diet.fatPctX10 / 10 : 30)
  const [proteinTier, setProteinTier] = useState(diet.proteinTier)
  const [waterMl, setWaterMl] = useState(diet.waterMl)
  const [fiberG, setFiberG] = useState(diet.fiberG)
  const [dayTypeShiftKcal, setDayTypeShiftKcal] = useState(diet.dayTypeShiftKcal)
  const [touchedFuel, setTouchedFuel] = useState(false)
  const [touchedDiet, setTouchedDiet] = useState(false)

  useEffect(() => {
    if (isPending || touchedFuel) return
    setMealsPerDay(settings.mealsPerDay)
    setCaffeineCutoff(settings.caffeineCutoff)
  }, [isPending, touchedFuel, settings.mealsPerDay, settings.caffeineCutoff])

  useEffect(() => {
    if (dietPending || touchedDiet) return
    setSplitPreset(diet.splitPreset)
    setPPct(diet.proteinPctX10 != null ? diet.proteinPctX10 / 10 : 30)
    setCPct(diet.carbsPctX10 != null ? diet.carbsPctX10 / 10 : 40)
    setFPct(diet.fatPctX10 != null ? diet.fatPctX10 / 10 : 30)
    setProteinTier(diet.proteinTier)
    setWaterMl(diet.waterMl)
    setFiberG(diet.fiberG)
    setDayTypeShiftKcal(diet.dayTypeShiftKcal)
  }, [dietPending, touchedDiet, diet.splitPreset, diet.proteinPctX10, diet.carbsPctX10,
    diet.fatPctX10, diet.proteinTier, diet.waterMl, diet.fiberG, diet.dayTypeShiftKcal])

  const customSumOk = splitPreset !== 'custom' || Math.round((pPct + cPct + fPct) * 10) === 1000
  const busy = pending || isPending || dietSaving || dietPending || !customSumOk
  const preview = useMemo(() => buildFuelSettingsMacroPreview(fuel.targets), [fuel.targets])
  const dietDirty = splitPreset !== diet.splitPreset
    || proteinTier !== diet.proteinTier || waterMl !== diet.waterMl || fiberG !== diet.fiberG
    || dayTypeShiftKcal !== diet.dayTypeShiftKcal
    || (splitPreset === 'custom' && (
      Math.round(pPct * 10) !== diet.proteinPctX10
      || Math.round(cPct * 10) !== diet.carbsPctX10
      || Math.round(fPct * 10) !== diet.fatPctX10
    ))
  const mealPoints = Array.from({ length: mealsPerDay }, (_, index) =>
    arcPoint(0.08 + index * (0.84 / Math.max(1, mealsPerDay - 1))))
  const [cutoffHours, cutoffMinutes] = caffeineCutoff.split(':').map(Number)
  const cutoffProgress = Math.min(1, Math.max(0, ((cutoffHours + cutoffMinutes / 60) - 6) / 18))
  const cutoffPoint = arcPoint(cutoffProgress)

  const save = async () => {
    await Promise.all([
      setSettings({ mealsPerDay, caffeineCutoff }),
      setDiet({
        splitPreset,
        proteinPctX10: splitPreset === 'custom' ? Math.round(pPct * 10) : null,
        carbsPctX10: splitPreset === 'custom' ? Math.round(cPct * 10) : null,
        fatPctX10: splitPreset === 'custom' ? Math.round(fPct * 10) : null,
        proteinTier, waterMl, fiberG, dayTypeShiftKcal,
      }),
    ])
    navigate('/fuel')
  }

  const saveBar = typeof document === 'undefined' ? null : createPortal(
    <div className="recipe-save-bar fset-savebar">
      <button type="button" className="cta-primary fset-save np-press" disabled={busy}
        onClick={() => void save()}>
        <Icon name="check" size={14} /> Mentés
      </button>
    </div>,
    document.querySelector('.phone-screen') ?? document.body,
  )

  return (
    <MozaikPage tone="sage" className="fset-page">
      <PageHead onBack={() => navigate(-1)} label="‹ Fuel">
        <h1 className="fset-title">Fuel beállítások</h1>
      </PageHead>
      <EntranceGroup>
      <PageBody className="fset-body">
        <section className="fset-hero rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          <span className="fset-eyebrow">Napi ritmus</span>
          <div className="fset-hero-head">
            <strong>{mealsPerDay} étkezés</strong>
            <span className="fset-cutoff-pill">koffein-stop · {caffeineCutoff}</span>
          </div>
          <p className="fset-summary">{mealsPerDay} étkezés · koffein-stop {caffeineCutoff}</p>
          <div className="fset-arc-wrap">
            <svg className="fset-dayarc" viewBox="0 0 320 118" aria-hidden="true" focusable="false">
              <path className="fset-arc-track" d="M24 100 C88 4 232 4 296 100" />
              <path className="fset-arc-glow" d="M24 100 C88 4 232 4 296 100" />
              {mealPoints.map((point, index) => (
                <circle key={index} className="fset-meal-dot" cx={point.x} cy={point.y} r="6" />
              ))}
              <line className="fset-cutoff-line" x1={cutoffPoint.x} y1={cutoffPoint.y - 13}
                x2={cutoffPoint.x} y2={cutoffPoint.y + 13} />
              <circle className="fset-cutoff-dot" cx={cutoffPoint.x} cy={cutoffPoint.y} r="4" />
            </svg>
            <div className="fset-axis"><span>06</span><span>12</span><span>18</span><span>24</span></div>
          </div>
          <p className="fset-principle">A napi ív együtt mozdul a beállításaiddal.</p>
        </section>

        <section className="fset-card rise" style={{ '--d': '60ms' } as React.CSSProperties}
          aria-labelledby="fset-rhythm-title">
          <h2 id="fset-rhythm-title">Ritmus</h2>
          <div className="fset-row">
            <span>Étkezés/nap</span>
            <NumberStepper label="Étkezés/nap" actionLabel="Étkezés" value={mealsPerDay} min={3} max={6}
              onChange={(value) => { setTouchedFuel(true); setMealsPerDay(value) }} />
          </div>
          <label className="fset-row">
            <span>Koffein-cutoff</span>
            <input type="time" aria-label="Koffein-cutoff" value={caffeineCutoff}
              onChange={(event) => {
                if (!event.target.value) return
                setTouchedFuel(true)
                setCaffeineCutoff(event.target.value)
              }} />
          </label>
          <p>A cutoff a Mai chipet, a nap-tervet és a koffein-habitot is állítja.</p>
        </section>

        <section className="fset-card fset-preview rise" style={{ '--d': '110ms' } as React.CSSProperties}
          aria-labelledby="fset-macros-title">
          <h2 id="fset-macros-title">Makrók</h2>
          <label className="fset-selectrow">
            <span>Makróprofil</span>
            <select aria-label="Makróprofil" value={splitPreset}
              onChange={(event) => {
                setTouchedDiet(true)
                setSplitPreset(event.target.value as DietSettings['splitPreset'])
              }}>
              {PRESET_KEYS.map((key) => <option key={key} value={key}>{PRESET_LABELS[key]}</option>)}
            </select>
          </label>

          {preview ? (
            <div className="fset-target-preview">
              <span className="fset-target-label">Mai cél alapján</span>
              <div className="fset-macro-preview-body">
                <div className="fset-donut" style={{
                  '--protein-pct': `${preview.protein.pct}%`,
                  '--carbs-end': `${preview.protein.pct + preview.carbs.pct}%`,
                } as React.CSSProperties}>
                  <span><strong>{huInt.format(preview.kcal)} kcal</strong><small>aktív cél</small></span>
                </div>
                <div className="fset-macro-rows">
                  <div><span>Fehérje</span><b>{preview.protein.pct}% · {huInt.format(preview.protein.grams)} g</b></div>
                  <div><span>Szénhidrát</span><b>{preview.carbs.pct}% · {huInt.format(preview.carbs.grams)} g</b></div>
                  <div><span>Zsír</span><b>{preview.fat.pct}% · {huInt.format(preview.fat.grams)} g</b></div>
                </div>
              </div>
            </div>
          ) : <p>A napi cél betöltése…</p>}
          {dietDirty && <p className="fset-refresh-note">Mentés után frissül</p>}

          {splitPreset === 'custom' && (
            <div className="fset-custom">
              {([
                ['Fehérje %', pPct, setPPct],
                ['Szénhidrát %', cPct, setCPct],
                ['Zsír %', fPct, setFPct],
              ] as const).map(([label, value, setter]) => (
                <label key={label}>{label}
                  <input type="number" min={0} max={100} step={0.5} aria-label={label} value={value}
                    onChange={(event) => { setTouchedDiet(true); setter(Number(event.target.value)) }} />
                </label>
              ))}
            </div>
          )}
          {splitPreset === 'custom' && !customSumOk
            && <p className="fset-error">Az arányoknak 100%-ra kell összegződniük.</p>}
          {splitPreset === 'custom'
            && <p>A fehérje-cél g/kg alapon védett; az eltérést a szénhidrát nyeli el.</p>}
        </section>

        <div className="fset-goalgrid rise" style={{ '--d': '160ms' } as React.CSSProperties}>
          <label className="fset-card">
            <span>Víz-cél (ml)</span>
            <input type="number" min={500} max={8000} step={100} aria-label="Víz-cél" value={waterMl}
              onChange={(event) => { setTouchedDiet(true); setWaterMl(Number(event.target.value)) }} />
          </label>
          <label className="fset-card">
            <span>Rost-cél (g)</span>
            <input type="number" min={10} max={80} aria-label="Rost-cél" value={fiberG}
              onChange={(event) => { setTouchedDiet(true); setFiberG(Number(event.target.value)) }} />
          </label>
        </div>

        <section className="fset-card rise" style={{ '--d': '210ms' } as React.CSSProperties}
          aria-labelledby="fset-protein-title">
          <h2 id="fset-protein-title">Finomhangolás</h2>
          <div className="fset-row">
            <span>Fehérje-szint</span>
            <div className="fset-segments">
              <button type="button" className="chip np-press" aria-pressed={proteinTier === 'moderate'}
                onClick={() => { setTouchedDiet(true); setProteinTier('moderate') }}>Mérsékelt</button>
              <button type="button" className="chip np-press" aria-pressed={proteinTier === 'high'}
                onClick={() => { setTouchedDiet(true); setProteinTier('high') }}>Magas</button>
            </div>
          </div>
          <div className="fset-row">
            <span>Edzőnap-shift</span>
            <NumberStepper label="Edzőnap-shift" value={dayTypeShiftKcal} min={0} max={500}
              step={50} suffix="kcal" offAtZero
              onChange={(value) => { setTouchedDiet(true); setDayTypeShiftKcal(value) }} />
          </div>
          <p>Pihenőnapról edzőnapra átcsoportosított kcal; a heti keret nem változik.</p>
        </section>

        <button type="button" className="fset-card fset-slots np-press rise"
          style={{ '--d': '260ms' } as React.CSSProperties}
          aria-label="Étkezési ablakok szerkesztése" onClick={() => navigate('/fuel/slots')}>
          <span>Étkezési ablakok</span>
          <strong>szerkesztése <span aria-hidden="true">›</span></strong>
        </button>
        <p className="fset-closing rise" style={{ '--d': '300ms' } as React.CSSProperties}>
          A ritmus vezet, nem korlátoz — bármelyik ablak utólag is logolható.
        </p>
      </PageBody>
      </EntranceGroup>
      {saveBar}
    </MozaikPage>
  )
}
