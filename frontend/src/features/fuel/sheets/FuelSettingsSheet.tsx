import { useEffect, useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useFuelSettings, useFuelSettingsActions } from '@/data/hooks'

const ROW: React.CSSProperties = { justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }
const LABEL: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }

/** Fuel planner settings editor (mezo-53su): eating cadence + caffeine cutoff. */
export function FuelSettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings, isPending } = useFuelSettings()
  const { setSettings, pending } = useFuelSettingsActions()
  const [mealsPerDay, setMealsPerDay] = useState(settings.mealsPerDay)
  const [caffeineCutoff, setCaffeineCutoff] = useState(settings.caffeineCutoff)
  // Cold-open prefill race (mezo-53su): in real mode the read starts from the ghost (4/14:00)
  // and flips to the server value once the fetch lands. Re-sync the prefill when it arrives —
  // unless the user has already edited (touched), so an in-flight edit is never clobbered.
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (isPending || touched) return
    setMealsPerDay(settings.mealsPerDay)
    setCaffeineCutoff(settings.caffeineCutoff)
  }, [isPending, touched, settings.mealsPerDay, settings.caffeineCutoff])

  // Guard a blind Save while the real value is still loading: the ghost prefill must not be
  // persistable over the user's real settings.
  const busy = pending || isPending

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

          <button type="button" className="cta-primary" disabled={busy}
            style={{ opacity: busy ? 0.5 : 1 }} onClick={() => save(close)}>
            <Icon name="check" size={14} /> Mentés
          </button>
        </div>
      )}
    </Sheet>
  )
}
