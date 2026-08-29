import type { GoalTimelineResponse, GoalPlanLinkResponse } from '@/data/me/goalLinkApi'

// The signature view of the goal command-center: the goal is a horizontal time
// axis (a week ruler 1..timeline.weeks); meso/run plans + the ambient volleyball
// band are lanes ON it, positioned by CSS grid-column (startWeek..endWeek+1).
// Pure presentational — consumes the raw `GoalTimelineResponse` (LinkedMeso has
// no week-offset/discipline data). Parent passes `ambient` (the volleyball band)
// + an optional `onDetach` so each plan bar can expose a detach affordance.
// Mozaik re-face (mezo-d20.6.2): prototype en-body #page-cel's GYM·MESO /
// FUTÁS·BLOKK / RÖPLABDA·AMBIENT band, wrapped in the .gc-tlband strip. The
// week ruler + grid-column math + the detach affordance carry over unchanged.

type Ambient = { label?: string; sessionsPerWeek?: number }

interface GoalTimelineProps {
  timeline: GoalTimelineResponse
  onDetach?: (linkId: string) => void
  ambient?: Ambient
}

// CSS grid lines are 1-based; a bar from W1..W6 spans grid lines 1→7 (covers
// columns 1..6), so the end line is `endWeek + 1`. Matches the mockup math
// (6-week meso at W1 = `grid-column:1/7`; W7..8 gap = `grid-column:7/9`).
function gridColumn(startWeek: number, endWeek: number): string {
  return `${startWeek} / ${endWeek + 1}`
}

function laneStyle(weeks: number): React.CSSProperties {
  return { gridTemplateColumns: `repeat(${weeks}, 1fr)` }
}

function PlanBar({
  link,
  fill,
  onDetach,
}: {
  link: GoalPlanLinkResponse
  fill: string
  onDetach?: (linkId: string) => void
}) {
  return (
    <div className="gc-bar" style={{ gridColumn: gridColumn(link.startWeek, link.endWeek), background: fill }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {link.plan.title} · {link.plan.weeks} hét
      </span>
      {onDetach && (
        <button
          type="button"
          className="gc-detach"
          aria-label={`${link.plan.title} leválasztás`}
          onClick={() => onDetach(link.id)}
        >
          ✕
        </button>
      )}
    </div>
  )
}

export function GoalTimeline({ timeline, onDetach, ambient }: GoalTimelineProps) {
  const { weeks } = timeline
  const mesoLinks = timeline.links.filter((l) => l.planType === 'mesocycle')
  const runLinks = timeline.links.filter((l) => l.planType === 'running_block')

  const ambientLabel = ambient?.label ?? 'BVSC'
  const ambientSessions = ambient?.sessionsPerWeek
  const ambientBandText = ambientSessions
    ? `${ambientLabel} · ${ambientSessions}×/hét · végig`
    : `${ambientLabel} · végig`

  return (
    <div className="gc-tlband">
      {/* WEEK RULER — parameterized to timeline.weeks (mockup hardcodes 8) */}
      <div className="gc-lane" style={laneStyle(weeks)}>
        {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
          <div
            key={w}
            data-testid={`ruler-week-${w}`}
            style={{ textAlign: 'center', fontSize: 8, fontWeight: 700, color: 'var(--mz-ink-mut)' }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* GYM LANE — mesocycle bars tile the window; uncovered windows → gap chips */}
      <div className="gc-lane-label">Gym · meso</div>
      <div className="gc-lane" style={laneStyle(weeks)}>
        {mesoLinks.map((link) => (
          <PlanBar
            key={link.id}
            link={link}
            fill="linear-gradient(135deg, var(--coral), var(--tag-gym))"
            onDetach={onDetach}
          />
        ))}
        {timeline.gaps.map((gap) => (
          <div
            key={`gap-${gap.fromWeek}-${gap.toWeek}`}
            className="gc-bar gap"
            style={{ gridColumn: gridColumn(gap.fromWeek, gap.toWeek) }}
          >
            ⚠ W{gap.fromWeek}–{gap.toWeek} fedezetlen
          </div>
        ))}
      </div>

      {/* RUN LANE — episodic running blocks */}
      <div className="gc-lane-label">Futás · blokk</div>
      <div className="gc-lane" style={laneStyle(weeks)}>
        {runLinks.length === 0 ? (
          <div className="gc-bar empty" style={{ gridColumn: gridColumn(1, weeks) }}>
            nincs futás
          </div>
        ) : (
          runLinks.map((link) => (
            <PlanBar
              key={link.id}
              link={link}
              fill="linear-gradient(135deg, var(--sky), var(--tag-run))"
              onDetach={onDetach}
            />
          ))
        )}
      </div>

      {/* VOLLEYBALL LANE — constant ambient band spanning the whole window, read-only */}
      <div className="gc-lane-label">Röplabda</div>
      <div className="gc-lane" style={laneStyle(weeks)}>
        <div className="gc-bar amb" style={{ gridColumn: gridColumn(1, weeks) }}>
          {ambientBandText}
        </div>
      </div>
    </div>
  )
}
