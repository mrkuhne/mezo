// ============================================================
// Mezo · SettingsSheet — Megjelenés
// Téma választó (useTheme) — the only real, persisted setting.
// Opened by the Profil gear chip (parent owns open/close state).
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { Display } from '@/shared/ui/Display'
import { Icon } from '@/shared/ui/Icon'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'
import { useTheme } from '@/app/ThemeProvider'
import type { ThemeMode } from '@/shared/lib/theme'

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { mode, setMode } = useTheme()
  const OPTIONS: { key: ThemeMode; icon: 'sun' | 'moon' | 'sparkle'; label: string; desc: string }[] = [
    { key: 'light', icon: 'sun', label: 'Világos', desc: 'Mindig nappali felület' },
    { key: 'dark', icon: 'moon', label: 'Sötét', desc: 'Mindig sötét felület' },
    { key: 'auto', icon: 'sparkle', label: 'Cirkadián', desc: 'Este a tompítással (lefekvés −90 p) sötétre vált, ébredés előtt 30 perccel vissza világosra. Az alváscélodat követi.' },
  ]
  return (
    <Sheet onClose={onClose} labelledBy="settings-title">
      {(close) => (
        <div className="col gap-lg" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="col gap-xs">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Beállítások</span>
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
            <span style={SECTION_LABEL}>Téma</span>
            <div className="col gap-sm">
              {OPTIONS.map((o) => (
                <button key={o.key} className="card row" aria-pressed={mode === o.key}
                  onClick={() => setMode(o.key)}
                  style={{
                    justifyContent: 'space-between', padding: 14, gap: 12, textAlign: 'left',
                    borderColor: mode === o.key ? 'var(--lav-deep)' : 'var(--border-subtle)',
                    background: mode === o.key ? 'var(--wash-lav)' : undefined,
                  }}>
                  <div className="row gap-md" style={{ alignItems: 'flex-start' }}>
                    <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, background: mode === o.key ? 'var(--wash-lav)' : 'var(--surface-2)' }}>
                      <Icon name={o.icon} size={16} color={mode === o.key ? 'var(--lav-deep)' : 'var(--text-tertiary)'} />
                    </span>
                    <div className="col">
                      <span>{o.label}</span>
                      <span style={SECTION_LABEL}>{o.desc}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Sheet>
  )
}
