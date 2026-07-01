// ============================================================
// Mezo · FeedbackModal — RP-style set-debrief bottom sheet shown after
// the last set of an exercise. Three chip-selector rows (Pump / Joint
// pain / "Akarunk még?"), a skip button and an advance button.
// Ported from prototype train.jsx (FeedbackModal + FeedbackRow); wraps
// the shared Sheet primitive for the slide-up / drag-to-dismiss motion.
// T2: the row values are lifted so the save button can persist them.
// ============================================================
import { useRef, useState } from 'react'
import type { LoggedWorkoutExercise } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'

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
    <div className="col gap-sm">
      <span className="label-mono">{label}</span>
      <div className="row gap-xs">
        {options.map((o, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={value === i}
            className={'chip flex-1 ' + (value === i ? 'brand' : '')}
            style={{ justifyContent: 'center', padding: '10px 6px', fontSize: 11 }}
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
    <Sheet onClose={resolveOnce}>
      {(close) => (
        <>
          <div className="col">
            <Eyebrow brand>Set debrief · RP feedback</Eyebrow>
            <div style={{ marginTop: 6 }}>
              <Display size="md">{ex.name}</Display>
            </div>
          </div>
          <div className="col gap-lg mt-lg">
            <FeedbackRow label="Pump · érzed?" options={['Semmi', 'Enyhe', 'Jó', 'Brutális']} value={pump} onChange={setPump} />
            <FeedbackRow label="Joint pain" options={['Nincs', 'Enyhe', 'Erős']} value={joint} onChange={setJoint} />
            <FeedbackRow label="Akarunk még?" options={['Kevés volt', 'Pont jó', 'Sok volt']} value={workload} onChange={setWorkload} />
          </div>
          <div className="row gap-sm mt-xl">
            <CtaGhost className="notch-4 flex-1" onClick={close}>
              Hagyjuk
            </CtaGhost>
            <CtaPrimary
              className="notch-4 flex-1"
              onClick={() => {
                onSave?.({ pump: pump + 1, jointPain: joint + 1, workload: workload + 1 })
                close()
              }}
            >
              {isLastExercise ? 'Edzés vége →' : 'Mentés · tovább'}
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
