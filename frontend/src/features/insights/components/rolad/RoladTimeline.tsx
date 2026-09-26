import type { KnowledgeGraphNode } from '@/data/types'
import { formatCandidateDate, PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { huMonthDayAged, localDateString } from '@/shared/lib/dates'
import { GhostState } from '@/shared/ui/GhostState'
import { ROLAD_COPY } from '@/features/insights/logic/roladCopy'
import { riseStyle } from './riseStyle'

// mezo-plbev item 6: `updatedAt` is a UTC instant — slicing its first 10 chars reads the UTC
// calendar day, which rolls an evening entry (in any positive-offset timezone) to tomorrow. Read
// the LOCAL day instead, the same `localDateString` idiom RoladFacts already uses.
const when = (n: KnowledgeGraphNode) => n.occurredOn ?? localDateString(new Date(n.updatedAt))

function dateLabel(n: KnowledgeGraphNode): string {
  if (n.kind === 'SEASON' && n.occurredOn) return formatCandidateDate('SEASON', n.occurredOn)
  return huMonthDayAged(when(n))
}

/**
 * Rólad (U9b, mezo-zpxv7): „Életesemények” — the accepted life events and seasons as one amber
 * glass card of flat timeline rows (the csapatfal `.lifer` row), newest happening first. The
 * profile node is not a life event. Nothing accepted yet → the section is absent.
 */
export function RoladTimeline({ nodes, isError, onRetry, delay = 0 }: {
  nodes: KnowledgeGraphNode[]
  isError?: boolean
  onRetry?: () => void
  delay?: number
}) {
  const rows = nodes
    .filter((n) => (n.kind === 'LIFE_EVENT' || n.kind === 'SEASON') && n.sourceKind !== PROFILE_SOURCE_KIND)
    .sort((a, b) => when(b).localeCompare(when(a)))
  // mezo-plbev item 2: pending is fine as "nothing" (this section never shows a fabricated
  // count) — only a genuine failure needs an honest state, since staying silent would hide a
  // real outage behind what looks like "no life events yet".
  if (!isError && rows.length === 0) return null
  return (
    <section aria-labelledby="kr9-life-h">
      <div className="tf-sec"><h2 id="kr9-life-h">Életesemények</h2></div>
      {isError ? (
        <GhostState message={ROLAD_COPY.lifeEventsError} ctaLabel={ROLAD_COPY.retry} onCta={onRetry} />
      ) : (
        <div className="tf-rows">
          <ul className="glass tf-case tf-c-gold kr9-life rise" style={riseStyle(delay)}>
            {rows.map((n) => (
              <li key={n.id} className={`kr9-lifer${n.kind === 'SEASON' ? ' is-season' : ''}`} data-life-row>
                <u aria-hidden="true" />
                <span className="kr9-lifetx">
                  <b>{n.title}</b>
                  {n.summary && <small>{n.summary}</small>}
                </span>
                <em>{dateLabel(n)}</em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
