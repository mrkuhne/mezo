import type { GymScheduleDay, VolleyballSession } from '@/data/types'

const HOURS_START = 6
const TOTAL = 16 // 06 → 22

function pctFromTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return Math.max(0, Math.min(100, ((h + m / 60 - HOURS_START) / TOTAL) * 100))
}

function widthForMins(mins: number): number {
  return (mins / 60 / TOTAL) * 100
}

function WeekDayRow({ gym, vb }: { gym: GymScheduleDay; vb: VolleyballSession | undefined }) {
  const isToday = gym.today === true

  const hasGym = gym.active && gym.time != null && gym.duration != null
  const gymStart = hasGym ? pctFromTime(gym.time as string) : null
  const gymWidth = hasGym ? widthForMins(gym.duration as number) : null
  const vbStart = vb ? pctFromTime(vb.time) : null
  const vbWidth = vb ? widthForMins(vb.duration) : null

  const lateVb = vb != null && parseInt(vb.time) >= 18
  const kitchenClose = lateVb ? '21:30' : '21:00'
  const kitchenPct = pctFromTime(kitchenClose)
  const coffeePct = pctFromTime('14:00')

  const dayColor = isToday ? 'var(--brand-glow)' : 'var(--text-secondary)'
  const isRest = !gym.active && !vb

  return (
    <div className="row" style={{ gap: 12, alignItems: 'center' }}>
      {/* Day label */}
      <div className="col" style={{ width: 32, alignItems: 'center', flexShrink: 0 }}>
        <span
          className="label-mono"
          style={{ fontSize: 10, fontWeight: 600, color: dayColor, letterSpacing: '0.05em' }}
        >
          {gym.day}
        </span>
        {isToday && (
          <span
            className="label-mono"
            style={{ fontSize: 7, marginTop: 2, letterSpacing: '0.1em' }}
          >
            MA
          </span>
        )}
      </div>

      {/* Horizontal track */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        {/* Base track */}
        <div
          style={{
            height: 18,
            background: isToday
              ? 'color-mix(in srgb, var(--brand-glow) 5%, transparent)'
              : 'var(--surface-2)',
            border:
              '1px solid ' +
              (isToday
                ? 'color-mix(in srgb, var(--brand-glow) 20%, transparent)'
                : 'var(--border-subtle)'),
            position: 'relative',
            borderRadius: 2,
          }}
        >
          {/* Hour grid lines */}
          {[10, 14, 18].map((h) => (
            <div
              key={h}
              style={{
                position: 'absolute',
                left: ((h - HOURS_START) / TOTAL) * 100 + '%',
                top: 4,
                bottom: 4,
                width: 1,
                background: 'var(--border-subtle)',
              }}
            />
          ))}

          {/* Coffee cutoff (14:00) marker */}
          <div
            style={{
              position: 'absolute',
              left: coffeePct + '%',
              top: -3,
              bottom: -3,
              width: 2,
              background: 'var(--warning)',
              opacity: 0.4,
            }}
          />

          {/* Kitchen close marker */}
          {!isRest && (
            <div
              style={{
                position: 'absolute',
                left: kitchenPct + '%',
                top: -3,
                bottom: -3,
                width: 2,
                background: 'var(--info)',
                opacity: 0.65,
              }}
            />
          )}

          {/* Gym block */}
          {gymStart != null && gymWidth != null && (
            <div
              style={{
                position: 'absolute',
                left: gymStart + '%',
                width: Math.max(2, gymWidth) + '%',
                top: 2,
                bottom: 2,
                background: 'var(--brand-glow)',
                boxShadow: isToday
                  ? '0 0 8px color-mix(in srgb, var(--brand-glow) 50%, transparent)'
                  : '0 0 3px color-mix(in srgb, var(--brand-glow) 20%, transparent)',
                borderRadius: 1,
              }}
              title={gym.type + ' · ' + gym.time + ' · ' + gym.duration + 'p'}
            />
          )}

          {/* Volleyball block */}
          {vbStart != null && vbWidth != null && vb != null && (
            <div
              style={{
                position: 'absolute',
                left: vbStart + '%',
                width: Math.max(2, vbWidth) + '%',
                top: 2,
                bottom: 2,
                background: 'var(--cat-tendency)',
                boxShadow: '0 0 3px color-mix(in srgb, var(--cat-tendency) 30%, transparent)',
                borderRadius: 1,
              }}
              title={'Volleyball · ' + vb.time + ' · ' + vb.duration + 'p'}
            />
          )}

          {/* Rest day text */}
          {isRest && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--ff-mono)',
                fontSize: 9,
                color: 'var(--text-quaternary)',
                letterSpacing: '0.1em',
              }}
            >
              rest · maintenance
            </div>
          )}
        </div>
      </div>

      {/* Right-side compact summary */}
      <div className="col" style={{ width: 56, alignItems: 'flex-end', flexShrink: 0, gap: 1 }}>
        {gym.active && gym.time != null && (
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
            {gym.time}
          </span>
        )}
        {vb && (
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--cat-tendency)' }}>
            {vb.time}
          </span>
        )}
        {isRest && (
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-quaternary)' }}>
            —
          </span>
        )}
      </div>
    </div>
  )
}

export function WeekRhythmGrid({
  gymSchedule,
  volleyball,
}: {
  gymSchedule: GymScheduleDay[]
  volleyball: VolleyballSession[]
}) {
  return (
    <div style={{ padding: '0 24px 12px' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="eyebrow">Heti ritmus · 24h tengelyen</span>
        <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
          06 — 22
        </span>
      </div>

      <div
        className="card"
        style={{
          padding: '12px 14px 14px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          clipPath:
            'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
        }}
      >
        {/* Hours axis */}
        <div className="row" style={{ gap: 12, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ width: 32 }} />
          <div style={{ flex: 1, position: 'relative', height: 12 }}>
            {[6, 10, 14, 18, 22].map((h, i) => (
              <span
                key={h}
                style={{
                  position: 'absolute',
                  left: ((h - 6) / 16) * 100 + '%',
                  transform:
                    i === 0 ? 'translateX(0)' : i === 4 ? 'translateX(-100%)' : 'translateX(-50%)',
                  fontFamily: 'var(--ff-mono)',
                  fontSize: 8,
                  color: 'var(--text-quaternary)',
                  letterSpacing: '0.06em',
                }}
              >
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>

        {/* Day rows */}
        <div className="col" style={{ gap: 10 }}>
          {gymSchedule.map((gym) => {
            const vb = volleyball.find((v) => v.day === gym.day)
            return <WeekDayRow key={gym.day} gym={gym} vb={vb} />
          })}
        </div>

        {/* Legend */}
        <div
          className="row gap-md mt-md"
          style={{
            paddingTop: 10,
            borderTop: '1px solid var(--border-subtle)',
            fontFamily: 'var(--ff-mono)',
            fontSize: 9,
            color: 'var(--text-tertiary)',
            flexWrap: 'wrap',
          }}
        >
          <div className="row gap-xs" style={{ alignItems: 'center' }}>
            <span
              style={{ width: 12, height: 6, background: 'var(--brand-glow)', borderRadius: 1 }}
            />
            <span>gym</span>
          </div>
          <div className="row gap-xs" style={{ alignItems: 'center' }}>
            <span
              style={{ width: 12, height: 6, background: 'var(--cat-tendency)', borderRadius: 1 }}
            />
            <span>volleyball</span>
          </div>
          <div className="row gap-xs" style={{ alignItems: 'center' }}>
            <span style={{ width: 2, height: 8, background: 'var(--info)' }} />
            <span>kitchen close</span>
          </div>
          <div className="row gap-xs" style={{ alignItems: 'center' }}>
            <span style={{ width: 2, height: 8, background: 'var(--warning)' }} />
            <span>coffee cutoff 14:00</span>
          </div>
        </div>
      </div>
    </div>
  )
}
