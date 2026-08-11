// ============================================================
// Mezo · DayGroups — a daypart view's item list (mezo-puci), the
// IslandList successor. Two things left with the islands: the internal
// scroller (the page is the scroller now) and the `összecsuk` handle
// (nothing is folded away). What survives verbatim: grouping in
// first-appearance order, the group heading's count, the quest
// heading's single Today → /me/growth route, the head/focus slots,
// and the ItemRow language.
// The ONE collapsed thing on the whole screen is the done fold — the
// day's finished items, behind a quiet line.
// ============================================================
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { TodayItem } from '@/features/today/logic/todayItems'

export interface DayGroupsProps {
  open: TodayItem[]
  done: TodayItem[]
  /** The whole label on the collapsed fold, e.g. „✓ 3 kész ma · +40 XP". */
  doneLabel: string
  /** Evening retrospective total — closes the expanded done block. */
  dayXp?: number | null
  /** The day/evening companion note, above the groups. */
  head?: ReactNode
  /** IntentionBanner slot — rendered under a „Fókusz" group heading. */
  focus?: ReactNode
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}

export function DayGroups({
  open, done, doneLabel, dayXp, head, focus, growth, habitPending, onAct,
}: DayGroupsProps) {
  const [doneOpen, setDoneOpen] = useState(false)

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
    <div className="dv-groups">
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
          <button
            type="button"
            className="dv-done"
            aria-expanded={doneOpen}
            onClick={() => setDoneOpen((v) => !v)}
          >
            {doneLabel}
            <span className="dv-done-arr" aria-hidden="true">{doneOpen ? '▴' : '▾'}</span>
          </button>
          {doneOpen && (
            <>
              {rowsOf(done, true)}
              {dayXp != null && <div className="isl-dayxp">Ma összesen +{dayXp} XP</div>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
