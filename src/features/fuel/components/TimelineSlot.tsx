import type { FuelSlot, FuelMeal } from '@/data/types'
import { KIND_META } from '@/data/kindMeta'
import { SlotCard } from './SlotCard'

export function TimelineSlot({
  slot,
  isLast,
  scoredMeal,
  onOpenScore,
}: {
  slot: FuelSlot
  isLast: boolean
  scoredMeal: FuelMeal | null
  onOpenScore: (m: FuelMeal) => void
}) {
  const meta = KIND_META[slot.kind] ?? KIND_META.meal
  const isDone = slot.state === 'done'
  const isNow = slot.state === 'now'

  return (
    <div className="row" style={{ alignItems: 'stretch', gap: 14 }}>
      {/* Timeline gutter */}
      <div className="col" style={{ width: 56, alignItems: 'center', flexShrink: 0, position: 'relative' }}>
        <span
          style={{
            fontFamily: 'var(--ff-mono)',
            fontSize: 11,
            fontWeight: 600,
            color: isDone ? 'var(--text-tertiary)' : isNow ? 'var(--brand-glow)' : 'var(--text-secondary)',
            letterSpacing: '0.04em',
          }}
        >
          {slot.time}
        </span>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: isDone || isNow ? meta.color : 'var(--surface-2)',
            border: '2px solid ' + (isDone || isNow ? meta.color : 'var(--border-strong)'),
            marginTop: 6,
            boxShadow: isNow
              ? '0 0 0 4px color-mix(in srgb, ' + meta.color + ' 20%, transparent), 0 0 12px ' + meta.color
              : 'none',
            flexShrink: 0,
            zIndex: 2,
            position: 'relative',
          }}
        />
        {!isLast && (
          <div
            style={{
              position: 'absolute',
              top: 36,
              bottom: -16,
              left: '50%',
              width: 1,
              background: isDone ? 'var(--border-strong)' : 'var(--border-subtle)',
              transform: 'translateX(-50%)',
              zIndex: 1,
            }}
          />
        )}
      </div>

      {/* Slot content */}
      <div style={{ flex: 1, paddingBottom: 16, minWidth: 0 }}>
        <SlotCard slot={slot} meta={meta} scoredMeal={scoredMeal} onOpenScore={onOpenScore} />
      </div>
    </div>
  )
}
