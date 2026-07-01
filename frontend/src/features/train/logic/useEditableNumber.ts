import { useState } from 'react'
import type { ChangeEvent, FocusEvent } from 'react'

// ============================================================
// Mezo · useEditableNumber — makes a stepper's value tap-to-edit.
// Returns props to spread onto an <input> so the central display of a
// CompactStepper / NumberStep accepts free keyboard entry (incl. the HU
// decimal comma), then commits + clamps on blur. The ± buttons keep their
// own step semantics and call onChange directly — this only adds typing.
// Exact typed values are honored (weightKg has no multipleOf in the API);
// decimals round to 1 place to match the stepper's toFixed(1).
// ============================================================
interface EditableNumberOpts {
  value: number
  onChange: (next: number) => void
  /** Lower clamp applied on blur (default 0). */
  min?: number
  /** Upper clamp applied on blur (omit for no ceiling). */
  max?: number
  /** Integer field (reps/duration/…): parse as int, numeric keyboard. */
  integer?: boolean
}

export function useEditableNumber({ value, onChange, min = 0, max, integer = false }: EditableNumberOpts) {
  // null = not editing → mirror the committed value; string = live draft.
  const [draft, setDraft] = useState<string | null>(null)

  return {
    value: draft ?? String(value),
    inputMode: integer ? ('numeric' as const) : ('decimal' as const),
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
      setDraft(String(value))
      e.currentTarget.select()
    },
    onChange: (e: ChangeEvent<HTMLInputElement>) => setDraft(e.currentTarget.value),
    onBlur: () => {
      if (draft === null) return
      const raw = draft.replace(',', '.')
      const parsed = integer ? parseInt(raw, 10) : parseFloat(raw)
      setDraft(null)
      if (Number.isNaN(parsed)) return // empty / garbage → revert to committed value
      let next = integer ? Math.round(parsed) : +parsed.toFixed(1)
      next = Math.max(min, next)
      if (max != null) next = Math.min(max, next)
      if (next !== value) onChange(next)
    },
  }
}
