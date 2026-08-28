// Weekly review (mezo-p2tr) — the week hero's 7-bar score sparkline. Inline SVG only (no chart
// lib, per the platform rule): a bar per day, height ∝ score, with a 2px baseline stub for a
// null-score ("tanulom") day so the week's shape is never a fabricated zero-height bar.
const BAR_W = 24
const GAP = 16
const BASELINE_Y = 54
const MAX_H = 48
const AXIS = ['H', 'K', 'Sz', 'Cs', 'P', 'Sz', 'V']

/** `--dv-lav` (lavender data-viz accent) — the platform's `--dv-*` band exists (see
 *  `_platform-design-system.md` §token cascade), so the bars use its lavender member rather
 *  than falling back to `--lav-deep`. */
const BAR_COLOR = 'var(--dv-lav)'

export function WeekScoreBars({ scores }: { scores: (number | null)[] }) {
  return (
    <div>
      <svg viewBox="0 0 300 60" width="100%" height="60" aria-hidden="true" style={{ display: 'block' }}>
        {scores.map((score, i) => {
          const x = 6 + i * (BAR_W + GAP)
          const h = score == null ? 2 : Math.max(2, (Math.max(0, Math.min(100, score)) / 100) * MAX_H)
          return (
            <rect
              key={i}
              x={x}
              y={BASELINE_Y - h}
              width={BAR_W}
              height={h}
              rx={3}
              fill={BAR_COLOR}
              opacity={score == null ? 0.35 : 0.9}
            />
          )
        })}
      </svg>
      <div className="row" style={{ justifyContent: 'space-between', padding: '0 6px' }}>
        {AXIS.map((label, i) => (
          <span
            key={i}
            style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', width: BAR_W, textAlign: 'center' }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
