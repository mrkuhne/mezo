import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRunning } from '@/data/hooks'
import { newDraft } from '@/data/train/runningDraft'
import { AttachPlanSheet, type AttachPlanType } from '@/features/me/sheets/AttachPlanSheet'

// Goal command-center hub-and-spoke slots (G4b, mockup goal-funnel.html Funnel B).
// Rendered UNDER the <GoalTimeline> in GoalsPage. Two always-present slots —
// Mesociklus (gym) + Futóblokk (run) — each offering:
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
      <div className="col gap-sm">
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
    <div
      className="notch-8"
      style={{
        border: '1px dashed var(--border-strong)',
        background: 'transparent',
        padding: 13,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="col">
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{title}</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>{caption}</span>
        </div>
        <button
          type="button"
          onClick={onPlan}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            color: accent,
          }}
        >
          ＋ Tervezd ▸
        </button>
      </div>
      <div className="mt-sm">
        <button
          type="button"
          onClick={onAttach}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          ＋ Csatolj meglévőt
        </button>
      </div>
    </div>
  )
}
