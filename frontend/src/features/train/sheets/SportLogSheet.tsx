// ============================================================
// Mezo · SportLogSheet — shared volleyball/sport session logger
// Reused by the Mai view and the Sport view. State is local; Mentés
// hands the captured values to the parent's onSave (T3: logSportSession
// -> POST /api/train/sport-sessions; date/time default to now server-side).
// Ported from prototype sport.jsx: SportLogSheet + NumberStep + ScaleRow.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Display } from '@/shared/ui/Display'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
import type { SportSessionCreateRequest } from '@/data/train/trainApi'
import { useEditableNumber } from '@/features/train/logic/useEditableNumber'
import { SPORT_KINDS, SPORT_LABELS, type SportKind } from '@/features/train/logic/sportKinds'

// --- NumberStep: label + mono value + 44px ± buttons (reuses .stepper) ---
// min/max clamp the stepped value to the API contract bounds so the sheets can
// never produce a payload the backend's @Valid rejects with a 400. The center
// display is tap-to-edit (type the value in); the same min/max clamp on blur.
export function NumberStep({
  label,
  val,
  step,
  onChange,
  color,
  min = 0,
  max,
}: {
  label: string
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
        <span className="label-mono">{label}</span>
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
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>
            /10
          </span>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label} ${n}`}
            aria-pressed={val === n}
            onClick={() => onChange(n)}
            style={{
              minHeight: 44,
              padding: '8px 0',
              background: val === n ? color : val >= n ? `color-mix(in srgb, ${color} 20%, transparent)` : 'var(--surface-2)',
              border: '1px solid ' + (val === n ? color : 'var(--border-subtle)'),
              color: val === n ? 'var(--text-inverse)' : val >= n ? color : 'var(--text-tertiary)',
              fontFamily: 'var(--ff-display)',
              fontSize: 11,
              fontWeight: 600,
              clipPath: 'polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px)',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

// --- SportLogSheet ---
export function SportLogSheet({ onClose, onSave, initialSport }: {
  onClose: () => void
  // `done` closes the sheet — the parent calls it from the log mutation's onSuccess
  // so the close is deferred until the save lands (and the level-up overlay can show).
  onSave?: (input: SportSessionCreateRequest, done: () => void) => void
  /** Pre-selects the kind (a schedule slot's log CTA passes its sport). */
  initialSport?: SportKind
}) {
  const [kind, setKind] = useState<SportKind>(initialSport ?? 'volleyball')
  const [duration, setDuration] = useState(90)
  const [sets, setSets] = useState(5)
  const [rounds, setRounds] = useState(6)
  const [rpe, setRpe] = useState(7)
  const [shoulder, setShoulder] = useState(6)
  const [saving, setSaving] = useState(false)
  const isVolleyball = kind === 'volleyball'

  return (
    <Sheet onClose={onClose} labelledBy="sport-log-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--rose)' }}>
                Sport log · {SPORT_LABELS[kind]}
              </span>
              <div id="sport-log-title" style={{ marginTop: 4 }}>
                <Display size="md">Hogy ment?</Display>
              </div>
            </div>
            <button className="chip" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Kind selector — volleyball | cross | trx */}
          <div className="row gap-xs" role="group" aria-label="Sport típus" style={{ marginBottom: 14 }}>
            {SPORT_KINDS.map((k) => {
              const active = kind === k
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKind(k)}
                  className="flex-1 rad-12"
                  style={{
                    padding: '10px',
                    background: active ? 'color-mix(in srgb, var(--rose) 8%, transparent)' : 'var(--surface-1)',
                    border: `1px solid ${active ? 'color-mix(in srgb, var(--rose) 40%, transparent)' : 'var(--border-subtle)'}`,
                    color: active ? 'var(--rose)' : 'var(--text-secondary)',
                    fontFamily: 'var(--ff-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
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
            <ScaleRow label="RPE · összesített nehézség" val={rpe} onChange={setRpe} color="var(--brand-glow)" />
            {isVolleyball && (
              <ScaleRow
                label="Váll terhelés"
                val={shoulder}
                onChange={setShoulder}
                color={shoulder >= 7 ? 'var(--warning)' : 'var(--text-secondary)'}
              />
            )}
          </div>

          {/* Mezo observation (volleyball-specific copy) */}
          {isVolleyball && (
            <div className="card mt-lg" style={{ padding: 12, background: 'color-mix(in srgb, var(--rose) 3%, transparent)' }}>
              <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                <Icon name="sparkle" size={11} color="var(--brand-glow)" />
                <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-primary)', flex: 1 }}>
                  {shoulder >= 7 && 'Váll terhelés magas — Overhead Press helyett Cable variánssal a következő Push Day-en. '}
                  {rpe >= 7.5 && 'Magas RPE · ma 21:30 előtt vacsorát zárjuk az alvás-impact miatt. '}
                  {rpe >= 8 && 'Kemény session — holnap a Pull Day intenzitását RIR 2-re lazítsuk. '}
                  {shoulder < 7 && rpe < 7.5 && 'Beírtam · ez egy átlagos session a heti ritmusodhoz képest. Jó volt.'}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="row gap-sm mt-lg">
            <CtaGhost className="flex-1" onClick={close}>
              Mégse
            </CtaGhost>
            <CtaPrimary
              className="flex-1"
              disabled={saving}
              onClick={() => {
                // date/time default to "now" server-side — the sheet captures effort only.
                // Volleyball logs sets + shoulder strain; cross/TRX log rounds (per the contract).
                const body: SportSessionCreateRequest = isVolleyball
                  ? { sport: 'volleyball', duration, setsPlayed: sets, rpe, shoulderStrain: shoulder }
                  : { sport: kind, duration, rpe, rounds }
                // Defer close to the parent (runs after the log succeeds); close
                // immediately when no handler is wired.
                if (onSave) { setSaving(true); onSave(body, close) } else { close() }
              }}
            >
              <Icon name="check" size={14} /> Mentés
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
