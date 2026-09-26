import { Link } from 'react-router-dom'
import type { KnowledgeFact } from '@/data/types'
import { factOwnerTag, topRoladFacts } from '@/features/insights/logic/roladCopy'
import { originChipLabel } from '@/features/insights/logic/factCopy'
import { lastSeenLabel } from '@/features/insights/logic/metricFormat'
import { localDateString } from '@/shared/lib/dates'
import { Icon3D } from '@/shared/ui/clay'
import { riseStyle } from './riseStyle'

function factWhen(f: KnowledgeFact): string {
  return lastSeenLabel(localDateString(new Date(f.lastReinforcedAt ?? f.createdAt))) ?? ''
}

/**
 * Rólad (U9b, mezo-zpxv7): „A tények rólad” — the four freshest active facts, each a glass case
 * in its owner's accent (TŐLED gold for what the user wrote), and the door to the full Tények
 * view. Hidden when the companion is off (`degraded`) or nothing is active: no fabricated zero.
 */
export function RoladFacts({ facts, degraded, delay = 0 }: { facts: KnowledgeFact[]; degraded: boolean; delay?: number }) {
  const active = facts.filter((f) => f.active)
  if (degraded || active.length === 0) return null
  const top = topRoladFacts(facts)
  return (
    <section aria-labelledby="kr9-facts-h">
      <div className="tf-sec"><h2 id="kr9-facts-h">A tények rólad</h2><span className="tf-hint">{active.length} AKTÍV</span></div>
      <div className="tf-rows">
        {top.map((f, i) => {
          const tag = factOwnerTag(f)
          return (
            <div
              key={f.id}
              className={`glass tf-case tf-c-${tag.accent} tf-s-${tag.accent} kr9-fact rise`}
              style={riseStyle(delay + i * 45)}
              data-rolad-fact
            >
              <span className="tf-crow">
                <span className="tf-st">{tag.label}</span>
                <em>{originChipLabel(f.source)} · {factWhen(f)}</em>
              </span>
              <span className="tf-cmain"><span className="tf-ctxt"><span className="tf-ctitle">{f.text}</span></span></span>
            </div>
          )
        })}
        <Link
          to="/mezo/knowledge?view=tenyek"
          className="glass tf-case tf-c-rose tf-s-slate kr9-factdoor rise"
          style={riseStyle(delay + top.length * 45)}
        >
          <span className="tf-cmain">
            <Icon3D name="t-book" size={36} />
            <span className="tf-ctxt">
              <span className="tf-ctitle">Mind a {facts.length} tény</span>
              <span className="tf-csub">kereséssel, forrással és Elhallgattatom-kapcsolóval</span>
            </span>
            <span className="tf-chev" aria-hidden="true">›</span>
          </span>
        </Link>
      </div>
    </section>
  )
}
