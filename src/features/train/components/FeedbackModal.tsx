// ============================================================
// Mezo · FeedbackModal — RP-style set-debrief bottom sheet shown after
// the last set of an exercise. Three chip-selector rows (Pump / Joint
// pain / "Akarunk még?"), a skip button and an advance button.
// Ported from prototype train.jsx (FeedbackModal + FeedbackRow); wraps
// the shared Sheet primitive for the slide-up / drag-to-dismiss motion.
// ============================================================
import { useRef, useState } from 'react'
import type { LoggedWorkoutExercise } from '@/data/types'
import { Sheet } from '@/components/ui/Sheet'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'
import { CtaPrimary, CtaGhost } from '@/components/ui/Cta'

function FeedbackRow({
  label,
  options,
  defaultIdx,
}: {
  label: string
  options: string[]
  defaultIdx: number
}) {
  const [sel, setSel] = useState(defaultIdx)
  return (
    <div className="col gap-sm">
      <span className="label-mono">{label}</span>
      <div className="row gap-xs">
        {options.map((o, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={sel === i}
            className={'chip flex-1 ' + (sel === i ? 'brand' : '')}
            style={{ justifyContent: 'center', padding: '10px 6px', fontSize: 11 }}
            onClick={() => setSel(i)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

export function FeedbackModal({
  ex,
  isLastExercise,
  onResolve,
}: {
  ex: LoggedWorkoutExercise
  isLastExercise: boolean
  // Both skip and save (and any Sheet dismissal — backdrop / drag / esc)
  // resolve the same way: advance the workout. Feedback is non-blocking.
  onResolve: () => void
}) {
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
            <FeedbackRow label="Pump · érzed?" options={['Semmi', 'Enyhe', 'Jó', 'Brutális']} defaultIdx={2} />
            <FeedbackRow label="Joint pain" options={['Nincs', 'Enyhe', 'Erős']} defaultIdx={0} />
            <FeedbackRow label="Akarunk még?" options={['Kevés volt', 'Pont jó', 'Sok volt']} defaultIdx={1} />
          </div>
          <div className="row gap-sm mt-xl">
            <CtaGhost className="notch-4 flex-1" onClick={close}>
              Hagyjuk
            </CtaGhost>
            <CtaPrimary className="notch-4 flex-1" onClick={close}>
              {isLastExercise ? 'Edzés vége →' : 'Mentés · tovább'}
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
