// ============================================================
// Mezo · RunWeekStrip — the N-segment week progress strip for a running
// block (reta-bar idiom). past = dim --info, now = glowing --info, future =
// faint surface-2. Presentational; mirrors the .wkstrip markup in the Futás
// mockups. Used by RunningView's hero cards.
// ============================================================
export function RunWeekStrip({ weeks, currentWeek }: { weeks: number; currentWeek: number }) {
  return (
    <div className="row" style={{ gap: 3, height: 6, marginTop: 12 }}>
      {Array.from({ length: weeks }, (_, i) => {
        const n = i + 1
        const state = n < currentWeek ? 'past' : n === currentWeek ? 'now' : 'future'
        return (
          <span
            key={n}
            style={{
              flex: 1,
              borderRadius: 1,
              background:
                state === 'now'
                  ? 'var(--info)'
                  : state === 'past'
                    ? 'color-mix(in srgb, var(--info) 50%, var(--surface-2))'
                    : 'var(--surface-2)',
              opacity: state === 'future' ? 0.5 : 1,
              boxShadow: state === 'now' ? '0 0 8px var(--info)' : 'none',
            }}
          />
        )
      })}
    </div>
  )
}
