// ============================================================
// Mezo · TodoCard — the ONE actionable card of a face (mezo-j7u4). It replaced
// three separate cards (TodayQuestsCard + RoutineCard + the standalone ritual
// and check-in sections): a single progress bar, small-caps group headings and
// uniform `ItemRow`s. Grouping preserves the order in which each group first
// appears in `items`, which is the order `buildTodayItems` emits them.
// Ghosts (renders null) on an empty face.
// Two optional slots carry the retired cards' non-row jobs: `growth` is the quest
// summary AND the only Today → /me/growth route (TodayQuestsCard's header), and
// `note` is the fuel plan's companion line (FuelTimelinePreview's sparkle row).
// ============================================================
import { Link } from 'react-router-dom'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function TodoCard({
  items, doneCount, xp, growth, note, onAct,
}: {
  /** The face's OPEN items — done ones live in `DoneFold`. */
  items: TodayItem[]
  /** Completed items on this face, for the header ratio + bar. */
  doneCount: number
  xp: number
  /** Quest+activity summary; renders the header's link into quest management. */
  growth?: GrowthTodaySummary | null
  /** Companion line for the plan the rows belong to (`{time} · {text}`). */
  note?: { time: string; text: string } | null
  onAct: (item: TodayItem) => void
}) {
  if (items.length === 0) return null

  const total = items.length + doneCount
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100)
  // With the growth link occupying the header's right cell, the face's own XP joins the
  // ratio on the left rather than being dropped. No quests today → no link, no move.
  const showGrowth = Boolean(growth && growth.total > 0)

  // Group in first-appearance order — a Map preserves insertion order.
  const groups = new Map<string, TodayItem[]>()
  for (const it of items) {
    const bucket = groups.get(it.group)
    if (bucket) bucket.push(it)
    else groups.set(it.group, [it])
  }

  return (
    <div className="tdc">
      <div className="tdc-hd">
        <span className="tdc-hd-l">⚡ {doneCount} / {total} kész{showGrowth ? ` · +${xp} XP` : ''}</span>
        {showGrowth && growth ? (
          <Link to="/me/growth" className="tdc-hd-r tdc-hd-go" aria-label="Küldetések kezelése a Növekedésben">
            {growth.done}/{growth.total} · +{growth.xp} XP ›
          </Link>
        ) : (
          <span className="tdc-hd-r">+{xp} XP</span>
        )}
      </div>
      <div className="tdc-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      {[...groups].map(([group, rows]) => (
        <div key={group}>
          <div className="tdc-grp">{group} · {rows.length}</div>
          {rows.map((it) => (
            <ItemRow
              key={it.id}
              tone={it.tone}
              emoji={it.emoji}
              title={it.title}
              subtitle={it.subtitle}
              time={it.time}
              actionLabel={it.action?.label}
              onAction={it.action ? () => onAct(it) : undefined}
            />
          ))}
        </div>
      ))}
      {note && (
        <div className="tdc-note">
          <span aria-hidden="true">✨</span>
          <span><b>{note.time}</b> · {note.text}</span>
        </div>
      )}
    </div>
  )
}
