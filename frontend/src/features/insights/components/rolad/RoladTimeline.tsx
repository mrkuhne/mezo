import type { KnowledgeGraphNode } from '@/data/types'
import { formatCandidateDate, PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { huMonthDayAged } from '@/shared/lib/dates'
import { riseStyle } from './riseStyle'

const when = (n: KnowledgeGraphNode) => n.occurredOn ?? n.updatedAt.slice(0, 10)

function dateLabel(n: KnowledgeGraphNode): string {
  if (n.kind === 'SEASON' && n.occurredOn) return formatCandidateDate('SEASON', n.occurredOn)
  return huMonthDayAged(when(n))
}

/**
 * Rólad (U9b, mezo-zpxv7): „Életesemények” — the accepted life events and seasons as one amber
 * glass card of flat timeline rows (the csapatfal `.lifer` row), newest happening first. The
 * profile node is not a life event. Nothing accepted yet → the section is absent.
 */
export function RoladTimeline({ nodes, delay = 0 }: { nodes: KnowledgeGraphNode[]; delay?: number }) {
  const rows = nodes
    .filter((n) => (n.kind === 'LIFE_EVENT' || n.kind === 'SEASON') && n.sourceKind !== PROFILE_SOURCE_KIND)
    .sort((a, b) => when(b).localeCompare(when(a)))
  if (rows.length === 0) return null
  return (
    <section aria-labelledby="kr9-life-h">
      <div className="tf-sec"><h2 id="kr9-life-h">Életesemények</h2></div>
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
    </section>
  )
}
