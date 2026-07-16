import { Eyebrow } from '@/shared/ui/Eyebrow'
import type { CompanionNote } from '@/data/types'

/**
 * Proactive H1: the companion's in-day note (midday nudge / evening closing). Deliberately NOT
 * named "Heartbeat*" — the check-in strip owns that copy. Rendered only when a note exists
 * (honest absence otherwise) — the parent guards; mock mode never has one (Phase-1 parity).
 */
export function CompanionNoteCard({ note }: { note: CompanionNote }) {
  return (
    <div style={{ padding: '0 24px' }}>
      <div className="card" style={{ padding: '14px 18px' }}>
        <Eyebrow brand>{note.kind === 'closing' ? 'Mezo · napzárás' : 'Mezo · napközbeni jegyzet'}</Eyebrow>
        <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>
          {note.text}
        </p>
      </div>
    </div>
  )
}
