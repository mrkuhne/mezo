// ============================================================
// Mezo · RunLogSheet — logs one prescribed run. Üveg re-dress (mezo-me75u.4,
// prototype uveg-edzes-body.html `SH.runlog`): the shared floating capture sheet
// (one sky glass surface, bible U2 rule 15) with the capture header anatomy
// (centred eyebrow · close, the 68px 3D run art + title), flat steppers/scale/field
// inside, Mégse flat and Mentés the one lit primary. The capture header is written
// out here (same classes as CaptureHeader) because the shared CaptureArt set has no
// run kind.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
import { NumberStep, ScaleRow } from '@/features/train/sheets/SportLogSheet'
import type { RunSessionLogRequest } from '@/data/train/runningApi'
import { localDateString } from '@/shared/lib/dates'

export function RunLogSheet({ ctx, onClose, onSave, date }: {
  ctx: { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number }
  onClose: () => void
  // `done` closes the sheet — the parent calls it from the log mutation's onSuccess
  // so the close is deferred until the save lands (and the level-up overlay can show).
  onSave?: (input: RunSessionLogRequest, done: () => void) => void
  /** ISO date to log against — defaults to today (local, not UTC; mezo-9bbc). */
  date?: string
}) {
  const [rounds, setRounds] = useState(ctx.defaultRounds ?? 6)
  const [rpe, setRpe] = useState(9)
  const [hr, setHr] = useState(45)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  // `date` is required by the contract (no server-side default for running, unlike
  // sport) — a retroactive ("Pótold") open passes the past day's ISO date; today
  // uses `localDateString()`, NOT `toISOString().slice(0, 10)` (that shifts the
  // date before ~02:00 local time in CET, mis-logging a late/early run — mezo-9bbc).
  const logDate = date ?? localDateString()

  return (
    <Sheet onClose={onClose} labelledBy="run-log-title" className="capture-sheet capture-tone-run glass">
      {(close) => (
        <>
          <header className="capture-header">
            <div className="capture-toolbar">
              <span />
              <span className="capture-eyebrow">Futás log · {ctx.label}</span>
              <button type="button" className="capture-dismiss" onClick={close} aria-label="Bezárás"><Icon name="x" size={18} /></button>
            </div>
            <div className="capture-heading">
              <Icon3D name="t-run" size={68} className="capture-art" />
              <div><h2 id="run-log-title">Hogy ment?</h2></div>
            </div>
          </header>
          <div className="col gap-md">
            {/* Shown for pyramid sessions TOO (not just sprint) — the designed fix for the
                real completedRounds scoring bug: capture the value honestly on every kind
                and send it, even though the pyramid-aware scoring itself is F6.3 (backend). */}
            <NumberStep
              label="Teljesített körök"
              hint={ctx.isSprint ? undefined : 'piramis-szakaszok · a haladás ebből számol'}
              val={rounds} step={1} min={0} max={30} onChange={setRounds} color="var(--dv-sky)"
            />
            <ScaleRow label="RPE · érzékelt nehézség" val={rpe} onChange={setRpe} color="var(--dv-sky)" />
            <NumberStep label="Pulzus-megnyugvás · mp" val={hr} step={5} min={0} max={300} onChange={setHr} />
            <div className="col gap-sm">
              <span className="label-mono">Jegyzet</span>
              <input className="uvs-inp" aria-label="Futás jegyzet" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcionális" />
            </div>
          </div>
          <div className="capture-actions">
            <CtaGhost className="flex-1" onClick={close}>Mégse</CtaGhost>
            <CtaPrimary className="capture-save flex-1" disabled={saving} onClick={() => {
              const body: RunSessionLogRequest = {
                blockId: ctx.blockId, weekNumber: ctx.weekNumber, sessionKey: ctx.sessionKey, date: logDate,
                completedRounds: rounds, rpeActual: rpe, hrRecoverySec: hr,
                sprintLandmark: null, durationMin: null, notes: notes || null,
              }
              // Defer close to the parent (runs after the log succeeds); close
              // immediately when no handler is wired.
              if (onSave) { setSaving(true); onSave(body, close) } else { close() }
            }}>
              <Icon3D name="t-tick" size={22} /> Mentés
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
