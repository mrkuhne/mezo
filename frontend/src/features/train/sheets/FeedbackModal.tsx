// ============================================================
// Mezo · FeedbackModal — the debrief shown ONCE after the last set of an exercise (not per set): three short
// questions (pumpa / ízületi fájdalom / „Akarunk még?"), „Hagyjuk" and the advance button. The row values are
// lifted so the save button can persist them (1-based scales).
//
// Folyadék F4 (mezo-n4wf5.4, area C; owner, round 1): a light sheet built to the prototype's `rp` sheet
// (docs/design_2.0/prototypes/vilagos/edzes.js). The answers are small VESSELS (`OptionVessels`): each is
// filled to what the answer means, the chosen one in full colour; the pain scale wears ok / warn / bad; the
// third question carries a dashed „pont jó" line across its vessels. One note line says how to read them.
// ============================================================
import { useRef, useState } from 'react'
import type { LoggedWorkoutExercise } from '@/data/types'
import { MUSCLE_LABELS } from '@/data/train/train'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, FoSheetHead, Lab, Lk, Note, OptionVessels, type OptionVessel } from '@/shared/ui/folyadek'
import { Mchp } from '@/features/train/components/folyadek'

/** The level of „Pont jó" — also the dashed line across the third question's vessels. */
const JUST_RIGHT = 64

const PUMP: OptionVessel[] = [{ label: 'Semmi', pct: 5 }, { label: 'Enyhe', pct: 36 }, { label: 'Jó', pct: 68 }, { label: 'Brutális', pct: 100 }]
const PAIN: OptionVessel[] = [
  { label: 'Nincs', pct: 5, color: 'var(--fo-ok)' }, { label: 'Enyhe', pct: 50, color: 'var(--fo-warn)' }, { label: 'Erős', pct: 100, color: 'var(--fo-bad)' },
]
const WORKLOAD: OptionVessel[] = [{ label: 'Kevés volt', pct: 34 }, { label: 'Pont jó', pct: JUST_RIGHT }, { label: 'Sok volt', pct: 100 }]

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
  // Both skip and save (and any Sheet dismissal — backdrop / drag / esc / ×)
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
    <Sheet onClose={resolveOnce} labelledBy="el-debrief-title" className="fo-sheet el-sheet">
      {(close) => (
        <>
          <FoSheetHead
            eyebrow="Gyakorlat kész · hogy ment?" title={ex.name} titleId="el-debrief-title"
            sub={MUSCLE_LABELS[ex.muscle] ?? ex.muscle} left={<Mchp muscle={ex.muscle} />} onClose={close}
          />
          <Lab>Pumpa · érzed?</Lab>
          <OptionVessels aria-label="Pumpa · érzed?" items={PUMP} value={pump} onChange={setPump} />
          <Lab>Ízületi fájdalom</Lab>
          <OptionVessels aria-label="Ízületi fájdalom" items={PAIN} value={joint} onChange={setJoint} />
          <Lab>Akarunk még?</Lab>
          <OptionVessels aria-label="Akarunk még?" items={WORKLOAD} value={workload} onChange={setWorkload} line={JUST_RIGHT} />
          <Note>Az edény annyira telik, amennyit a válasz jelent. A vonal a „pont jó” szint — ebből áll össze a jövő heti szettszám.</Note>
          <Acts>
            <Btn
              grow
              onClick={() => {
                onSave?.({ pump: pump + 1, jointPain: joint + 1, workload: workload + 1 })
                close()
              }}
            >
              {isLastExercise ? 'Edzés vége' : 'Mentés · tovább'}
            </Btn>
            <Lk onClick={close}>Hagyjuk</Lk>
          </Acts>
        </>
      )}
    </Sheet>
  )
}
