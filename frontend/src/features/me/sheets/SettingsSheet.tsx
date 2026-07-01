// ============================================================
// Mezo · SettingsSheet — Megjelenés
// Téma váltás (useTheme) — the only real, persisted setting.
// Opened by the Profil gear chip (parent owns open/close state).
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { LabelMono } from '@/shared/ui/LabelMono'
import { Display } from '@/shared/ui/Display'
import { Icon } from '@/shared/ui/Icon'
import { Toggle } from '@/shared/ui/Toggle'
import { useTheme } from '@/app/ThemeProvider'

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { theme, toggle } = useTheme()
  const light = theme === 'light'
  return (
    <Sheet onClose={onClose} labelledBy="settings-title">
      {(close) => (
        <div className="col gap-lg" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="col gap-xs">
              <Eyebrow brand>Beállítások</Eyebrow>
              {/* Display does not forward an `id`, so wrap to anchor aria-labelledby. */}
              <div id="settings-title">
                <Display size="md">Megjelenés</Display>
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="col gap-sm">
            <LabelMono>Téma</LabelMono>
            <div className="card notch-4 row" style={{ justifyContent: 'space-between', padding: 14, gap: 12 }}>
              <div className="row gap-md">
                <span style={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'grid', placeItems: 'center',
                  background: light ? 'rgba(245,158,11,0.12)' : 'rgba(94,234,212,0.12)',
                }}>
                  <Icon name={light ? 'sun' : 'moon'} size={16} color={light ? 'var(--warning)' : 'var(--brand-glow)'} />
                </span>
                <div className="col">
                  <span>{light ? 'Light mód' : 'Dark mód'}</span>
                  <span className="label-mono">{light ? 'Világos felület · nappali nézet' : 'Sötét felület · alapértelmezett'}</span>
                </div>
              </div>
              <Toggle on={light} onToggle={toggle} ariaLabel="Téma váltás" />
            </div>
          </div>
        </div>
      )}
    </Sheet>
  )
}
