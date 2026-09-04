import type { DiffRow } from '@/features/me/logic/goalSuggestionDiff'

export function GoalSuggestionDiffGrid({ rows }: { rows: DiffRow[] }) {
  return <section className="gdiff-grid" aria-label="Javasolt változások">
    {rows.map(row => <article className={`gdiff-row gdiff-${row.status}`} data-field={row.field} key={row.field}>
      <div className="gdiff-label">{row.label}</div>
      <div className="gdiff-current"><small>Most</small><strong>{row.current}</strong></div>
      <span className="gdiff-arrow" aria-hidden="true">→</span>
      <div className="gdiff-proposed"><small>Javasolt</small><strong>{row.proposed}</strong></div>
      <div className="gdiff-delta">{row.delta}</div>
    </article>)}
  </section>
}
