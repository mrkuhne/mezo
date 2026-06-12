// ============================================================
// Mezo · SportLogSheet — shared volleyball/sport session logger
// Reused by the Mai view and the Sport view. State is local; Mentés
// hands the captured values to the parent's onSave (T3: logSportSession
// -> POST /api/train/sport-sessions; date/time default to now server-side).
// Ported from prototype sport.jsx: SportLogSheet + NumberStep + ScaleRow.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Display } from '@/components/ui/Display'
import { CtaPrimary, CtaGhost } from '@/components/ui/Cta'
import type { SportSessionCreateRequest } from '@/lib/trainApi'

// --- NumberStep: label + mono value + 44px ± buttons (reuses .stepper) ---
export function NumberStep({
  label,
  val,
  step,
  onChange,
  color,
}: {
  label: string
  val: number
  step: number
  onChange: (next: number) => void
  color?: string
}) {
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
      <div className="stepper notch-4">
        <button
          type="button"
          aria-label={`${label} csökkentése`}
          onClick={() => onChange(Math.max(0, val - step))}
        >
          <Icon name="minus" size={14} />
        </button>
        <span className="stepper-display">{val}</span>
        <button
          type="button"
          aria-label={`${label} növelése`}
          onClick={() => onChange(val + step)}
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
export function SportLogSheet({ onClose, onSave }: {
  onClose: () => void
  onSave?: (input: SportSessionCreateRequest) => void
}) {
  const [duration, setDuration] = useState(90)
  const [sets, setSets] = useState(5)
  const [rpe, setRpe] = useState(7)
  const [shoulder, setShoulder] = useState(6)

  return (
    <Sheet onClose={onClose} labelledBy="sport-log-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--cat-tendency)' }}>
                Sport log · Volleyball
              </span>
              <div id="sport-log-title" style={{ marginTop: 4 }}>
                <Display size="md">Hogy ment?</Display>
              </div>
            </div>
            <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Fields */}
          <div className="col gap-md">
            <NumberStep label="Idő · perc" val={duration} step={15} onChange={setDuration} />
            <NumberStep label="Setek · összesen" val={sets} step={1} onChange={setSets} />
            <ScaleRow label="RPE · összesített nehézség" val={rpe} onChange={setRpe} color="var(--brand-glow)" />
            <ScaleRow
              label="Váll terhelés"
              val={shoulder}
              onChange={setShoulder}
              color={shoulder >= 7 ? 'var(--warning)' : 'var(--text-secondary)'}
            />
          </div>

          {/* Mezo observation */}
          <div className="card notch-4 mt-lg" style={{ padding: 12, background: 'rgba(94, 234, 212, 0.03)' }}>
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

          {/* Footer */}
          <div className="row gap-sm mt-lg">
            <CtaGhost className="notch-4 flex-1" onClick={close}>
              Mégse
            </CtaGhost>
            <CtaPrimary
              className="notch-4 flex-1"
              onClick={() => {
                // date/time default to "now" server-side — the sheet captures effort only.
                onSave?.({ duration, setsPlayed: sets, rpe, shoulderStrain: shoulder })
                close()
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
