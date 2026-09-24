// ============================================================
// Mezo · RunWeekStrip — the N-cell week progress strip for a running block.
// Üveg re-dress (mezo-me75u.4, prototype uveg-edzes-body.html `.wkstrip`): one
// flat numbered cell per week — done weeks sky-tinted, the current week filled
// sky with a glow, future weeks a quiet recess. Presentational; used by
// RunningPage's block cards (it sits inside their glass, so it stays flat).
// ============================================================
export function RunWeekStrip({ weeks, currentWeek }: { weeks: number; currentWeek: number }) {
  return (
    <div className="uvs-wkstrip" style={{ gridTemplateColumns: `repeat(${Math.max(1, weeks)}, minmax(0, 1fr))` }}>
      {Array.from({ length: weeks }, (_, i) => {
        const n = i + 1
        const state = n < currentWeek ? 'past' : n === currentWeek ? 'now' : 'future'
        return (
          <i key={n} className={`is-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            {n}
          </i>
        )
      })}
    </div>
  )
}
