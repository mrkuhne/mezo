import type { SleepGoal } from '@/data/types'
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetError, SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { useSleepGoal, useSleepGoalActions } from '@/data/hooks'
import { deriveSleepTimes } from '@/data/me/sleepGoal'
import { Icon3D } from '@/shared/ui/clay'

const STEP_MIN = 15
const MIN_TARGET = 240
const MAX_TARGET = 720

// Üveg (U10, mezo-me75u.10, `uveg-reteg` `SH.sleep`): a lavender glass sheet (sleep's own hue),
// the sleep 3D head, a big-numeral flat stepper with the recommended band, the anchor as two flat
// chips with their 3D icons (the chosen one lit), a flat time field, the lit „Cél mentése" pill.

/** Sleep-goal editor (spec §5): duration stepper + fixed-end toggle + live-derived other end. */
export function SleepGoalSheet({ onClose }: { onClose: () => void }) {
  const { goal, isPending, isError, refetch } = useSleepGoal()
  if (isPending || isError) {
    return (
      <Sheet glass onClose={onClose} labelledBy="sleep-goal-title" className="uvl-alvas">
        <div className="uvl-body">
          <SheetHead icon="t-sleep" eyebrow="Alvás" title="Alvás-cél" titleId="sleep-goal-title" />
          {isError ? (
            <>
              <SheetError>Az alváscél nem tölthető be.</SheetError>
              <button type="button" className="uvl-ghost" onClick={refetch}>Újra</button>
            </>
          ) : <p role="status" className="uvl-lead">Alváscél betöltése…</p>}
        </div>
      </Sheet>
    )
  }
  return <SleepGoalForm goal={goal} onClose={onClose} />
}

function SleepGoalForm({ goal, onClose }: { goal: SleepGoal; onClose: () => void }) {
  const [error, setError] = useState(false)
  const { setGoal, pending } = useSleepGoalActions()
  const [targetMinutes, setTargetMinutes] = useState(goal.targetMinutes)
  const [anchor, setAnchor] = useState<'WAKE' | 'BED'>(goal.anchor)
  const [anchorTime, setAnchorTime] = useState(goal.anchorTime)

  const derived = deriveSleepTimes(anchor, anchorTime, targetMinutes)
  const hours = (targetMinutes / 60).toFixed(1)

  const save = (close: () => void) =>
    setGoal({ targetMinutes, anchor, anchorTime, regularityBandMin: goal.regularityBandMin }).then(close).catch(() => setError(true))

  return (
    <Sheet glass onClose={onClose} labelledBy="sleep-goal-title" className="uvl-alvas">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-sleep" eyebrow="Alvás" title="Alvás-cél" titleId="sleep-goal-title" onClose={close} />
          {/* The editor is pre-filled from useSleepGoal(), which ghosts a config default when no
              sleep_goal row exists — so without this line the form looks like it is showing a goal
              the user chose, and "mentés" silently saves the defaults back (mezo-k0hp). */}
          {!goal.isSet && (
            <p className="uvl-note">
              Még nincs saját célod — az alábbi értékek az alapértelmezettek. Igazítsd magadhoz, és mentsd el.
            </p>
          )}

          <span className="uv-eyebrow uvl-center">Cél időtartam</span>
          <div className="uvl-stepper">
            <button type="button" aria-label="Cél csökkentése"
              disabled={targetMinutes <= MIN_TARGET}
              onClick={() => setTargetMinutes((v) => Math.max(MIN_TARGET, v - STEP_MIN))}>−</button>
            <b aria-label="Cél időtartam">{hours}<small> ó</small></b>
            <button type="button" aria-label="Cél növelése"
              disabled={targetMinutes >= MAX_TARGET}
              onClick={() => setTargetMinutes((v) => Math.min(MAX_TARGET, v + STEP_MIN))}>+</button>
          </div>
          <p className="uvl-band"><i aria-hidden="true" />Ajánlott sáv: 7–9 óra alvás</p>

          <span className="uv-eyebrow">Rögzített időpont</span>
          <div className="uvl-chips">
            <button type="button" className={cn('uvl-chip', anchor === 'WAKE' && 'on')} aria-label="Ébredés rögzítése"
              aria-pressed={anchor === 'WAKE'} onClick={() => setAnchor('WAKE')}>
              <Icon3D name="t-dawn" size={20} />Ébredés
            </button>
            <button type="button" className={cn('uvl-chip', anchor === 'BED' && 'on')} aria-label="Lefekvés rögzítése"
              aria-pressed={anchor === 'BED'} onClick={() => setAnchor('BED')}>
              <Icon3D name="t-moon" size={20} />Lefekvés
            </button>
          </div>

          <label className="uvl-cell">
            <span className="uvl-flabel">{anchor === 'WAKE' ? 'Ébredés' : 'Lefekvés'}</span>
            <input type="time" aria-label="Rögzített időpont" value={anchorTime}
              onChange={(e) => e.target.value && setAnchorTime(e.target.value)} />
          </label>

          <span className="uvl-derived">
            {anchor === 'WAKE' ? `Lefekvés ebből: ${derived.bedTime}` : `Ébredés ebből: ${derived.wakeTime}`}
          </span>

          {error && <SheetError>A mentés nem sikerült. A módosításaid megmaradtak, próbáld újra.</SheetError>}
          <button type="button" className="uvl-cta is-wide" disabled={pending} onClick={() => save(close)}>
            <Icon3D name="t-tick" size={20} />Cél mentése
          </button>
        </div>
      )}
    </Sheet>
  )
}
