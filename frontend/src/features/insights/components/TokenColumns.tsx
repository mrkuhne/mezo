import type { LlmUsageDay } from '@/data/types'

/** Napi token-oszlopok (üveg, mezo-me75u.8, prototípus `.tcols`): naponta EGY pár világító
 *  oszlop — bemenet (dv-lav) és kimenet (dv-sage) egymás mellett, közös skálán (a legnagyobb
 *  napi érték = teljes magasság), alatta a jelmagyarázat. */
export function TokenColumns({ days, ariaLabel }: { days: LlmUsageDay[]; ariaLabel: string }) {
  const max = Math.max(1, ...days.map((d) => Math.max(d.inputTokens, d.outputTokens)))
  const pct = (n: number) => `${Math.round((n / max) * 1000) / 10}%`

  return (
    <div className="mmr-tokens">
      <div className="mmr-tcols" role="img" aria-label={ariaLabel}>
        {days.map((day, i) => (
          <span key={day.date}>
            <i className="is-in" style={{ '--h': pct(day.inputTokens), '--i': i } as React.CSSProperties} />
            <i className="is-out" style={{ '--h': pct(day.outputTokens), '--i': i } as React.CSSProperties} />
          </span>
        ))}
      </div>
      <div className="mmr-tleg">
        <span className="is-in"><i aria-hidden="true" />bemenet</span>
        <span className="is-out"><i aria-hidden="true" />kimenet</span>
      </div>
    </div>
  )
}
