// StackNextCard — the Stack v2 featured "KÖVETKEZŐ" card (Fuel design-2.0 spec §Stack,
// mezo-d20.4.3). Surfaces the single next zone (first not-fully-done slot) in a gold-ring card:
// a big tick per entry, a kind-colored dot (supplement sage / stimulant amber / medication
// lavender), and the Mezo "miért ide" line — the first entry-level `reason` (ProtocolOccurrence.
// placementReason, threaded through projectStackDay) if one exists, else the slot's own
// `anchorNote`. This is the one place on the page that reason ever surfaces for a NON-primary
// zone too (audit gap: `mezoNote`/reason fields exist but only the bottom "Miért így" card showed
// them, and only for pre_workout/post_workout/evening — the featured card has no such filter).
import { Icon } from '@/shared/ui/Icon'
import type { SupplementType } from '@/data/types'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'

const KIND_CLASS: Record<SupplementType, string> = {
  supplement: 'stk-k-sage',
  stimulant: 'stk-k-amber',
  medication: 'stk-k-lav',
}

export function StackNextCard({
  slot,
  kindOf,
  onToggleTaken,
  onOpenEntry,
}: {
  slot: StackDaySlot
  kindOf: (entry: StackDayEntry) => SupplementType | undefined
  onToggleTaken: (entry: StackDayEntry) => void
  onOpenEntry: (entry: StackDayEntry) => void
}) {
  const note = slot.entries.find(e => e.reason)?.reason ?? slot.anchorNote

  return (
    <div className="card stk-next">
      <div className="eyebrow stk-next-eyebrow">
        KÖVETKEZŐ · {slot.label.toUpperCase()} · {slot.time}
        {slot.anchorNote ? ` · ${slot.anchorNote}` : ''}
      </div>
      {slot.entries.map(entry => (
        <div className="stk-next-row" key={entry.occurrenceId}>
          <button
            type="button"
            aria-label={`${entry.name} bevétel`}
            aria-pressed={entry.taken}
            disabled={entry.skippedToday}
            onClick={() => onToggleTaken(entry)}
            className={`stk-htick${entry.taken ? ' f' : ''}`}
          >
            {entry.taken && <Icon name="check" size={16} color="var(--text-inverse)" />}
          </button>
          <span className={`stk-kdot ${KIND_CLASS[kindOf(entry) ?? 'supplement']}`} aria-hidden="true" />
          <button
            type="button"
            aria-label={`${entry.name} beállítások`}
            onClick={() => onOpenEntry(entry)}
            className="stk-next-label"
          >
            <span className="nm" style={entry.taken ? { textDecoration: 'line-through' } : undefined}>
              {entry.name}
            </span>
            {entry.dose && <span className="ds">{entry.dose}</span>}
          </button>
        </div>
      ))}
      {note && (
        <p className="stk-next-note">
          <i className="dot" aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}
    </div>
  )
}
