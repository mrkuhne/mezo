// ============================================================
// Mezo · SportLogSheet — shared volleyball/sport session logger
// Reused by the Mai view, the Sport view, the Nap quick-log and Settings. State is local;
// Mentés hands the captured values to the parent's onSave (T3: logSportSession
// -> POST /api/train/sport-sessions; date/time default to now server-side).
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `SHEETS.sportlog`): a light sheet —
// the sport's glyph + „Sport log · <sport>" over „Hogy ment?", the three sports as pills,
// two stepper rows, the 1–10 scales as rising vessels, the note field, „Mentés" + „Mégse".
// `NumberStep` and `ScaleRow` are this area's sheet rows (also used by the event, schedule
// and run-log sheets).
// ============================================================
import { useId, useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import type { Icon3DName } from '@/shared/ui/clay'
import { FoSheetHead, Lab, Pill, Pills, Scale, SheetActs, Stepper, TextArea } from '@/shared/ui/folyadek'
import type { SportSessionCreateRequest } from '@/data/train/trainApi'
import { useEditableNumber } from '@/features/train/logic/useEditableNumber'
import { SPORT_LABELS, type SportKind } from '@/features/train/logic/sportKinds'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

// This LEGACY sheet's own 3-id vocabulary — the same pin the sibling sheets carry
// (SportScheduleSheet, SportEventSheet). The sport-session WIRE widened to ten ids
// (mezo-88iwa.9), but this sheet's fields are volleyball-shaped (setsPlayed /
// shoulderStrain / rounds and nothing else), so offering Túra here would post a
// `{sport:'hike', rounds}` that describes nothing the athlete actually did. The ten-sport
// vocabulary lives in the full-screen flow (`/train/sport/log`, SportLogPage +
// logic/sports.ts), which asks each sport its own questions; this sheet is scheduled for
// retirement under **mezo-ltqdh** and stays at its original three ids until then.
const LOG_SHEET_SPORT_KINDS = ['volleyball', 'cross', 'trx'] as const

/** The sheet head's glyph per sport (prototype `['t-volley','t-crossfit','t-trx']`). */
const KIND_ICON: Record<string, Icon3DName> = { volleyball: 't-volley', cross: 't-crossfit', trx: 't-trx' }

// --- NumberStep: a stepper row (label + quiet hint on the left, − value + on the right).
// min/max clamp the stepped value to the API contract bounds so the sheets can
// never produce a payload the backend's @Valid rejects with a 400. The value in the
// middle is tap-to-edit (type the value in); the same min/max clamp on blur. It is the
// kit's `Stepper` row with `input` (the typeable value).
export function NumberStep({
  label,
  hint,
  val,
  step,
  onChange,
  min = 0,
  max,
}: {
  label: string
  /** Small quiet line under the label (e.g. what the number honestly means for this kind). */
  hint?: string
  val: number
  step: number
  onChange: (next: number) => void
  min?: number
  max?: number
}) {
  const editable = useEditableNumber({ value: val, onChange, min, max, integer: true })
  return (
    <Stepper label={label} sub={hint || undefined} input={editable}
      onDec={() => onChange(Math.max(min, val - step))}
      onInc={() => onChange(max != null ? Math.min(max, val + step) : val + step)} />
  )
}

// --- ScaleRow: a labelled 1–10 scale (the kit's ten rising vessels, a radio group named by the label) ---
export function ScaleRow({ label, val, onChange }: {
  label: string
  val: number
  onChange: (next: number) => void
}) {
  const id = useId()
  return (
    <div className="es-blk">
      <Lab id={id}>{label}</Lab>
      <Scale value={val} onPick={onChange} aria-labelledby={id} />
    </div>
  )
}

// --- SportLogSheet ---
export function SportLogSheet({ onClose, onSave, initialSport, date }: {
  onClose: () => void
  // `done` closes the sheet — the parent calls it from the log mutation's onSuccess
  // so the close is deferred until the save lands (and the level-up overlay can show).
  onSave?: (input: SportSessionCreateRequest, done: () => void) => void
  /** Pre-selects the kind (a schedule slot's log CTA passes its sport). */
  initialSport?: SportKind
  /** ISO date to log against — omit for today (the server defaults to now, mezo-9bbc). */
  date?: string
}) {
  const [kind, setKind] = useState<SportKind>(initialSport ?? 'volleyball')
  const [duration, setDuration] = useState(90)
  const [sets, setSets] = useState(5)
  const [rounds, setRounds] = useState(6)
  const [rpe, setRpe] = useState(7)
  const [shoulder, setShoulder] = useState(6)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const isVolleyball = kind === 'volleyball'

  return (
    <Sheet onClose={onClose} labelledBy="sport-log-title" className="fo-sheet es-sheet">
      {(close) => (
        <>
          <FoSheetHead titleId="sport-log-title" icon={KIND_ICON[kind] ?? 't-volley'} eyebrow={`Sport log · ${SPORT_LABELS[kind]}`}
            title="Hogy ment?" sub="Az idő, a terhelés és a saját élményed." onClose={close} />

          {/* Kind selector — the sheet's own pinned three ids (see LOG_SHEET_SPORT_KINDS
              above, mezo-ltqdh): the fields below are volleyball-shaped, so the seven
              newer wire ids belong to the full-screen flow, not here. */}
          <Pills role="group" aria-label="Sport típus">
            {LOG_SHEET_SPORT_KINDS.map((k) => (
              <Pill key={k} on={kind === k} onClick={() => setKind(k)}>{SPORT_LABELS[k]}</Pill>
            ))}
          </Pills>

          <div className="es-vl">
            <NumberStep label="Idő · perc" val={duration} step={15} min={15} max={600} onChange={setDuration} />
            {isVolleyball
              ? <NumberStep label="Setek · összesen" val={sets} step={1} max={50} onChange={setSets} />
              : <NumberStep label="Körök · összesen" val={rounds} step={1} min={1} max={50} onChange={setRounds} />}
          </div>
          <ScaleRow label="RPE · összesített nehézség" val={rpe} onChange={setRpe} />
          {isVolleyball && <ScaleRow label="Váll terhelés" val={shoulder} onChange={setShoulder} />}

          {/* Notes — the contract carries `notes` on every SportSessionCreateRequest. */}
          <Lab htmlFor="sport-log-notes">Jegyzet</Lab>
          <VoiceField domain="train" onTranscript={(t) => setNotes((d) => appendDictation(d, t, 500))}>
            <TextArea
              id="sport-log-notes"
              aria-label="Session jegyzet"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Hogy érezted magad, mi ment jól, mi fájt…"
            />
          </VoiceField>

          <SheetActs
            label="Mentés"
            disabled={saving}
            onCancel={close}
            onSave={() => {
              // date/time default to "now" server-side when `date` is omitted — the
              // sheet captures effort only. A retroactive ("Pótold") open passes the
              // past day's ISO date (mezo-9bbc), which the server then logs against
              // instead of today. Volleyball logs sets + shoulder strain; cross/TRX
              // log rounds (per the contract).
              const noteBody = notes.trim() ? { notes: notes.trim() } : {}
              const body: SportSessionCreateRequest = isVolleyball
                ? { sport: 'volleyball', duration, setsPlayed: sets, rpe, shoulderStrain: shoulder, ...(date ? { date } : {}), ...noteBody }
                : { sport: kind, duration, rpe, rounds, ...(date ? { date } : {}), ...noteBody }
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
