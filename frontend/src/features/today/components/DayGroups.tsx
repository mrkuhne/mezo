// ============================================================
// Mezo · DayGroups — egy napszak-nézet tétel-listája (mezo-e26w). A csoportosító
// logika VÁLTOZATLAN a mezo-puci óta: első-megjelenés sorrend, darabszám a
// fejlécben, head/focus slotok.
// Ami változott: minden csoport EGY `TodayList` dobozban ül, és a sorok a
// Today saját `TodayRow`-ja — NEM a `shared/ui/ItemRow` (spec §7: azt a Fuel
// és a rutin-szerkesztő is rendereli, és ebben a változásban nem mozdulnak).
// Az EGYETLEN összecsukott elem a lapon továbbra is a kész-hajtás.
// ============================================================
import { useState, type ReactNode } from 'react'
import { TodayList } from '@/features/today/components/TodayList'
import { TodayRow, type RowTone } from '@/features/today/components/TodayRow'
import { rowAccessory } from '@/features/today/logic/rowAccessory'
import type { ItemSource, TodayItem } from '@/features/today/logic/todayItems'

const SOURCE_TONE: Record<ItemSource, RowTone> = {
  habit: 'habit', quest: 'quest', fuel: 'fuel', checkin: 'check', session: 'train', ritual: 'habit',
}

export interface DayGroupsProps {
  open: TodayItem[]
  done: TodayItem[]
  /** A becsukott hajtás teljes felirata, pl. „✓ 3 kész ma · +40 XP". */
  doneLabel: string
  /** Esti visszatekintés összege — a kinyitott kész-blokkot zárja. */
  dayXp?: number | null
  /** A nap/este companion-jegyzete, a csoportok fölött. */
  head?: ReactNode
  /** IntentionBanner slot — saját „Fókusz" fejléc alatt. */
  focus?: ReactNode
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}

export function DayGroups({
  open, done, doneLabel, dayXp, head, focus, habitPending, onAct,
}: DayGroupsProps) {
  const [doneOpen, setDoneOpen] = useState(false)

  // Első-megjelenés sorrend — a Map megőrzi a beszúrási sorrendet.
  const groups = new Map<string, TodayItem[]>()
  for (const it of open) {
    const bucket = groups.get(it.group)
    if (bucket) bucket.push(it)
    else groups.set(it.group, [it])
  }

  const rowOf = (it: TodayItem, isDone = false) => (
    <TodayRow
      key={it.id}
      tone={SOURCE_TONE[it.source]}
      icon={it.emoji}
      title={it.title}
      subtitle={it.subtitle}
      time={it.time}
      accessory={isDone ? 'none' : rowAccessory(it)}
      actionLabel={isDone ? undefined : it.action?.label}
      onAction={!isDone && it.action ? () => onAct(it) : undefined}
      linkUrl={it.linkUrl}
      disabled={habitPending && it.action?.kind === 'habit'}
      done={isDone}
    />
  )

  return (
    <div className="dv-groups">
      {head}
      {[...groups].map(([group, rows]) => (
        <TodayList
          key={group}
          label={group}
          count={rows.length}
        >
          {rows.map((it) => rowOf(it))}
        </TodayList>
      ))}
      {focus}
      {done.length > 0 && (
        <>
          <button
            type="button"
            className="td-done np-press"
            aria-expanded={doneOpen}
            onClick={() => setDoneOpen((v) => !v)}
          >
            {doneLabel}
            <span aria-hidden="true">{doneOpen ? '▴' : '▾'}</span>
          </button>
          {doneOpen && (
            <>
              <TodayList>{done.map((it) => rowOf(it, true))}</TodayList>
              {dayXp != null && <div className="td-dayxp">Ma összesen +{dayXp} XP</div>}
            </>
          )}
        </>
      )}
    </div>
  )
}
