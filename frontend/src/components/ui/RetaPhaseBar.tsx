const RETA_COLORS = [
  'var(--reta-d1)', 'var(--reta-d2)', 'var(--reta-d3)',
  'var(--reta-d4)', 'var(--reta-d5)', 'var(--reta-d6)', 'var(--reta-d7)',
] as const

export function RetaPhaseBar({ day }: { day: number }) {
  return (
    <div className="reta-bar" title={`Retatrutide · Day ${day}/7`}>
      {[1, 2, 3, 4, 5, 6, 7].map(d => (
        <div
          key={d}
          className={'reta-seg' + (d === day ? ' active' : '') + (d < day ? ' past' : '')}
          style={{ background: d <= day ? RETA_COLORS[d - 1] : 'var(--surface-2)', color: RETA_COLORS[d - 1] }}
        />
      ))}
    </div>
  )
}
