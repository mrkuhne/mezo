import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Display } from '@/shared/ui/Display'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
import { NumberStep, ScaleRow } from '@/features/train/components/SportLogSheet'
import type { RunSessionLogRequest } from '@/data/train/runningApi'

export function RunLogSheet({ ctx, onClose, onSave }: {
  ctx: { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number }
  onClose: () => void
  // `done` closes the sheet — the parent calls it from the log mutation's onSuccess
  // so the close is deferred until the save lands (and the level-up overlay can show).
  onSave?: (input: RunSessionLogRequest, done: () => void) => void
}) {
  const [rounds, setRounds] = useState(ctx.defaultRounds ?? 6)
  const [rpe, setRpe] = useState(9)
  const [hr, setHr] = useState(45)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const isoToday = new Date().toISOString().slice(0, 10)

  return (
    <Sheet onClose={onClose} labelledBy="run-log-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--info)' }}>Futás log · {ctx.label}</span>
              <div id="run-log-title" style={{ marginTop: 4 }}><Display size="md">Hogy ment?</Display></div>
            </div>
            <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>
          <div className="col gap-md">
            {ctx.isSprint && <NumberStep label="Teljesített körök" val={rounds} step={1} min={0} max={30} onChange={setRounds} color="var(--info)" />}
            <ScaleRow label="RPE · érzékelt nehézség" val={rpe} onChange={setRpe} color="var(--info)" />
            <NumberStep label="Pulzus-megnyugvás · mp" val={hr} step={5} min={0} max={300} onChange={setHr} />
            <div className="col gap-sm">
              <span className="label-mono">Jegyzet</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcionális"
                style={{ background: 'var(--surface-2)', padding: '12px 14px', fontSize: 14, color: 'var(--text-primary)',
                         clipPath: 'polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)' }} />
            </div>
          </div>
          <div className="row gap-sm mt-lg">
            <CtaGhost className="notch-4 flex-1" onClick={close}>Mégse</CtaGhost>
            <CtaPrimary className="notch-4 flex-1" disabled={saving} onClick={() => {
              const body: RunSessionLogRequest = {
                blockId: ctx.blockId, weekNumber: ctx.weekNumber, sessionKey: ctx.sessionKey, date: isoToday,
                completedRounds: ctx.isSprint ? rounds : null, rpeActual: rpe, hrRecoverySec: hr,
                sprintLandmark: null, durationMin: null, notes: notes || null,
              }
              // Defer close to the parent (runs after the log succeeds); close
              // immediately when no handler is wired.
              if (onSave) { setSaving(true); onSave(body, close) } else { close() }
            }}>
              <Icon name="check" size={14} /> Mentés
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
