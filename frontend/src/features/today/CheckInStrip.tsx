import type { CheckinSlot } from '@/data/types'

export function CheckInStrip({
  checkins,
  onCheckIn,
}: {
  checkins: CheckinSlot[]
  onCheckIn: (idx: number) => void
}) {
  return (
    <div style={{ padding: '4px 0 8px' }}>
      <div className="row" style={{ padding: '0 24px 8px', justifyContent: 'space-between' }}>
        <span className="eyebrow">Heartbeat · 4×/nap</span>
        <span className="eyebrow text-tertiary">{checkins.filter(c => c.state === 'done').length}/4 ma</span>
      </div>
      <div className="checkin-strip">
        {checkins.map((c, i) => {
          const avg = c.values
            ? Math.round((c.values.energy + (11 - c.values.stress) + c.values.body + c.values.mental) / 4)
            : null
          return (
            <button
              key={i}
              className={'checkin-slot notch-4 ' + c.state}
              onClick={() => onCheckIn(i)}
            >
              <div className="time">{c.time}</div>
              <div className="ico">
                {c.state === 'done' && avg !== null ? (
                  <span style={{ fontFamily: 'var(--ff-display)', fontSize: 16, color: 'var(--brand-glow)', letterSpacing: 0 }}>{avg}</span>
                ) : c.state === 'done' ? '✓ in'
                  : c.state === 'now' ? 'tap'
                  : c.state === 'skipped' ? '—' : '•'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
