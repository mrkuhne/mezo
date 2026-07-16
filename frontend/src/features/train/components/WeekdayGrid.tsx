// ============================================================
// Mezo · WeekdayGrid — single-select 7-day picker (Hét..Vas). value/onChange
// is a dayOfWeek index (0=Hét..6=Vas, = DAY_ORDER index). Run accent --sky.
// ============================================================
import { DAY_ORDER } from '@/data/train/train'

const RUN = 'var(--sky)'

export function WeekdayGrid({ value, onChange }: { value: number; onChange: (dayOfWeek: number) => void }) {
  return (
    <div className="row gap-xs" role="group" aria-label="Nap">
      {DAY_ORDER.map((d, i) => {
        const active = i === value
        return (
          <button
            key={d}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(i)}
            className="flex-1 notch-4"
            style={{
              padding: '9px 0',
              background: active ? 'color-mix(in srgb, var(--sky) 12%, transparent)' : 'var(--surface-1)',
              border: `1px solid ${active ? RUN : 'var(--border-subtle)'}`,
              color: active ? RUN : 'var(--text-tertiary)',
              fontFamily: 'var(--ff-mono)',
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}
