import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useSleepGoal, useSleepGoalActions } from '@/data/hooks'
import { deriveSleepTimes } from '@/data/me/sleepGoal'

const ROW: React.CSSProperties = { justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }
const LABEL: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }
const TIME_INPUT: React.CSSProperties = { background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontVariantNumeric: 'tabular-nums', colorScheme: 'dark' }
const STEP_MIN = 15
const MIN_TARGET = 240
const MAX_TARGET = 720

/** Sleep-goal editor (spec §5): duration stepper + fixed-end toggle + live-derived other end. */
export function SleepGoalSheet({ onClose }: { onClose: () => void }) {
  const { goal } = useSleepGoal()
  const { setGoal, pending } = useSleepGoalActions()
  const [targetMinutes, setTargetMinutes] = useState(goal.targetMinutes)
  const [anchor, setAnchor] = useState<'WAKE' | 'BED'>(goal.anchor)
  const [anchorTime, setAnchorTime] = useState(goal.anchorTime)

  const derived = deriveSleepTimes(anchor, anchorTime, targetMinutes)
  const hours = (targetMinutes / 60).toFixed(1)

  const save = (close: () => void) =>
    setGoal({ targetMinutes, anchor, anchorTime, regularityBandMin: goal.regularityBandMin }).then(close)

  return (
    <Sheet onClose={onClose} labelledBy="sleep-goal-title">
      {(close) => (
        <div className="col gap-sm" style={{ padding: '4px 4px 8px' }}>
          <h2 id="sleep-goal-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            Alvás-cél
          </h2>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Ajánlott sáv: 7–9 óra alvás</span>

          <div className="row" style={ROW}>
            <span style={LABEL}>Cél időtartam</span>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <button type="button" className="chip" aria-label="Cél csökkentése"
                disabled={targetMinutes <= MIN_TARGET}
                onClick={() => setTargetMinutes((v) => Math.max(MIN_TARGET, v - STEP_MIN))}
                style={{ opacity: targetMinutes <= MIN_TARGET ? 0.4 : 1 }}><Icon name="minus" size={12} /></button>
              <span aria-label="Cél időtartam"
                style={{ minWidth: 44, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {hours} ó
              </span>
              <button type="button" className="chip" aria-label="Cél növelése"
                disabled={targetMinutes >= MAX_TARGET}
                onClick={() => setTargetMinutes((v) => Math.min(MAX_TARGET, v + STEP_MIN))}
                style={{ opacity: targetMinutes >= MAX_TARGET ? 0.4 : 1 }}><Icon name="plus" size={12} /></button>
            </div>
          </div>

          <div className="row gap-sm">
            <button type="button" className="chip" aria-label="Ébredés rögzítése" onClick={() => setAnchor('WAKE')}
              style={anchor === 'WAKE'
                ? { background: 'var(--wash-lav)', color: 'var(--lav-deep)', borderColor: 'transparent' }
                : undefined}>
              ☀️ Ébredés
            </button>
            <button type="button" className="chip" aria-label="Lefekvés rögzítése" onClick={() => setAnchor('BED')}
              style={anchor === 'BED'
                ? { background: 'var(--wash-lav)', color: 'var(--lav-deep)', borderColor: 'transparent' }
                : undefined}>
              🛏️ Lefekvés
            </button>
          </div>

          <div className="row" style={ROW}>
            <span style={LABEL}>{anchor === 'WAKE' ? 'Ébredés' : 'Lefekvés'}</span>
            <input type="time" aria-label="Rögzített időpont" value={anchorTime}
              onChange={(e) => e.target.value && setAnchorTime(e.target.value)} style={TIME_INPUT} />
          </div>

          <span style={{ fontSize: 11, color: 'var(--lav-deep)', fontVariantNumeric: 'tabular-nums' }}>
            {anchor === 'WAKE' ? `Lefekvés ebből: ${derived.bedTime}` : `Ébredés ebből: ${derived.wakeTime}`}
          </span>

          <button type="button" className="cta-primary" disabled={pending}
            style={{ opacity: pending ? 0.5 : 1 }} onClick={() => save(close)}>
            <Icon name="check" size={14} /> Cél mentése
          </button>
        </div>
      )}
    </Sheet>
  )
}
