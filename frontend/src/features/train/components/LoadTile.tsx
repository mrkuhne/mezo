// ============================================================
// Mezo · LoadTile — a Heti / Napi terhelés-oldal kompakt belépő csempéje
// (mezo-yty6): nagy count-up szám + a három legnagyobb izom mini-gauge-a.
// A hetit a szerkesztő, a napit a nap-szerkesztő hordja — a csempe maga a gomb.
// ============================================================
import { useCountUpOnChange } from '@/shared/ui/mozaik/motion'

export interface LoadGauge {
  label: string
  value: number
  /** The bar's denominator: the session cap (day) or the group's MRV (week). */
  max: number
  color: string
  /** Amber treatment — at or near the session cap. */
  warn?: boolean
}

interface LoadTileProps {
  tone: 'day' | 'week'
  eyebrow: string
  value: number
  /** Small print after the headline number, e.g. "szett · ~57′". */
  unit: string
  gauges: LoadGauge[]
  /** A lint touches this scope — amber dot. */
  flagged?: boolean
  onOpen: () => void
}

export function LoadTile({ tone, eyebrow, value, unit, gauges, flagged, onOpen }: LoadTileProps) {
  const shown = useCountUpOnChange(value)
  return (
    <button type="button" className={`mz-lt mz-lt-${tone}`} onClick={onOpen}>
      <span className="mz-lt-head">
        <span className="mz-lt-eyebrow mz-grow">{eyebrow}</span>
        {flagged && <span className="mz-lt-dot" aria-hidden="true" />}
        <span className="mz-lt-chev" aria-hidden="true">›</span>
      </span>
      <span className="mz-lt-body">
        <span className="mz-lt-big">
          {shown}
          <small>{unit}</small>
        </span>
        <span className="mz-lt-gauges">
          {gauges.map((g) => (
            <span className="mz-lt-g" key={g.label}>
              <span style={{ color: g.color }}>{g.label}</span>
              <span className="bar">
                <span
                  style={{
                    display: 'block', height: '100%', borderRadius: 3,
                    width: `${Math.min(100, Math.round((g.value / g.max) * 100))}%`,
                    background: g.warn ? 'var(--amber-deep)' : g.color,
                  }}
                />
              </span>
              <span className="n">{g.value}</span>
            </span>
          ))}
        </span>
      </span>
    </button>
  )
}
