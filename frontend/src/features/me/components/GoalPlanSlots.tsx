import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRunning } from '@/data/hooks'
import { newDraft } from '@/data/train/runningDraft'
import { AttachPlanSheet, type AttachPlanType } from '@/features/me/sheets/AttachPlanSheet'

// Goal command-center hub-and-spoke slots (G4b, mockup goal-funnel.html Funnel B;
// Mozaik re-face mezo-d20.6.2 → prototype en-body #page-cel's dashed `.gc-slots`
// pair). Rendered UNDER the <GoalTimeline> in GoalsPage. Two always-present
// slots — Mesociklus (gym) + Futóblokk (run) — each offering:
//   ＋ Tervezd        → launch the EXISTING planner (meso: navigate('/train/mesocycles/new');
//                       run: the create-then-navigate idiom — saveRunningBlock(null, newDraft(),
//                       { onSuccess: b => navigate('/train/futas/'+b.id) }) — RunningPage.tsx:62-66).
//   ＋ Csatolj meglévőt → open AttachPlanSheet for that plan type.
// Volleyball is NOT a slot (ambient, read-only — it lives in the timeline band).
// The timeline's gap chips already signal missing coverage, so both slots render
// regardless of current linkage (tile a meso / attach a run anytime).

export function GoalPlanSlots({ goalId }: { goalId: string }) {
  const navigate = useNavigate()
  const { saveRunningBlock } = useRunning()
  const [attach, setAttach] = useState<AttachPlanType | null>(null)

  // Running has no /new route — create a draft block, then navigate to its :id.
  const planRunningBlock = () => {
    const start = new Date().toISOString().slice(0, 10)
    const end = new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10)
    saveRunningBlock(null, newDraft(start, end), { onSuccess: (b) => navigate(`/train/futas/${b.id}`) })
  }

  return (
    <>
      <div className="gc-slots">
        <Slot
          title="Mesociklus"
          caption="gym · az ablakra kalibrálva"
          accent="var(--coral)"
          onPlan={() => navigate('/train/mesocycles/new')}
          onAttach={() => setAttach('mesocycle')}
        />
        <Slot
          title="Futóblokk"
          caption="opcionális · mozog a mesóval"
          accent="var(--sky)"
          onPlan={planRunningBlock}
          onAttach={() => setAttach('running_block')}
        />
      </div>

      {attach && <AttachPlanSheet planType={attach} goalId={goalId} onClose={() => setAttach(null)} />}
    </>
  )
}

function Slot({
  title,
  caption,
  accent,
  onPlan,
  onAttach,
}: {
  title: string
  caption: string
  accent: string
  onPlan: () => void
  onAttach: () => void
}) {
  return (
    <div className="gc-slot">
      <span className="mz-eyebrow" style={{ color: accent }}>{title}</span>
      <span className="gc-slot-cap">{caption}</span>
      <button type="button" className="gc-slot-plan" onClick={onPlan} style={{ color: accent }}>
        ＋ Tervezd ▸
      </button>
      <button type="button" className="gc-slot-attach" onClick={onAttach}>
        ＋ Csatolj meglévőt
      </button>
    </div>
  )
}
