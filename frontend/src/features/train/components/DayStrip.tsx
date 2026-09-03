// ============================================================
// Mezo · DayStrip — Mai's horizontal week navigator (mezo-9bbc).
// One `.daychip` per weekday: label (MA on today) + day number, a dot per
// scheduled session coloured by modality, and a done marker line. Purely
// presentational — it receives pre-derived DayStripItems (dayStripItems.ts).
// The strip is wider than the viewport (7 × 62 px + gaps ≈ 536 px on a 440 px
// phone), so on mount the selected chip is centred — a `?day=6` drill-in from
// Heti would otherwise land with its own chip off-screen (spec §5a).
// ============================================================
import { useEffect, useRef } from 'react'
import { cn } from '@/shared/lib/cn'
import { DAY_LABELS } from '@/data/train/train'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import type { DayStripItem } from '@/features/train/logic/dayStripItems'

/** Spoken done-state of a chip — the visual `✓✓`/`—`/`pihenő` marker in words. */
function doneLabel(it: DayStripItem): string {
  if (it.sessionCount === 0) return 'pihenő'
  if (it.doneCount === 0) return 'nincs naplózva'
  return `${it.doneCount}/${it.sessionCount} kész`
}

export function DayStrip({
  items,
  selected,
  onSelect,
  kalauzAnchor,
}: {
  items: DayStripItem[]
  /** Day key of the currently shown day. */
  selected: string
  onSelect: (day: string) => void
  /** Mezo-kalauz spotlight-horgony (mezo-gb1s.5) — csak a Mai adja át. */
  kalauzAnchor?: string
}) {
  const selectedRef = useRef<HTMLButtonElement | null>(null)
  const reduced = useReducedMotion()
  // Mount-only on purpose: later selections are user taps on a chip that is by
  // definition already visible, and re-centring under the finger would fight them.
  useEffect(() => {
    if (reduced) return
    selectedRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="daystrip" role="tablist" aria-label="Hét napjai" data-kalauz-anchor={kalauzAnchor}>
      {items.map((it) => {
        const empty = it.sessionCount === 0
        const isSelected = it.day === selected
        return (
          <button
            key={it.day}
            type="button"
            role="tab"
            ref={isSelected ? selectedRef : undefined}
            aria-selected={isSelected}
            className={cn('daychip', it.isToday && 'today', isSelected && 'sel', empty && 'rest')}
            onClick={() => onSelect(it.day)}
            // The label REPLACES the chip's content as its accessible name, so the day
            // number and the done marker have to be spoken here — the dots are decorative
            // and stay `aria-hidden` (mezo-9bbc final review).
            aria-label={`${DAY_LABELS[it.day] ?? it.day}${it.isToday ? ' · ma' : ''} · ${it.dayNumber}. · ${doneLabel(it)}`}
          >
            <span className="dl">{it.isToday ? 'MA' : it.day}</span>
            <span className="dn">{it.dayNumber}</span>
            <span className="dots" aria-hidden="true">
              {it.dots.map((tone, i) => (
                <span key={`${tone}-${i}`} className={cn('dot', `dot-${tone}`)} />
              ))}
            </span>
            <span className="ck">
              {empty ? 'pihenő' : it.doneCount > 0 ? '✓'.repeat(it.doneCount) : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
