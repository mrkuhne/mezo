import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { LabelMono } from '@/shared/ui/LabelMono'
import { Icon } from '@/shared/ui/Icon'
import { useGoal, useGoalActions, useTrain, useRunning } from '@/data/hooks'

// Attach-an-existing-plan picker (G4b hub). Opened from a GoalPlanSlots "＋ Csatolj
// meglévőt" CTA for a given plan type. Lists the user's owned mesocycles
// (`useTrain().mesocycles`) or running blocks (`useRunning().runningBlocks`),
// EXCLUDING plans already linked to the goal (their id appears in
// timeline.links[].planId for that type — don't offer a duplicate attach). The
// user picks one + a start-week (1..timeline.weeks) and confirms → attachPlan(
// goalId, { planType, planId, startWeek }) → on success the sheet closes.

export type AttachPlanType = 'mesocycle' | 'running_block'

const TITLE: Record<AttachPlanType, string> = {
  mesocycle: 'Mesociklus csatolása',
  running_block: 'Futóblokk csatolása',
}

type Candidate = { id: string; title: string; weeks: number; status: string }

export function AttachPlanSheet({
  planType,
  goalId,
  onClose,
}: {
  planType: AttachPlanType
  goalId: string
  onClose: () => void
}) {
  const { timeline } = useGoal()
  const { mesocycles } = useTrain()
  const { runningBlocks } = useRunning()
  const { attachPlan, pending } = useGoalActions()

  // Plans of this type already linked to the goal — exclude them from the picker.
  const linkedIds = new Set(
    (timeline?.links ?? []).filter((l) => l.planType === planType).map((l) => l.planId),
  )

  const all: Candidate[] =
    planType === 'mesocycle'
      ? mesocycles.map((m) => ({ id: m.id, title: m.shortTitle || m.title, weeks: m.weeks, status: m.status }))
      : runningBlocks.map((b) => ({ id: b.id, title: b.title, weeks: b.weeks, status: b.status }))
  const candidates = all.filter((c) => !linkedIds.has(c.id))

  const maxWeek = timeline?.weeks ?? 1
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [startWeek, setStartWeek] = useState(1)

  return (
    <Sheet onClose={onClose} labelledBy="attach-plan-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <Eyebrow brand>Csatolj meglévőt</Eyebrow>
              <div id="attach-plan-title"><Display size="md">{TITLE[planType]}</Display></div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close}><Icon name="x" size={12} /></button>
          </div>

          {candidates.length === 0 ? (
            <p className="text-tertiary" style={{ fontSize: 12, fontStyle: 'italic', lineHeight: 1.5 }}>
              Nincs csatolható terv — minden meglévő már a cél alatt fut, vagy még nincs ilyen terved.
            </p>
          ) : (
            <>
              <div className="col gap-sm">
                <LabelMono>Válassz tervet</LabelMono>
                {candidates.map((c) => {
                  const active = c.id === selectedId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedId(c.id)}
                      className="card notch-4"
                      style={{
                        padding: '11px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderColor: active ? 'var(--border-brand)' : 'var(--border-subtle)',
                        background: active ? 'rgba(94, 234, 212, 0.06)' : 'var(--surface-1)',
                      }}
                    >
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.title}</span>
                        <span
                          className="label-mono"
                          style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
                        >
                          {c.weeks} hét
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="col gap-sm mt-lg">
                <LabelMono>Kezdő hét</LabelMono>
                <input
                  type="number"
                  aria-label="Kezdő hét"
                  min={1}
                  max={maxWeek}
                  value={startWeek}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setStartWeek(Number.isNaN(n) ? 1 : Math.min(maxWeek, Math.max(1, n)))
                  }}
                  className="card notch-4"
                  style={{
                    padding: '11px 14px',
                    fontFamily: 'var(--ff-mono)',
                    fontSize: 14,
                    color: 'var(--text-primary)',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-subtle)',
                    width: 96,
                  }}
                />
              </div>

              <div className="row gap-sm mt-lg">
                <button className="cta-ghost notch-4 flex-1" onClick={close}>Mégse</button>
                <button
                  type="button"
                  className="cta-primary notch-4 flex-1"
                  disabled={!selectedId || pending}
                  onClick={() => {
                    if (!selectedId) return
                    attachPlan(goalId, { planType, planId: selectedId, startWeek }).then(close)
                  }}
                >
                  <Icon name="check" size={14} /> Csatolás
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
