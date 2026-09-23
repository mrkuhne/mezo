// ============================================================
// Mezo · SportLogSheet — shared volleyball/sport session logger
// Reused by the Mai view and the Sport view. State is local; Mentés
// hands the captured values to the parent's onSave (T3: logSportSession
// -> POST /api/train/sport-sessions; date/time default to now server-side).
// Ported from prototype sport.jsx: SportLogSheet + NumberStep + ScaleRow.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'
import { CaptureHeader } from '@/shared/ui/CaptureHeader'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
import type { SportSessionCreateRequest } from '@/data/train/trainApi'
import { useEditableNumber } from '@/features/train/logic/useEditableNumber'
import { SPORT_LABELS, type SportKind } from '@/features/train/logic/sportKinds'

// This LEGACY sheet's own 3-id vocabulary — the same pin the sibling sheets carry
// (SportScheduleSheet, SportEventSheet). The sport-session WIRE widened to ten ids
// (mezo-88iwa.9), but this sheet's fields are volleyball-shaped (setsPlayed /
// shoulderStrain / rounds and nothing else), so offering Túra here would post a
// `{sport:'hike', rounds}` that describes nothing the athlete actually did. The ten-sport
// vocabulary lives in the full-screen flow (`/train/sport/log`, SportLogPage +
// logic/sports.ts), which asks each sport its own questions; this sheet is scheduled for
// retirement under **mezo-ltqdh** and stays at its original three ids until then.
const LOG_SHEET_SPORT_KINDS = ['volleyball', 'cross', 'trx'] as const

// --- NumberStep: label + mono value + 44px ± buttons (reuses .stepper) ---
// min/max clamp the stepped value to the API contract bounds so the sheets can
// never produce a payload the backend's @Valid rejects with a 400. The center
// display is tap-to-edit (type the value in); the same min/max clamp on blur.
export function NumberStep({
  label,
  hint,
  val,
  step,
  onChange,
  color,
  min = 0,
  max,
}: {
  label: string
  /** Small tertiary sub-label under the main label (e.g. what the number honestly means for this kind). */
  hint?: string
  val: number
  step: number
  onChange: (next: number) => void
  color?: string
  min?: number
  max?: number
}) {
  const editable = useEditableNumber({ value: val, onChange, min, max, integer: true })
  return (
    <div className="col gap-sm">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label-mono">
          {label}
          {hint && <span className="text-tertiary" style={{ fontWeight: 400, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>{hint}</span>}
        </span>
        <span
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 22,
            fontWeight: 600,
            color: color ?? 'var(--text-primary)',
            lineHeight: 1,
          }}
        >
          {val}
        </span>
      </div>
      <div className="stepper rad-12">
        <button
          type="button"
          aria-label={`${label} csökkentése`}
          onClick={() => onChange(Math.max(min, val - step))}
        >
          <Icon name="minus" size={14} />
        </button>
        <input
          {...editable}
          aria-label={label}
          className="stepper-display"
          style={{ border: 'none', background: 'transparent', width: '100%', minWidth: 0, padding: 0 }}
        />
        <button
          type="button"
          aria-label={`${label} növelése`}
          onClick={() => onChange(max != null ? Math.min(max, val + step) : val + step)}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  )
}

// --- ScaleRow: label + 1-10 grid of cells (active = colour fill) ---
const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export function ScaleRow({
  label,
  val,
  onChange,
  color,
}: {
  label: string
  val: number
  onChange: (next: number) => void
  color: string
}) {
  return (
    <div className="col gap-sm">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label-mono">{label}</span>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color, lineHeight: 1 }}>
          {val}
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>
            /10
          </span>
        </span>
      </div>
      <div className="capture-rating-scale" style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label} ${n}`}
            aria-pressed={val === n}
            onClick={() => onChange(n)}
            className="capture-scale-cell"
            data-state={val === n ? 'active' : val >= n ? 'filled' : undefined}
            style={{ '--cell-hue': color } as CSSProperties}
          >
            {n}
          </button>
        ))}
      </div>
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
    <Sheet onClose={onClose} labelledBy="sport-log-title" className="capture-sheet capture-tone-sport glass">
      {(close) => (
        <>
          <CaptureHeader id="sport-log-title" title="Hogy ment?" eyebrow={`Sport log · ${SPORT_LABELS[kind]}`}
            subtitle="Az idő, a terhelés és a saját élményed." kind="sport" onClose={close} />

          {/* Kind selector — the sheet's own pinned three ids (see LOG_SHEET_SPORT_KINDS
              above, mezo-ltqdh): the fields below are volleyball-shaped, so the seven
              newer wire ids belong to the full-screen flow, not here. */}
          <div className="row capture-segs" role="group" aria-label="Sport típus">
            {LOG_SHEET_SPORT_KINDS.map((k) => {
              const active = kind === k
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKind(k)}
                  className="capture-seg"
                >
                  {SPORT_LABELS[k]}
                </button>
              )
            })}
          </div>

          {/* Fields */}
          <div className="col gap-md">
            <NumberStep label="Idő · perc" val={duration} step={15} min={15} max={600} onChange={setDuration} />
            {isVolleyball
              ? <NumberStep label="Setek · összesen" val={sets} step={1} max={50} onChange={setSets} />
              : <NumberStep label="Körök · összesen" val={rounds} step={1} min={1} max={50} onChange={setRounds} />}
            <ScaleRow label="RPE · összesített nehézség" val={rpe} onChange={setRpe} color="var(--dv-coral)" />
            {isVolleyball && (
              <ScaleRow
                label="Váll terhelés"
                val={shoulder}
                onChange={setShoulder}
                color={shoulder >= 7 ? 'var(--warning)' : 'var(--text-secondary)'}
              />
            )}
            {/* Notes — the contract carries `notes` on every SportSessionCreateRequest,
                but no sheet ever surfaced it before this designed addition. */}
            <div className="col gap-sm">
              <span className="label-mono">Jegyzet</span>
              <textarea
                aria-label="Session jegyzet"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Hogy érezted magad, mi ment jól, mi fájt…"
                style={{
                  width: '100%',
                  fontSize: 13,
                  lineHeight: 1.5,
                  padding: '10px 12px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="capture-actions">
            <CtaGhost className="flex-1" onClick={close}>
              Mégse
            </CtaGhost>
            <CtaPrimary
              className="capture-save flex-1"
              disabled={saving}
              onClick={() => {
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
            >
              <Icon3D name="t-tick" size={22} /> Mentés
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
