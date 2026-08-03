import type { CSSProperties } from 'react'
import { Icon } from '@/shared/ui/Icon'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'

// StackZoneCard — one zoned .zcard for the Fuel/Stack timeline (mezo-vx9v Task 8). Reuses the Mai
// zone-card CSS family (.zcard/.zh/.zn/.zk/.zrow/.zt, prototype.css:2499-2541 — see DayZoneCard /
// ZoneSlotRow for the consumption idiom this mirrors) so the Stack page reads as the SAME
// zone-timeline language as FuelMaiPage, just with a tick-to-log row instead of a log/AI pair.
//
// Badge precedence: a user pin always wins (📌); otherwise a rest-day regroup badges 'ma nincs
// edzés' (+ '→ kimarad' when the occurrence is fully skipped today, not just displaced to a
// fallback zone); a normally rule/llm-placed occurrence badges 'auto'.
function badgeFor(entry: StackDayEntry): string {
  if (entry.pinned) return '📌'
  if (entry.displacedToday || entry.skippedToday) return 'ma nincs edzés' + (entry.skippedToday ? ' → kimarad' : '')
  return 'auto'
}

const tickBase: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: '50%',
  flexShrink: 0,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

export function StackZoneCard({
  slot,
  takenBusy,
  onToggleTaken,
  onOpenEntry,
}: {
  slot: StackDaySlot
  takenBusy?: boolean
  onToggleTaken: (entry: StackDayEntry) => void
  onOpenEntry: (entry: StackDayEntry) => void
}) {
  return (
    <div className="zcard">
      <div className="zh">
        <span className="zn">{slot.label}</span>
        <span className="zk" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span>{slot.time}</span>
          {slot.anchorNote && (
            <span style={{ fontSize: 8.5, fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--faint)' }}>
              {slot.anchorNote}
            </span>
          )}
        </span>
      </div>
      {slot.entries.map(entry => (
        <div className="zrow" key={entry.occurrenceId} style={{ opacity: entry.skippedToday ? 0.6 : 1 }}>
          <button
            type="button"
            aria-label={`${entry.name} bevétel`}
            aria-pressed={entry.taken}
            disabled={entry.skippedToday || takenBusy}
            onClick={() => onToggleTaken(entry)}
            style={{
              ...tickBase,
              border: entry.taken ? 'none' : '1.5px solid var(--border-strong)',
              background: entry.taken ? 'var(--sage)' : 'transparent',
            }}
          >
            {entry.taken && <Icon name="check" size={11} color="var(--text-inverse)" />}
          </button>
          <button
            type="button"
            className="zt"
            aria-label={`${entry.name} beállítások`}
            onClick={() => onOpenEntry(entry)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              background: 'none',
              border: 0,
              padding: 0,
              font: 'inherit',
              color: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <div className="a" style={entry.taken ? { textDecoration: 'line-through', color: 'var(--sub)' } : undefined}>
                {entry.name}
              </div>
              {entry.dose && <div className="b">{entry.dose}</div>}
            </span>
            <span className="chip" style={{ flexShrink: 0, fontSize: 9 }}>{badgeFor(entry)}</span>
          </button>
        </div>
      ))}
    </div>
  )
}
