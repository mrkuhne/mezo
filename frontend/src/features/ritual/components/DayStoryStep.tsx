import type { CSSProperties } from 'react'
import { buildArcPoints, pointXY } from '@/features/today/logic/dayArc'
import type { ArcPoint } from '@/features/today/logic/dayArc'
import { useCheckins, useDayRecap } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { ClayIcon } from '@/shared/ui/clay'

// Same P0(22,100) C(182,-28) P2(342,100) Bézier as dayArc.ts/DayArc.tsx. The np-draw
// reveal's stroke-dasharray (400, rounded up from the path's real length) lives in
// prototype.css's `.rz-arc-path` — a static one-shot value, mirroring the `.rz-ring`
// precedent (ReleaseStep) rather than an inline attribute.
const ARC = 'M22 100 Q182 -28 342 100'

// Reuses the DayArc.tsx state→color mapping idiom (done=sage fill, now/pending/sleep=
// hollow ring), rz-prefixed for the Ritual dark canvas. `workout` is mapped for type
// completeness only — buildArcPoints never emits it here (workoutTime is always null,
// see below), the workout shows up as a recap event row instead.
const DOT_CLASS: Record<ArcPoint['kind'], string> = {
  'checkin-done': 'rz-arc-dot rz-arc-checkin-done',
  'checkin-now': 'rz-arc-dot rz-arc-checkin-now',
  'checkin-pending': 'rz-arc-dot rz-arc-checkin-pending',
  workout: 'rz-arc-dot rz-arc-workout',
  sleep: 'rz-arc-dot rz-arc-sleep',
}

/**
 * Napzárás act 2 — A napod íve (mezo-ilsj, spec §4). Redraws the Today signature arc
 * (dayArc.ts's Bézier, buildArcPoints/pointXY reused as-is) with the day's check-in
 * beats only — `workoutTime: null` is a deliberate simplification: the ritual arc is a
 * retrospective recap, not the live Today dial, and the workout already gets its own
 * `.rz-ev` row below from `useDayRecap`, so a second workout dot would be redundant.
 * On a thin day (ADR 0010) this NEVER renders a "nothing happened" gap list — it shows
 * the soft acceptance line above whatever recap events DO exist.
 */
export function DayStoryStep({ onNext }: { onNext: () => void }) {
  const date = localDateString()
  const { checkins } = useCheckins()
  const { events, thinDay } = useDayRecap(date)
  const points = buildArcPoints({ checkins, workoutTime: null })

  return (
    <div className="rz-act rz-story">
      <div className="rz-story-eyebrow">A napod íve</div>
      <svg className="rz-arc" viewBox="0 0 364 120" role="img" aria-label="A napod íve — összegzés">
        <path d={ARC} className="rz-arc-path" />
        {points.map((p, i) => {
          const { x, y } = pointXY(p.t)
          return (
            <circle
              key={`${p.kind}-${p.label}`}
              className={DOT_CLASS[p.kind]}
              cx={x}
              cy={y}
              r="6"
              style={{ animationDelay: `${i * 140}ms` }}
            />
          )
        })}
      </svg>
      {thinDay && <p className="rz-thin">Ma ennyi fért bele. Az is számít.</p>}
      <div className="rz-events">
        {events.map((ev, i) => (
          <div key={`${ev.icon}-${ev.label}-${i}`} className="rz-ev rz-nw np-anim" style={{ '--i': i } as CSSProperties}>
            <span className="rz-ev-icon rz-nw-spot" aria-hidden="true"><ClayIcon name={ev.icon} size={19} /></span>
            <span className="rz-ev-label">{ev.label}</span>
            <span className={ev.done ? 'rz-ev-meta ok' : 'rz-ev-meta'}>{ev.meta}</span>
          </div>
        ))}
      </div>
      <button className="rz-cta" onClick={onNext}>Tovább</button>
    </div>
  )
}
