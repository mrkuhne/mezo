import { affectColor } from '@/data/me/people'
import type { PersonEntry } from '@/data/types'

/** Napiv row card (mezo-8141 Task 7) — the affect color still rings the avatar and
 * tints the sparkline/mention count; the flat left accent bar the old vocabulary
 * used for the same signal is dropped (no left bars anywhere in the Napiv idiom). */
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
      style={{ background: 'var(--surface)', borderRadius: 18, boxShadow: 'var(--np-shadow-row)', border: 0, cursor: 'pointer', padding: 14, width: '100%', textAlign: 'left' }}
    >
      <div className="row gap-md" style={{ alignItems: 'center' }}>
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
          }}
        >
          {person.initial}
        </div>

        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{person.name}</span>
            <span style={{ fontSize: 9, fontWeight: 800, color }}>{person.mentionsThisWeek}× · hét</span>
          </div>
          <span
            className="text-tertiary"
            style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}
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
            />
            {person.affectTrend.map((v, i) => {
              if (i !== person.affectTrend.length - 1) return null
              const x = (i / (person.affectTrend.length - 1)) * sparkW
              const y = sparkH - ((v - min) / range) * sparkH
              return <circle key={i} cx={x} cy={y} r="2" fill={color} />
            })}
          </svg>
          <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-tertiary)' }}>
            {person.mentionCount} mention
          </span>
        </div>
      </div>
    </button>
  )
}
