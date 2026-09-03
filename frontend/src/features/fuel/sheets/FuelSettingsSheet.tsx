import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useFuelSettings, useFuelSettingsActions, useDietSettings, useDietSettingsActions } from '@/data/hooks'
import type { DietSettings } from '@/data/types'

const ROW: React.CSSProperties = { justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }
const LABEL: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }

const PRESET_LABELS: Record<DietSettings['splitPreset'], string> = {
  balanced: 'Kiegyensúlyozott', low_fat: 'Alacsony zsír', low_carb: 'Alacsony szénhidrát',
  high_carb: 'Magas szénhidrát', custom: 'Egyéni',
}

/** Fuel planner settings editor (mezo-53su): eating cadence + caffeine cutoff.
 *  Diéta section (Diet Plan slice 1, mezo-xwgb): macro-split preset/custom %, protein tier, water/fiber. */
export function FuelSettingsSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { settings, isPending } = useFuelSettings()
  const { setSettings, pending } = useFuelSettingsActions()
  const [mealsPerDay, setMealsPerDay] = useState(settings.mealsPerDay)
  const [caffeineCutoff, setCaffeineCutoff] = useState(settings.caffeineCutoff)

  const { settings: diet, isPending: dietPending } = useDietSettings()
  const { setSettings: setDiet, pending: dietSaving } = useDietSettingsActions()
  const [splitPreset, setSplitPreset] = useState(diet.splitPreset)
  const [pPct, setPPct] = useState(diet.proteinPctX10 != null ? diet.proteinPctX10 / 10 : 30)
  const [cPct, setCPct] = useState(diet.carbsPctX10 != null ? diet.carbsPctX10 / 10 : 40)
  const [fPct, setFPct] = useState(diet.fatPctX10 != null ? diet.fatPctX10 / 10 : 30)
  const [proteinTier, setProteinTier] = useState(diet.proteinTier)
  const [waterMl, setWaterMl] = useState(diet.waterMl)
  const [fiberG, setFiberG] = useState(diet.fiberG)

  // Cold-open prefill race (mezo-53su): in real mode the read starts from the ghost (4/14:00)
  // and flips to the server value once the fetch lands. Re-sync the prefill when it arrives —
  // unless the user has already edited (touched), so an in-flight edit is never clobbered.
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (isPending || touched) return
    setMealsPerDay(settings.mealsPerDay)
    setCaffeineCutoff(settings.caffeineCutoff)
  }, [isPending, touched, settings.mealsPerDay, settings.caffeineCutoff])
  useEffect(() => {
    if (dietPending || touched) return
    setSplitPreset(diet.splitPreset)
    setPPct(diet.proteinPctX10 != null ? diet.proteinPctX10 / 10 : 30)
    setCPct(diet.carbsPctX10 != null ? diet.carbsPctX10 / 10 : 40)
    setFPct(diet.fatPctX10 != null ? diet.fatPctX10 / 10 : 30)
    setProteinTier(diet.proteinTier)
    setWaterMl(diet.waterMl)
    setFiberG(diet.fiberG)
  }, [dietPending, touched, diet.splitPreset, diet.proteinPctX10, diet.carbsPctX10, diet.fatPctX10, diet.proteinTier, diet.waterMl, diet.fiberG])

  // Custom split must sum to exactly 100.0% (rounded to 0.1) before Save is allowed.
  const customSumOk = splitPreset !== 'custom' || Math.round((pPct + cPct + fPct) * 10) === 1000

  // Guard a blind Save while the real value is still loading: the ghost prefill must not be
  // persistable over the user's real settings.
  const busy = pending || isPending || dietSaving || dietPending || !customSumOk

  const save = (close: () => void) =>
    Promise.all([
      setSettings({ mealsPerDay, caffeineCutoff }),
      setDiet({
        splitPreset,
        proteinPctX10: splitPreset === 'custom' ? Math.round(pPct * 10) : null,
        carbsPctX10: splitPreset === 'custom' ? Math.round(cPct * 10) : null,
        fatPctX10: splitPreset === 'custom' ? Math.round(fPct * 10) : null,
        proteinTier, waterMl, fiberG,
      }),
    ]).then(close)

  return (
    <Sheet onClose={onClose} labelledBy="fuel-settings-title">
      {(close) => (
        <div className="col gap-sm">
          <h2 id="fuel-settings-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            Fuel beállítások
          </h2>

          <div className="row" style={ROW}>
            <span style={LABEL}>Étkezés/nap</span>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <button type="button" className="chip" aria-label="Étkezés csökkentése"
                disabled={mealsPerDay <= 3} onClick={() => { setTouched(true); setMealsPerDay(v => Math.max(3, v - 1)) }}
                style={{ opacity: mealsPerDay <= 3 ? 0.4 : 1 }}><Icon name="minus" size={12} /></button>
              <span aria-label="Étkezés/nap"
                style={{ minWidth: 18, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {mealsPerDay}
              </span>
              <button type="button" className="chip" aria-label="Étkezés növelése"
                disabled={mealsPerDay >= 6} onClick={() => { setTouched(true); setMealsPerDay(v => Math.min(6, v + 1)) }}
                style={{ opacity: mealsPerDay >= 6 ? 0.4 : 1 }}><Icon name="plus" size={12} /></button>
            </div>
          </div>

          <div className="row" style={ROW}>
            <span style={LABEL}>Koffein-cutoff</span>
            <input type="time" aria-label="Koffein-cutoff" value={caffeineCutoff}
              onChange={(e) => { if (e.target.value) { setTouched(true); setCaffeineCutoff(e.target.value) } }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontVariantNumeric: 'tabular-nums', colorScheme: 'dark' }} />
          </div>
          <span style={{ fontSize: 9, color: 'var(--faint)' }}>A cutoff a Mai chipet, a nap-tervet és a koffein-habitot is állítja.</span>

          {/* Diéta section (Diet Plan slice 1, mezo-xwgb) */}
          <span style={{ ...LABEL, marginTop: 6 }}>Diéta · makró-arány</span>
          <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
            {(Object.keys(PRESET_LABELS) as DietSettings['splitPreset'][]).map(k => (
              <button key={k} type="button" className="chip" aria-pressed={splitPreset === k}
                style={{ fontWeight: splitPreset === k ? 800 : 500 }}
                onClick={() => { setTouched(true); setSplitPreset(k) }}>
                {PRESET_LABELS[k]}
              </button>
            ))}
          </div>
          {splitPreset === 'custom' && (
            <div className="row gap-sm" style={ROW}>
              {([['Fehérje %', pPct, setPPct], ['Szénhidrát %', cPct, setCPct], ['Zsír %', fPct, setFPct]] as const)
                .map(([label, value, set]) => (
                  <label key={label} className="col" style={{ fontSize: 9, color: 'var(--faint)' }}>
                    {label}
                    <input type="number" min={0} max={100} step={0.5} aria-label={label} value={value}
                      onChange={(e) => { setTouched(true); set(Number(e.target.value)) }}
                      style={{ width: 56, background: 'transparent', border: '1px solid var(--surface-3)', color: 'var(--text-primary)' }} />
                  </label>
                ))}
            </div>
          )}
          {splitPreset === 'custom' && !customSumOk && (
            <span style={{ fontSize: 9, color: 'var(--warn, #e6a23c)' }}>Az arányoknak 100%-ra kell összegződniük.</span>
          )}
          {splitPreset === 'custom' && (
            <span style={{ fontSize: 9, color: 'var(--faint)' }}>A fehérje-cél g/kg alapon védett — az egyéni fehérje-arány csak iránymutatás, az eltérést a szénhidrát nyeli el.</span>
          )}
          <div className="row" style={ROW}>
            <span style={LABEL}>Fehérje-szint</span>
            <div className="row gap-sm">
              <button type="button" className="chip" aria-pressed={proteinTier === 'moderate'}
                onClick={() => { setTouched(true); setProteinTier('moderate') }}>Mérsékelt</button>
              <button type="button" className="chip" aria-pressed={proteinTier === 'high'}
                onClick={() => { setTouched(true); setProteinTier('high') }}>Magas</button>
            </div>
          </div>
          <div className="row" style={ROW}>
            <span style={LABEL}>Víz-cél (ml)</span>
            <input type="number" min={500} max={8000} step={100} aria-label="Víz-cél" value={waterMl}
              onChange={(e) => { setTouched(true); setWaterMl(Number(e.target.value)) }}
              style={{ width: 72, background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'right' }} />
          </div>
          <div className="row" style={ROW}>
            <span style={LABEL}>Rost-cél (g)</span>
            <input type="number" min={10} max={80} aria-label="Rost-cél" value={fiberG}
              onChange={(e) => { setTouched(true); setFiberG(Number(e.target.value)) }}
              style={{ width: 72, background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'right' }} />
          </div>

          <button type="button" style={ROW} className="row" aria-label="Étkezési ablakok szerkesztése" onClick={() => { close(); navigate('/fuel/slots') }}>
            <span style={LABEL}>Étkezési ablakok</span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>szerkesztése <span aria-hidden="true">›</span></span>
          </button>

          <button type="button" className="cta-primary" disabled={busy}
            style={{ opacity: busy ? 0.5 : 1 }} onClick={() => save(close)}>
            <Icon name="check" size={14} /> Mentés
          </button>
        </div>
      )}
    </Sheet>
  )
}
