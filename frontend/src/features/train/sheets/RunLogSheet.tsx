// ============================================================
// Mezo · RunLogSheet — logs one prescribed run. Folyadék (mezo-n4wf5.3, prototype
// vilagos/edzes.js `SHEETS.runlog`): a light sheet — the run glyph + „Futás log · <edzés>"
// over „Hogy ment?", the session's interval tube (when the opener hands its segments over),
// the rounds stepper, the RPE scale as rising vessels, the heart-rate stepper, the note
// field, „Mentés" + „Mégse".
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { FoSheetHead, Input, Lab, SheetActs } from '@/shared/ui/folyadek'
import { NumberStep, ScaleRow } from '@/features/train/sheets/SportLogSheet'
import { IntervalTube } from '@/features/train/components/RunSessionCard'
import type { RunSegment, RunSessionLogRequest } from '@/data/train/runningApi'
import { localDateString } from '@/shared/lib/dates'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

export function RunLogSheet({ ctx, onClose, onSave, date }: {
  /** `segments` (optional) = the prescribed session's own segments, drawn as the interval tube under the head. */
  ctx: { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number; segments?: RunSegment[] }
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
    <Sheet onClose={onClose} labelledBy="run-log-title" className="fo-sheet es-sheet">
      {(close) => (
        <>
          <FoSheetHead titleId="run-log-title" icon="t-run" eyebrow={`Futás log · ${ctx.label}`} title="Hogy ment?" onClose={close} />
          {ctx.segments && ctx.segments.length > 0 && <IntervalTube segments={ctx.segments} />}
          {/* Shown for pyramid sessions TOO (not just sprint) — the designed fix for the
              real completedRounds scoring bug: capture the value honestly on every kind
              and send it, even though the pyramid-aware scoring itself is F6.3 (backend). */}
          <div className="es-vl">
            <NumberStep
              label="Teljesített körök"
              hint={ctx.isSprint ? undefined : 'piramis-szakaszok · a haladás ebből számol'}
              val={rounds} step={1} min={0} max={30} onChange={setRounds}
            />
          </div>
          <ScaleRow label="RPE · érzékelt nehézség" val={rpe} onChange={setRpe} />
          <div className="es-vl es-vl-gap">
            <NumberStep label="Pulzus-megnyugvás · mp" val={hr} step={5} min={0} max={300} onChange={setHr} />
          </div>
          <Lab htmlFor="run-log-notes">Jegyzet</Lab>
          <VoiceField domain="train" size="sm" onTranscript={(t) => setNotes((d) => appendDictation(d, t))}>
            <Input id="run-log-notes" aria-label="Futás jegyzet" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcionális" />
          </VoiceField>
          <SheetActs
            label="Mentés"
            disabled={saving}
            onCancel={close}
            onSave={() => {
              const body: RunSessionLogRequest = {
                blockId: ctx.blockId, weekNumber: ctx.weekNumber, sessionKey: ctx.sessionKey, date: logDate,
                completedRounds: rounds, rpeActual: rpe, hrRecoverySec: hr,
                sprintLandmark: null, durationMin: null, notes: notes || null,
              }
              // Defer close to the parent (runs after the log succeeds); close
              // immediately when no handler is wired.
              if (onSave) { setSaving(true); onSave(body, close) } else { close() }
            }}
          />
        </>
      )}
    </Sheet>
  )
}
