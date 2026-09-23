// ============================================================
// Mezo · WaterLogSheet — the víz-gyűrű's tap target (mezo-c9t5, keret-hero Task 2). Rides the
// shared `Sheet` primitive; 250/400/500 ml single-select chips or a manual ml input (typing
// a manual value deselects the chip and takes over — "kézi input felülírja"), Mentés logs
// the selected/typed amount via `onLog` then dismisses. The opener owns `useWaterActions`
// (`logWater`) and wires it into `onLog` — this component has no `@/data/*` import.
// Design: docs/superpowers/specs/2026-08-09-fuel-keret-hero-design.md §1.2.
// ============================================================
import { useState } from 'react'
import { CaptureHeader } from '@/shared/ui/CaptureHeader'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D } from '@/shared/ui/clay'
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
    <Sheet onClose={onClose} labelledBy="water-log-title" className="capture-sheet capture-tone-water glass">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', textAlign: 'center' }}>
          <CaptureHeader id="water-log-title" title="Mennyit ittál?" subtitle="Egy korty szünet." kind="water" eyebrow="Víz" onClose={close} />
          {/* Üveg (mezo-me75u.3, `SH.water`): the one loud value — a frameless sky wash with the
              64px/200 glowing numeral; today's running total is its sub line. */}
          <div className="capture-hero capture-water-hero">
            <output className="capture-hero-value capture-water-value" aria-label="Rögzítendő vízmennyiség" aria-live="polite">{selected ?? '—'}<small> ml</small></output>
            <p className="capture-hero-sub">
              ma eddig {hu1(currentMl / 1000)} / {hu1(targetMl / 1000)} l
            </p>
          </div>
          <div className="row gap-sm mt-lg" style={{ justifyContent: 'center' }}>
            {CHIP_ML.map(ml => (
              <button
                key={ml}
                type="button"
                aria-pressed={chip === ml}
                // Üveg (mezo-me75u.2, `SH.water`): lapos égszín-cellák, a választott kitöltve, fénnyel.
                className={'flp-wchip' + (chip === ml ? ' is-on' : '')}
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
              className="flp-winput"
            />
            <span className="flp-wunit">ml kézzel</span>
          </div>
          <CtaPrimary className="capture-save" style={{ marginTop: 22, width: '100%' }} disabled={!canSave} onClick={() => save(close)}>
            <Icon3D name="t-tick" size={22} /> Mentés
          </CtaPrimary>
        </div>
      )}
    </Sheet>
  )
}
