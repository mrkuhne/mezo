// ============================================================
// Mezo · DayTile — a Program-lépés nap-mozaikjának egy csempéje
// (meso-body.html .dtile, px ×1.18): naplevél + naptípus, két mini-cella
// (szett / ~perc), majd izmonként egy vékony sáv. Koppintásra a nap saját
// oldala nyílik (csempe → saját oldal minta) — a csempe maga a gomb.
// ============================================================
export type DayTone = 'coral' | 'sage' | 'rose' | 'gold'

export interface DayTileMuscle {
  label: string
  sets: number
  /** the muscle family's deep token (a CSS var reference) */
  color: string
  /** over the per-session muscle cap — the model will reshuffle it */
  over: boolean
}

interface DayTileProps {
  day: string
  type: string
  sets: number
  minutes: number
  muscles: DayTileMuscle[]
  tone: DayTone
  /** the per-session cap bar's denominator */
  cap: number
  status?: 'now' | 'done' | null
  onOpen: () => void
}

export function DayTile({ day, type, sets, minutes, muscles, tone, cap, status, onOpen }: DayTileProps) {
  const over = muscles.some((m) => m.over)
  return (
    <button
      type="button"
      className={`mz-dtile mz-dtile-${tone}${over ? ' mz-dtile-warn' : ''}`}
      aria-label={`${day} · ${type} nap`}
      onClick={onOpen}
    >
      <span className="mz-dtile-head">
        <span className="mz-grow">
          <span className="mz-dtile-dl">{day}</span>
          <span className="mz-dtile-tt">{type} nap</span>
        </span>
        {status === 'now' && <span className="mz-dtile-st">ma</span>}
        {status === 'done' && <span className="mz-dtile-st mz-dtile-st-done">✓ kész</span>}
        {over && <span className="mz-dtile-dot" aria-hidden="true" />}
      </span>
      <span className="mz-dtile-cells">
        <span className="mz-dtile-cell"><b>{sets}</b><small>szett</small></span>
        <span className="mz-dtile-cell"><b>~{minutes}</b><small>perc</small></span>
      </span>
      <span className="mz-dtile-mlist">
        {muscles.map((m) => (
          <span className="mz-dtile-ml" key={m.label}>
            <span style={{ color: m.color }}>{m.label}</span>
            <span className="bar">
              <span
                style={{
                  display: 'block', height: '100%', borderRadius: 4,
                  width: `${Math.min(100, Math.round((m.sets / cap) * 100))}%`,
                  background: m.over ? 'var(--error)' : m.color,
                }}
              />
            </span>
            <span className="n">{m.sets}</span>
          </span>
        ))}
      </span>
    </button>
  )
}
