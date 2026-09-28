// Check-in 2.0 · one 1–10 item (prototype `elo/nap.html` `SH.checkin`, the scale body): the
// item's 3D mark + the one loud numeral on a frameless halo — „–" until tapped, nothing is
// pre-selected — then the 1–10 row (recess → tinted → solid) and its two anchors.
import type { CSSProperties } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

const TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** The bare 1–10 row + anchors (also the pain intensity row). `value` null = nothing selected. */
export function CheckInScale({ value, color, low, high, onPick }: {
  value: number | null; color: string; low?: string; high?: string; onPick: (n: number) => void
}) {
  return (
    <div>
      <div className="capture-rating-scale">
        {TEN.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className="capture-scale-cell"
            aria-pressed={value === n}
            data-state={value === n ? 'active' : value != null && value > n ? 'filled' : undefined}
            style={{ '--cell-hue': color } as CSSProperties}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="capture-scale-l">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

export function ScaleStep({ icon, color, value, low, high, onPick }: {
  icon: Icon3DName; color: string; value: number | null; low?: string; high?: string; onPick: (n: number) => void
}) {
  return (
    <>
      <div className="capture-check-orbit">
        <Icon3D name={icon} size={58} className="capture-art" />
        <div className={value == null ? 'capture-check-value ck-none' : 'capture-check-value'} data-testid="ck-value">
          {value ?? '–'}
          <small> / 10</small>
        </div>
      </div>
      <CheckInScale value={value} color={color} low={low} high={high} onPick={onPick} />
    </>
  )
}
