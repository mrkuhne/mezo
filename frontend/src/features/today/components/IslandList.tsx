// ============================================================
// Mezo · IslandList — the L1 layer of a big island (mezo-euze).
// The TodoCard + DoneFold successor: the island's FULL item list in
// the shared ItemRow language with small-caps group headings, plus
// two content slots (`head` for the briefing / companion CoachBubble,
// `focus` for the IntentionBanner under a Fókusz heading) and the done
// block (`doneHeading`; the evening closes it with `Ma összesen +N XP`).
// Grouping preserves first-appearance order (the buildTodayItems order);
// the quest group heading carries the ONE Today → /me/growth route.
// ============================================================
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { TodayItem } from '@/features/today/logic/todayItems'

export interface IslandListProps {
  open: TodayItem[]
  done: TodayItem[]
  doneHeading: string
  /** Evening retrospective total — closes the done group with `Ma összesen +N XP`. */
  dayXp?: number | null
  /** BriefingCard / CompanionNoteCard slot, above the groups. */
  head?: ReactNode
  /** IntentionBanner slot — rendered under a 'Fókusz' group heading. */
  focus?: ReactNode
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
  onClose: () => void
}

export function IslandList({
  open, done, doneHeading, dayXp, head, focus, growth, habitPending, onAct, onClose,
}: IslandListProps) {
  // Group in first-appearance order — a Map preserves insertion order.
  const groups = new Map<string, TodayItem[]>()
  for (const it of open) {
    const bucket = groups.get(it.group)
    if (bucket) bucket.push(it)
    else groups.set(it.group, [it])
  }

  const rowsOf = (rows: TodayItem[], isDone = false) =>
    rows.map((it) => (
      <ItemRow
        key={it.id}
        tone={it.tone}
        emoji={it.emoji}
        title={it.title}
        subtitle={it.subtitle}
        time={it.time}
        actionLabel={isDone ? undefined : it.action?.label}
        onAction={!isDone && it.action ? () => onAct(it) : undefined}
        linkUrl={it.linkUrl}
        disabled={habitPending && it.action?.kind === 'habit'}
        done={isDone}
      />
    ))

  return (
    <div className="isl-l1">
      {head}
      {[...groups].map(([group, rows]) => (
        <div key={group}>
          <div className="isl-grouph">
            <span>{group} · {rows.length}</span>
            {group === 'Napi küldetések' && growth && growth.total > 0 && (
              <Link to="/me/growth" className="isl-grouph-go" aria-label="Küldetések kezelése a Növekedésben">
                {growth.done}/{growth.total} · +{growth.xp} XP ›
              </Link>
            )}
          </div>
          {rowsOf(rows)}
        </div>
      ))}
      {focus && (
        <div>
          <div className="isl-grouph"><span>Fókusz</span></div>
          {focus}
        </div>
      )}
      {done.length > 0 && (
        <div>
          <div className="isl-grouph"><span>{doneHeading} · {done.length}</span></div>
          {rowsOf(done, true)}
          {dayXp != null && <div className="isl-dayxp">Ma összesen +{dayXp} XP</div>}
        </div>
      )}
      <button type="button" className="isl-l1-close" onClick={onClose}>összecsuk ↑</button>
    </div>
  )
}
