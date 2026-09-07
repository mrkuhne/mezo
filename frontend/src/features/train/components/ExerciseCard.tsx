// ============================================================
// Mezo · ExerciseCard — a mezo-szerkesztő gyakorlat-kártyája (mezo-yty6).
// Az ExerciseAccordionRow utódja az ÚJ szerkesztőben: nincs nyitogatás és
// nincsenek stepper-gombok — szett / rep-ablak / kiinduló súly / RIR / bemelegítő
// mind egyszerre látszik és közvetlenül írható. A régi „Finomhangolás"
// disclosure megszűnt: a RIR a fő sorba került.
// Az ExerciseAccordionRow ÉL TOVÁBB — a futó mezo napi szerkesztőjét
// (MesoExercises → MesoDayPage) az a felület szolgálja ki, ami e körnek non-goalja.
// ============================================================
import { useEffect, useState } from 'react'
import { MUSCLE_LABELS } from '@/data/train/train'
import type { GymExercise } from '@/data/types'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { setStyle } from '@/features/train/logic/setBudget'
import { ClayIcon } from '@/shared/ui/clay'

/** targetRIR values the two style buttons write — mirrors ExerciseAccordionRow's toggle. */
const FAILURE_RIR = 0
const VOLUME_RIR = 2

interface ExerciseCardProps {
  ex: GymExercise
  /** Muscle groups this exercise feeds, for the card's context line. */
  contribution: { label: string; sets: number; color: string }[]
  canMoveUp: boolean
  canMoveDown: boolean
  onChange: (patch: Partial<GymExercise>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

/**
 * A number <input> whose displayed text is buffered in local state rather than
 * mirroring the incoming `value` prop verbatim on every keystroke. This card is
 * purely presentational — `ex` only advances once the caller re-renders with a
 * patched exercise — so a directly-controlled input would have React restore the
 * DOM to the stale prop value right after each native input event (visible as
 * "clear, then type 6" landing on the field's OLD digits with "6" appended,
 * rather than replacing them). Buffering locally and re-syncing only when the
 * external `value` actually changes avoids that revert.
 */
function useBufferedText(value: number | null): [string, (t: string) => void] {
  const [text, setText] = useState(value === null ? '' : String(value))
  useEffect(() => {
    setText(value === null ? '' : String(value))
  }, [value])
  return [text, setText]
}

function NumField({ label, value, min, max, step, placeholder, onCommit }: {
  label: string
  value: number | null
  min: number
  max: number
  step?: number
  placeholder?: string
  onCommit: (v: number | null) => void
}) {
  const [text, setText] = useBufferedText(value)
  return (
    <label className="mz-exc-fld">
      <span>{label}</span>
      <input
        type="number"
        inputMode={step && step < 1 ? 'decimal' : 'numeric'}
        aria-label={label}
        className="mz-exc-num"
        value={text}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          if (raw === '') { onCommit(null); return }
          const n = Number(raw)
          if (Number.isNaN(n)) return
          onCommit(Math.min(max, Math.max(min, n)))
        }}
      />
    </label>
  )
}

// The bounds this card CLAMPS to must match the row it replaced (ExerciseAccordionRow:
// RIR 0–5, reps 1–100) — a narrower cap silently truncates a stored value the moment the
// user touches the field on an existing template (mezo-yty6 final review, minor 8).
const RIR_MAX = 5
const REP_MIN = 1
const REP_MAX = 100

/** Same local-buffer rationale as {@link NumField}; repMin/repMax stay non-null so an emptied field just holds text, uncommitted, until a digit lands. */
function RepBoundInput({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useBufferedText(value)
  return (
    <input
      type="number" inputMode="numeric" aria-label={label} className="mz-exc-num"
      value={text} min={REP_MIN} max={REP_MAX}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        if (raw === '') return
        const n = Number(raw)
        if (Number.isNaN(n)) return
        onCommit(Math.min(REP_MAX, Math.max(REP_MIN, n)))
      }}
    />
  )
}

export function ExerciseCard({
  ex, contribution, canMoveUp, canMoveDown, onChange, onMove, onRemove,
}: ExerciseCardProps) {
  const fam = muscleColor(ex.muscle)
  const isFailure = setStyle(ex.targetRIR) === 'failure'

  return (
    <div className="mz-exc" style={{ background: fam.wash, borderLeftColor: fam.rail }}>
      <div className="mz-exc-head">
        <span className="mz-exc-ico" aria-hidden="true">
          <ClayIcon name="i-suly" size={17} />
        </span>
        <span className="mz-grow" style={{ minWidth: 0 }}>
          <span className="mz-exc-nm">{ex.name}</span>
          <span className="mz-exc-sub">{MUSCLE_LABELS[ex.muscle] ?? ex.muscle}</span>
        </span>
        <span className="mz-exc-mv">
          <button
            type="button"
            aria-label={`${ex.name} feljebb`}
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={`${ex.name} lejjebb`}
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            ▼
          </button>
        </span>
        <button type="button" className="mz-exc-del" aria-label={`${ex.name} törlése`} onClick={onRemove}>
          ✕
        </button>
      </div>

      <div className="mz-exc-row">
        <NumField label="Munkaszettek" value={ex.workingSets} min={1} max={10}
          onCommit={(v) => onChange({ workingSets: v ?? 1 })} />
        <label className="mz-exc-fld mz-exc-reps">
          <span>Rep</span>
          <span className="mz-exc-pair">
            <RepBoundInput
              label="Rep minimum" value={ex.repMin}
              onCommit={(n) => onChange({ repMin: n })}
            />
            <i aria-hidden="true">–</i>
            <RepBoundInput
              label="Rep maximum" value={ex.repMax}
              onCommit={(n) => onChange({ repMax: n })}
            />
          </span>
        </label>
        <NumField label="Kiinduló súly (kg)" value={ex.anchorWeightKg ?? null} min={0} max={500} step={2.5}
          placeholder="auto" onCommit={(v) => onChange({ anchorWeightKg: v })} />
        <NumField label="Cél RIR" value={ex.targetRIR} min={0} max={RIR_MAX}
          onCommit={(v) => onChange({ targetRIR: v ?? 0 })} />
      </div>

      <div className="mz-exc-row2">
        <span className="mz-exc-fv">
          <button
            type="button" aria-pressed={isFailure} className={isFailure ? 'on fire' : undefined}
            onClick={() => onChange({ targetRIR: FAILURE_RIR })}
          >
            🔥 Failure
          </button>
          <button
            type="button" aria-pressed={!isFailure} className={!isFailure ? 'on leaf' : undefined}
            onClick={() => onChange({ targetRIR: VOLUME_RIR })}
          >
            🌿 Volume
          </button>
        </span>
        <NumField label="Bemelegítő szettek" value={ex.warmupSets} min={0} max={5}
          onCommit={(v) => onChange({ warmupSets: v ?? 0 })} />
      </div>

      <div className="mz-exc-ctx">
        Hozzájárulás ·{' '}
        {contribution.map((c) => (
          <b key={c.label} style={{ color: c.color }}>{c.label} +{c.sets}</b>
        ))}
      </div>
    </div>
  )
}
