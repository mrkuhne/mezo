// ============================================================
// Mezo · FeedbackModal — RP-style set-debrief bottom sheet shown after
// the last set of an exercise. Three chip-selector rows (Pump / Joint
// pain / "Akarunk még?"), a skip button and an advance button.
// Ported from prototype train.jsx (FeedbackModal + FeedbackRow); wraps
// the shared Sheet primitive for the slide-up / drag-to-dismiss motion.
// T2: the row values are lifted so the save button can persist them.
// Üvegesítés U4 (mezo-me75u.4): a floating coral glass sheet (bible rule 15) with the muscle in
// a lit well; the options are flat pills (the chosen one lit), "Hagyjuk" is a flat pill and the
// save a lit flat pill. Skin: `.wos-sheet` in the `uveg edzes session` block.
// ============================================================
import { useRef, useState } from 'react'
import type { LoggedWorkoutExercise } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { MuscleChip } from '@/features/train/components/MuscleChip'

function FeedbackRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: number
  onChange: (idx: number) => void
}) {
  return (
    <div className="wos-choice">
      <span className="wos-choice-q">{label}</span>
      <div className="wos-choice-opts">
        {options.map((o, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={value === i}
            className={value === i ? 'wos-pill is-on' : 'wos-pill'}
            onClick={() => onChange(i)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface ExerciseFeedbackValues {
  pump: number // 1–4
  jointPain: number // 1–3
  workload: number // 1–3
}

export function FeedbackModal({
  ex,
  isLastExercise,
  onResolve,
  onSave,
}: {
  ex: LoggedWorkoutExercise
  isLastExercise: boolean
  // Both skip and save (and any Sheet dismissal — backdrop / drag / esc)
  // resolve the same way: advance the workout. Feedback is non-blocking;
  // only the explicit save button persists (onSave fires with 1-based scales).
  onResolve: () => void
  onSave?: (values: ExerciseFeedbackValues) => void
}) {
  const [pump, setPump] = useState(2)
  const [joint, setJoint] = useState(0)
  const [workload, setWorkload] = useState(1)
  // The Sheet fires onClose once its slide-down finishes. We also let the
  // in-sheet buttons trigger that same animated close. Guard so the resolve
  // callback runs exactly once regardless of which path closed the sheet.
  const resolved = useRef(false)
  const resolveOnce = () => {
    if (resolved.current) return
    resolved.current = true
    onResolve()
  }

  return (
    <Sheet onClose={resolveOnce} className="glass wos-sheet">
      {(close) => (
        <>
          <div className="wos-sheet-head">
            <span className="wos-sheet-art"><MuscleChip token={ex.muscle} size={48} /></span>
            <span className="wos-sheet-title">
              <span className="wos-sheet-eb">Set debrief · RP feedback</span>
              <h3>{ex.name}</h3>
            </span>
          </div>
          <div className="wos-choices">
            <FeedbackRow label="Pump · érzed?" options={['Semmi', 'Enyhe', 'Jó', 'Brutális']} value={pump} onChange={setPump} />
            <FeedbackRow label="Joint pain" options={['Nincs', 'Enyhe', 'Erős']} value={joint} onChange={setJoint} />
            <FeedbackRow label="Akarunk még?" options={['Kevés volt', 'Pont jó', 'Sok volt']} value={workload} onChange={setWorkload} />
          </div>
          <div className="wos-sheet-two">
            <button type="button" className="wos-pill is-block" onClick={close}>
              Hagyjuk
            </button>
            <button
              type="button"
              className="wos-primary"
              onClick={() => {
                onSave?.({ pump: pump + 1, jointPain: joint + 1, workload: workload + 1 })
                close()
              }}
            >
              {isLastExercise ? 'Edzés vége →' : 'Mentés · tovább'}
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
