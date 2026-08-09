// ============================================================
// Mezo · WaterLogSheet — the víz-gyűrű's tap target (mezo-c9t5, keret-hero Task 2). Rides the
// shared `Sheet` primitive; 250/400/500 ml single-select chips or a manual ml input (typing
// a manual value deselects the chip and takes over — "kézi input felülírja"), Mentés logs
// the selected/typed amount via `onLog` then dismisses. The opener owns `useWaterActions`
// (`logWater`) and wires it into `onLog` — this component has no `@/data/*` import.
// Design: docs/superpowers/specs/2026-08-09-fuel-keret-hero-design.md §1.2.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { CtaPrimary } from '@/shared/ui/Cta'
import { hu1 } from '@/shared/lib/huNum'

const CHIP_ML = [250, 400, 500] as const

export function WaterLogSheet({ currentMl, targetMl, onLog, onClose }: {
  currentMl: number
  targetMl: number
  onLog: (ml: number) => void
  onClose: () => void
}) {
  const [chip, setChip] = useState<number | null>(null)
  const [manual, setManual] = useState('')

  const manualNum = manual.trim() === '' ? null : Number(manual)
  const manualValid = manualNum != null && Number.isFinite(manualNum) && manualNum > 0
  const selected = manualValid ? (manualNum as number) : chip
  const canSave = selected != null && selected > 0

  const pickChip = (ml: number) => { setChip(ml); setManual('') }
  const editManual = (v: string) => { setManual(v); setChip(null) }

  const save = (close: () => void) => {
    if (selected == null || selected <= 0) return
    onLog(selected)
    close()
  }

  return (
    <Sheet onClose={onClose} labelledBy="water-log-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', textAlign: 'center' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="eyebrow" style={{ color: 'var(--sky)' }}>💧 Víz logolása</span>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>
          <h2 id="water-log-title" className="h-display size-md" style={{ marginTop: 4 }}>Mennyit ittál?</h2>
          <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
            ma eddig {hu1(currentMl / 1000)} / {hu1(targetMl / 1000)} l
          </p>
          <div className="row gap-sm mt-lg" style={{ justifyContent: 'center' }}>
            {CHIP_ML.map(ml => (
              <button
                key={ml}
                type="button"
                aria-pressed={chip === ml}
                className={'chip' + (chip === ml ? ' brand' : '')}
                style={{ padding: '10px 16px', fontSize: 13 }}
                onClick={() => pickChip(ml)}
              >
                {ml} ml
              </button>
            ))}
          </div>
          <div className="row gap-sm mt-md" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="pl. 330"
              aria-label="Víz mennyisége kézzel (ml)"
              value={manual}
              onChange={e => editManual(e.target.value)}
              style={{
                width: 90, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700,
                padding: '9px 12px', borderRadius: 'var(--r-lg)', border: '1px solid var(--divider)',
                background: 'var(--surface-page)', color: 'var(--text-primary)',
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>ml kézzel</span>
          </div>
          <CtaPrimary style={{ marginTop: 16, alignSelf: 'center' }} disabled={!canSave} onClick={() => save(close)}>
            <Icon name="check" size={14} /> Mentés
          </CtaPrimary>
        </div>
      )}
    </Sheet>
  )
}
