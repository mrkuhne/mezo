import type { CSSProperties } from 'react'
import { buildArcPoints, pointXY } from '@/features/today/logic/dayArc'
import type { ArcPoint } from '@/features/today/logic/dayArc'
import { useCheckins, useDayRecap } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { ContentIcon, Icon3D } from '@/shared/ui/clay'
import type { ClayIconName, Icon3DName } from '@/shared/ui/clay'

// Same P0(22,100) C(182,-28) P2(342,100) Bézier as dayArc.ts/DayArc.tsx. The np-draw
// reveal's stroke-dasharray (400, rounded up from the path's real length) lives in
// prototype.css's `.rz-arc-path` — a static one-shot value, mirroring the `.rz-ring`
// precedent (ReleaseStep) rather than an inline attribute.
const ARC = 'M22 100 Q182 -28 342 100'

// Üveg (mezo-me75u.3): recap icons wear the Titanium 3D set. `CLAY_TO_3D` covers every
// context-free meaning; `i-sport` is ambiguous app-wide (Aktivitás vs. the Sport tile), and here
// it is always a logged or scheduled sport session — the volleyball (bible rule 7).
const EVENT_ICON: Partial<Record<ClayIconName, Icon3DName>> = { 'i-sport': 't-volley' }

/** The recap data still speaks the text glyph „✓" for "done" (useDayRecap); the view shows
 *  that meaning as the 3D tick instead, so the glyph is stripped from the visible meta. */
const stripTick = (meta: string) => meta.replace(/\s*✓\s*/g, ' ').trim()

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
        <defs>
          <linearGradient id="rz-arc-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--dv-amber)" />
            <stop offset="1" stopColor="var(--dv-lav)" />
          </linearGradient>
        </defs>
        <path d={ARC} className="rz-arc-track" />
        <path d={ARC} className="rz-arc-path" stroke="url(#rz-arc-grad)" />
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
        {events.map((ev, i) => {
          const meta = stripTick(ev.meta)
          // The tick shows only where the data said „✓" on a done row (a finished workout, a
          // reflected focus); a glyph-only meta then reads „kész", as on the approved prototype.
          const ticked = ev.done && ev.meta.includes('✓')
          return (
            <div key={`${ev.icon}-${ev.label}-${i}`} className="rz-ev uv-flat np-anim" style={{ '--i': i } as CSSProperties}>
              <span className="rz-ev-icon" aria-hidden="true"><ContentIcon name={EVENT_ICON[ev.icon] ?? ev.icon} size={32} /></span>
              <span className="rz-ev-label">{ev.label}</span>
              <span className={ev.done ? 'rz-ev-meta ok' : 'rz-ev-meta'}>
                {ticked && <Icon3D name="t-tick" size={18} className="rz-ev-tick" />}
                {ticked ? meta || 'kész' : meta}
              </span>
            </div>
          )
        })}
      </div>
      <button className="rz-cta" onClick={onNext}>Tovább</button>
    </div>
  )
}
