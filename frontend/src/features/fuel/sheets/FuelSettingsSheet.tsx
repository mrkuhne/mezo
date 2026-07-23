import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useFuelSettings, useFuelSettingsActions } from '@/data/hooks'

const ROW: React.CSSProperties = { justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }
const LABEL: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }

/** Fuel planner settings editor (mezo-53su): eating cadence + caffeine cutoff. */
export function FuelSettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings } = useFuelSettings()
  const { setSettings, pending } = useFuelSettingsActions()
  const [mealsPerDay, setMealsPerDay] = useState(settings.mealsPerDay)
  const [caffeineCutoff, setCaffeineCutoff] = useState(settings.caffeineCutoff)

  const save = (close: () => void) =>
    setSettings({ mealsPerDay, caffeineCutoff }).then(close)

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
                disabled={mealsPerDay <= 3} onClick={() => setMealsPerDay(v => Math.max(3, v - 1))}
                style={{ opacity: mealsPerDay <= 3 ? 0.4 : 1 }}><Icon name="minus" size={12} /></button>
              <span aria-label="Étkezés/nap"
                style={{ minWidth: 18, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {mealsPerDay}
              </span>
              <button type="button" className="chip" aria-label="Étkezés növelése"
                disabled={mealsPerDay >= 6} onClick={() => setMealsPerDay(v => Math.min(6, v + 1))}
                style={{ opacity: mealsPerDay >= 6 ? 0.4 : 1 }}><Icon name="plus" size={12} /></button>
            </div>
          </div>

          <div className="row" style={ROW}>
            <span style={LABEL}>Koffein-cutoff</span>
            <input type="time" aria-label="Koffein-cutoff" value={caffeineCutoff}
              onChange={(e) => e.target.value && setCaffeineCutoff(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontVariantNumeric: 'tabular-nums', colorScheme: 'dark' }} />
          </div>
          <span style={{ fontSize: 9, color: 'var(--faint)' }}>A cutoff a Mai chipet, a nap-tervet és a koffein-habitot is állítja.</span>

          <button type="button" className="cta-primary" disabled={pending}
            style={{ opacity: pending ? 0.5 : 1 }} onClick={() => save(close)}>
            <Icon name="check" size={14} /> Mentés
          </button>
        </div>
      )}
    </Sheet>
  )
}
