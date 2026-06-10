import { affectColor } from '@/data/people'
import type { PersonEntry } from '@/data/types'

export function PersonCard({ person, onTap }: { person: PersonEntry; onTap?: () => void }) {
  const color = affectColor(person.affect_baseline)
  const sparkW = 60
  const sparkH = 18
  const max = Math.max(...person.affectTrend, 5)
  const min = Math.min(...person.affectTrend, 1)
  const range = Math.max(1, max - min)
  const sparkPath = person.affectTrend
    .map((v, i) => {
      const x = (i / (person.affectTrend.length - 1)) * sparkW
      const y = sparkH - ((v - min) / range) * sparkH
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)
    })
    .join(' ')

  return (
    <button
      onClick={onTap}
      className="card notch-4"
      style={{ padding: 14, width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: color }} />
      <div className="row gap-md" style={{ alignItems: 'center', paddingLeft: 8 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'var(--surface-2)',
            border: '1px solid ' + color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--ff-display)',
            fontSize: 18,
            fontWeight: 600,
            color,
            flexShrink: 0,
            boxShadow: 'inset 0 0 0 4px rgba(0,0,0,0.25)',
          }}
        >
          {person.initial}
        </div>

        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{person.name}</span>
            <span className="label-mono" style={{ fontSize: 9, color }}>{person.mentionsThisWeek}× · hét</span>
          </div>
          <span
            className="text-tertiary"
            style={{ fontSize: 10, fontFamily: 'var(--ff-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}
          >
            {person.relationshipHu}
          </span>
          <span className="text-secondary" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
            {person.lastMentionLabel}
          </span>
        </div>

        <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
          <svg width={sparkW} height={sparkH} style={{ display: 'block' }}>
            <path
              d={sparkPath}
              fill="none"
              stroke={color}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
              style={{ filter: `drop-shadow(0 0 4px ${color}55)` }}
            />
            {person.affectTrend.map((v, i) => {
              if (i !== person.affectTrend.length - 1) return null
              const x = (i / (person.affectTrend.length - 1)) * sparkW
              const y = sparkH - ((v - min) / range) * sparkH
              return <circle key={i} cx={x} cy={y} r="2" fill={color} />
            })}
          </svg>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
            {person.mentionCount} mention
          </span>
        </div>
      </div>
    </button>
  )
}
