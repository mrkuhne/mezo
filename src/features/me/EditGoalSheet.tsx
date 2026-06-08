import { Sheet } from '@/components/ui/Sheet'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'
import { LabelMono } from '@/components/ui/LabelMono'
import { Icon } from '@/components/ui/Icon'
import { FieldRow } from './components/FieldRow'
import type { Goal } from '@/data/types'

export function EditGoalSheet({ onClose, goal }: { onClose: () => void; goal: Goal }) {
  return (
    <Sheet onClose={onClose} labelledBy="edit-goal-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <Eyebrow brand>Cél szerkesztés</Eyebrow>
              <div id="edit-goal-title"><Display size="md">{goal.title}</Display></div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close}><Icon name="x" size={12} /></button>
          </div>

          <div className="col gap-md">
            <FieldRow label="Típus" val="Fogyás · cut" />
            <FieldRow label="Start súly" val={`${goal.startWeight} kg`} />
            <FieldRow label="Cél súly" val={`${goal.targetWeight} kg`} />
            <FieldRow label="Heti tempó" val={`${goal.rateTarget.value} ${goal.rateTarget.unit}`} />
            <FieldRow label="Határidő" val={goal.targetDate} />

            <div className="col gap-sm mt-md">
              <LabelMono>Identity frame</LabelMono>
              <div className="card notch-4" style={{ padding: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{goal.identityFrame}"
                </p>
              </div>
            </div>
          </div>

          <div className="row gap-sm mt-lg">
            <button className="cta-ghost notch-4 flex-1" onClick={close}>Mégse</button>
            <button className="cta-primary notch-4 flex-1" onClick={close}>
              <Icon name="check" size={14} /> Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
