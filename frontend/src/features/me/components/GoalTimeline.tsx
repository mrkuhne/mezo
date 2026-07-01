import type { GoalTimelineResponse, GoalPlanLinkResponse } from '@/data/me/goalLinkApi'

// The signature view of the goal command-center: the goal is a horizontal time
// axis (a week ruler 1..timeline.weeks); meso/run plans + the ambient volleyball
// band are lanes ON it, positioned by CSS grid-column (startWeek..endWeek+1).
// Pure presentational — consumes the raw `GoalTimelineResponse` (LinkedMeso has
// no week-offset/discipline data). Parent passes `ambient` (the volleyball band)
// + an optional `onDetach` so each plan bar can expose a detach affordance.
// Faithful to `.superpowers/brainstorm/8732-1781770664/content/goal-timeline.html`.

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

const TRACK_STYLE = (weeks: number): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${weeks}, 1fr)`,
  gap: 3,
  alignItems: 'center',
})

const BAR_BASE: React.CSSProperties = {
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  padding: '0 8px',
  fontFamily: 'var(--ff-mono)',
  fontSize: 9,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
}

function LaneLabel({ eyebrow, tag, tagColor }: { eyebrow: string; tag: string; tagColor?: string }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 5px' }}>
      <span className="eyebrow">{eyebrow}</span>
      <span
        className="tag"
        style={{
          fontFamily: 'var(--ff-mono)',
          fontSize: 8,
          letterSpacing: '.06em',
          padding: '1px 6px',
          border: '1px solid var(--border-subtle)',
          color: tagColor ?? 'var(--text-tertiary)',
          borderColor: tagColor
            ? `color-mix(in srgb, ${tagColor} 40%, transparent)`
            : 'var(--border-subtle)',
        }}
      >
        {tag}
      </span>
    </div>
  )
}

function PlanBar({
  link,
  fill,
  textColor,
  onDetach,
}: {
  link: GoalPlanLinkResponse
  fill: string
  textColor: string
  onDetach?: (linkId: string) => void
}) {
  return (
    <div
      className="notch-4"
      style={{ ...BAR_BASE, gridColumn: gridColumn(link.startWeek, link.endWeek), background: fill, color: textColor }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {link.plan.title} · {link.plan.weeks} hét
      </span>
      {onDetach && (
        <button
          type="button"
          aria-label={`${link.plan.title} leválasztás`}
          onClick={() => onDetach(link.id)}
          style={{
            flex: '0 0 auto',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            fontFamily: 'var(--ff-mono)',
            fontSize: 11,
            lineHeight: 1,
            padding: 0,
            opacity: 0.7,
          }}
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
    <div>
      {/* WEEK RULER — parameterized to timeline.weeks (mockup hardcodes 8) */}
      <div style={{ ...TRACK_STYLE(weeks), gap: 3, margin: '2px 0 3px' }}>
        {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
          <div
            key={w}
            data-testid={`ruler-week-${w}`}
            style={{
              textAlign: 'center',
              fontFamily: 'var(--ff-mono)',
              fontSize: 8,
              color: 'var(--text-quaternary)',
              padding: '2px 0',
            }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* GYM LANE — mesocycle bars tile the window; uncovered windows → gap chips */}
      <LaneLabel eyebrow="Gym · meso" tag="tile-olja az ablakot" />
      <div style={TRACK_STYLE(weeks)}>
        {mesoLinks.map((link) => (
          <PlanBar
            key={link.id}
            link={link}
            fill="linear-gradient(90deg, var(--brand-core), var(--brand-glow))"
            textColor="#04231f"
            onDetach={onDetach}
          />
        ))}
        {timeline.gaps.map((gap) => (
          <div
            key={`gap-${gap.fromWeek}-${gap.toWeek}`}
            style={{
              height: 24,
              gridColumn: gridColumn(gap.fromWeek, gap.toWeek),
              border: '1px dashed var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--ff-mono)',
              fontSize: 10,
              color: 'var(--warning)',
              background: 'rgba(245, 158, 11, 0.06)',
            }}
          >
            ⚠ W{gap.fromWeek}–{gap.toWeek} fedezetlen
          </div>
        ))}
      </div>

      {/* RUN LANE — episodic running blocks */}
      <LaneLabel eyebrow="Futás · blokk" tag="epizodikus" />
      <div style={TRACK_STYLE(weeks)}>
        {runLinks.length === 0 ? (
          <div
            style={{
              height: 24,
              gridColumn: gridColumn(1, weeks),
              background: 'transparent',
              border: '1px dashed var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--ff-mono)',
              fontSize: 8,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              opacity: 0.7,
            }}
          >
            nincs futás
          </div>
        ) : (
          runLinks.map((link) => (
            <PlanBar
              key={link.id}
              link={link}
              fill="linear-gradient(90deg, #3b82f6, var(--info))"
              textColor="#04122b"
              onDetach={onDetach}
            />
          ))
        )}
      </div>

      {/* VOLLEYBALL LANE — constant ambient band spanning the whole window, read-only */}
      <LaneLabel eyebrow="Röplabda" tag="ambient · konstans" tagColor="var(--cat-tendency)" />
      <div style={TRACK_STYLE(weeks)}>
        <div
          style={{
            height: 22,
            gridColumn: gridColumn(1, weeks),
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            padding: '0 9px',
            fontFamily: 'var(--ff-mono)',
            fontSize: 9,
            fontWeight: 600,
            background: 'color-mix(in srgb, var(--cat-tendency) 16%, transparent)',
            color: 'var(--cat-tendency)',
            border: '1px solid color-mix(in srgb, var(--cat-tendency) 30%, transparent)',
          }}
        >
          {ambientBandText}
        </div>
      </div>
      {/* The per-segment recept lane that used to be a G5 placeholder here now
          lives in GoalRecept (rendered by GoalsPage from the engine's
          prescription) — the timeline stays purely the time-axis lanes. (mezo-g1u) */}
    </div>
  )
}
