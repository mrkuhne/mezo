import { CoachBubble } from '@/shared/ui/CoachBubble'
import type { CompanionNote } from '@/data/types'

/**
 * Proactive H1: the companion's in-day note (midday nudge / evening closing), spoken in the
 * DS CoachBubble voice (ds-migration P4). Deliberately NOT named "Heartbeat*" — the check-in
 * rows own that copy. Rendered only when a note exists (honest absence otherwise) — the
 * parent guards; mock mode never has one (Phase-1 parity).
 */
export function CompanionNoteCard({ note }: { note: CompanionNote }) {
  return (
    <CoachBubble
      eyebrow={note.kind === 'closing' ? 'Mezo · napzárás' : 'Mezo · napközbeni jegyzet'}
      className="today-note"
    >
      {note.text}
    </CoachBubble>
  )
}
