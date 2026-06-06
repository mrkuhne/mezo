// ============================================================
// Mezo · EditorChip — a tiny labelled value tile used inside the
// ExerciseEditRow inline editor (Szet / Rep target / RIR). Display-only:
// the prototype renders these as static fields, no input wiring yet.
// Ported from prototype mesocycles.jsx EditorChip.
// ============================================================
import type { ReactNode } from 'react'

interface EditorChipProps {
  label: string
  val: ReactNode
}

export function EditorChip({ label, val }: EditorChipProps) {
  return (
    <div
      className="flex-1"
      style={{ padding: '6px 10px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>
        {val}
      </div>
    </div>
  )
}
