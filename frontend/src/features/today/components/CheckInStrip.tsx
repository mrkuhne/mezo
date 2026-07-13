import type { CheckinSlot } from '@/data/types'

export function CheckInStrip({
  checkins,
  onCheckIn,
}: {
  checkins: CheckinSlot[]
  onCheckIn: (idx: number) => void
}) {
  const doneCount = checkins.filter(c => c.state === 'done').length
  return (
    <div style={{ padding: '4px 24px 8px' }}>
      <div className="secthead-np">
        <h3>Hogy vagy ma?</h3>
        <span>{doneCount}/4</span>
      </div>
      <div className="beats">
        {checkins.map((c, i) => {
          const avg = c.values
            ? Math.round((c.values.energy + (11 - c.values.stress) + c.values.body + c.values.mental) / 4)
            : null
          return (
            <button
              key={i}
              type="button"
              className={'beat ' + c.state}
              onClick={() => onCheckIn(i)}
            >
              <div className="t">{c.time}</div>
              <div className="v">
                {c.state === 'done' ? (avg !== null ? avg : '✓')
                  : c.state === 'now' ? 'koppints'
                  : c.state === 'skipped' ? '—' : '·'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
