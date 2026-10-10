// ============================================================
// Mezo · DayStrip — Mai's week navigator (mezo-9bbc).
// One chip per weekday: label (MA on today) + day number, a dot per
// scheduled session coloured by modality, and a done marker line. Purely
// presentational — it receives pre-derived DayStripItems (dayStripItems.ts).
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `dstrip()`): seven white pills in one row;
// the shown day is filled with the domain colour, a rest day is faded and reads „pihenő". Under
// the number: one dot per session (gym = the domain colour, sport = pink, run = blue), then one
// green tick per logged session, one skip glyph per skipped one, the kímélő glyph on a protected day.
// ============================================================
import { useEffect, useRef } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon3D } from '@/shared/ui/clay'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import type { DayStripItem } from '@/features/train/logic/dayStripItems'

/** The chip's short weekday caption (prototype `WKD`). */
const SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const shortDay = (day: string) => SHORT[DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number])] ?? day

/** Spoken done-state of a chip — the visual tick / dots / `pihenő` marker in words. */
function doneLabel(it: DayStripItem): string {
  if (it.sessionCount === 0) return 'pihenő'
  const skipped = it.protectedDay ? ' · kímélő mód' : it.skipCount ? ` · ${it.skipCount} kihagyva` : ''
  if (it.doneCount === 0) return `nincs naplózva${skipped}`
  return `${it.doneCount}/${it.sessionCount} kész${skipped}`
}

const Check = () => (
  <svg className="em-ds-ok" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

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
    <section className="em-ds" role="tablist" aria-label="Hét napjai" data-kalauz-anchor={kalauzAnchor}>
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
            className={cn('em-day', it.isToday && 'today', isSelected && 'on', empty && 'rest')}
            onClick={() => onSelect(it.day)}
            // The label REPLACES the chip's content as its accessible name, so the day
            // number and the done marker have to be spoken here — the dots are decorative
            // and stay `aria-hidden` (mezo-9bbc final review).
            aria-label={`${DAY_LABELS[it.day] ?? it.day}${it.isToday ? ' · ma' : ''} · ${it.dayNumber}. · ${doneLabel(it)}`}
          >
            <small>{it.isToday ? 'MA' : shortDay(it.day)}</small>
            <b>{it.dayNumber}</b>
            <span className="em-dots" aria-hidden="true">
              {it.dots.map((tone, i) => <u key={`${tone}-${i}`} className={tone} />)}
            </span>
            <i className={cn('em-day-ck', it.doneCount > 0 && 'ok')} aria-hidden="true">
              {empty
                ? 'pihenő'
                : (
                  <>
                    {Array.from({ length: it.doneCount }, (_, i) => <Check key={`d${i}`} />)}
                    {/* Kihagyás S1 (mezo-q4xt2.1): one skip glyph per skipped session. */}
                    {Array.from({ length: it.skipCount ?? 0 }, (_, i) => (
                      <Icon3D key={`s${i}`} name="t-skip" size={12} className="em-day-sk" />
                    ))}
                    {/* Kímélő mód S2 (mezo-q4xt2.2): one kímélő glyph on a protected day. */}
                    {it.protectedDay && <Icon3D name="t-kimelo" size={12} className="em-day-km" />}
                  </>
                )}
            </i>
          </button>
        )
      })}
    </section>
  )
}
