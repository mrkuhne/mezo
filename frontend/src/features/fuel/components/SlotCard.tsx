import type { FuelSlot, FuelMeal } from '@/data/types'
import type { KIND_META } from '@/data/kindMeta'
import { Icon } from '@/shared/ui/Icon'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { SupplementItemRow } from '@/features/fuel/components/SupplementItemRow'

type KindMeta = (typeof KIND_META)[keyof typeof KIND_META]

export function SlotCard({
  slot,
  meta,
  scoredMeal,
  onOpenScore,
}: {
  slot: FuelSlot
  meta: KindMeta
  scoredMeal: FuelMeal | null
  onOpenScore: (m: FuelMeal) => void
}) {
  const isDone = slot.state === 'done'
  const isNow = slot.state === 'now'

  return (
    <div
      className="card notch-8"
      style={{
        padding: '12px 14px',
        background: isNow ? 'color-mix(in srgb, var(--brand-glow) 4%, transparent)' : 'var(--surface-1)',
        borderColor: isNow ? 'var(--border-brand)' : 'var(--border-subtle)',
        opacity: isDone ? 0.7 : 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isNow && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--brand-glow)' }} />}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', paddingLeft: isNow ? 4 : 0 }}>
        <div className="row gap-sm" style={{ alignItems: 'center' }}>
          <span
            style={{
              padding: '2px 6px',
              fontSize: 9,
              fontWeight: 600,
              fontFamily: 'var(--ff-mono)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: meta.color,
              border: '1px solid color-mix(in srgb, ' + meta.color + ' 25%, transparent)',
              background: 'color-mix(in srgb, ' + meta.color + ' 6%, transparent)',
            }}
          >
            {meta.label}
          </span>
          {slot.windowTip && (
            <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
              {slot.windowTip}
            </span>
          )}
        </div>
        {isNow && <span className="chip brand" style={{ fontSize: 9, padding: '2px 6px' }}>MOST</span>}
        {isDone && <Icon name="check" size={12} color="var(--brand-glow)" />}
      </div>

      {/* Title / meal name + AI-score */}
      {slot.mealName && (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginTop: 8 }}>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              flex: 1,
              minWidth: 0,
            }}
          >
            {slot.mealName}
          </div>
          {scoredMeal && (
            <button
              type="button"
              aria-label="AI score"
              onClick={(e) => {
                e.stopPropagation()
                onOpenScore(scoredMeal)
              }}
              className="col"
              style={{
                alignItems: 'flex-end',
                padding: '2px 6px',
                border: '1px solid var(--border-brand)',
                background: 'color-mix(in srgb, var(--brand-glow) 6%, transparent)',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <div className="row gap-xs" style={{ alignItems: 'center' }}>
                <span className="label-mono" style={{ fontSize: 8, color: 'var(--brand-glow)' }}>AI</span>
                <span style={{ fontFamily: 'var(--ff-display)', fontSize: 14, color: 'var(--brand-glow)', lineHeight: 1, fontWeight: 600 }}>
                  {((scoredMeal.score ?? 0) * 100).toFixed(0)}
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      {slot.mealName && (
        <div className="row gap-md mt-sm" style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
          <span>{slot.kcal}kcal</span>
          <span>P {slot.p}</span>
          <span>C {slot.c}</span>
          <span>F {slot.f}</span>
        </div>
      )}

      {slot.kind === 'workout' && (
        <div style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 600, marginTop: 8, color: 'var(--text-primary)' }}>
          {slot.label} · {slot.duration} perc
        </div>
      )}
      {slot.kind === 'sport' && (
        <div style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 600, marginTop: 8, color: 'var(--text-primary)' }}>
          {slot.label} · {slot.duration} perc
        </div>
      )}

      {/* Supplement items */}
      {(slot.items ?? []).length > 0 && (
        <div className="col gap-sm mt-md">
          {slot.items?.map((item, i) => <SupplementItemRow key={i} item={item} />)}
        </div>
      )}

      {/* Mezo note */}
      {slot.mezoNote && (
        <div
          className="row gap-sm mt-md"
          style={{
            paddingTop: 10,
            borderTop: '1px solid var(--border-subtle)',
            alignItems: 'flex-start',
          }}
        >
          <Icon name="sparkle" size={11} color="var(--brand-glow)" />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
            <SafeMarkdown text={slot.mezoNote} />
          </span>
        </div>
      )}
    </div>
  )
}
