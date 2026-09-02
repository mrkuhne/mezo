import { ClayIcon } from '@/shared/ui/clay'
import type { LifeGoalPillarResponse } from '@/data/lifegoal/lifegoalApi'
import { KIND_LABEL } from '@/features/me/logic/lifegoalLabels'

// Rule-line copy per pillar kind (prototype celok.html #page-g1 `.kind` chip text,
// e.g. "átlag · ≥ 160 g", "szokás · 4× / hét"). The scorer (slice 2) will replace the
// honest `—`/dashed-dot placeholders below — this line itself is a static contract
// summary, not a computed figure, so it renders now with no fabrication risk.
function ruleLine(p: LifeGoalPillarResponse): string {
  const r = p.rule ?? {}
  switch (p.kind) {
    case 'habit': return `${r.daysPerWeek ?? '?'}× / hét`
    case 'average': return `${r.windowDays ?? 7} nap átlag · ${r.comparator === 'lte' ? '≤' : '≥'} ${r.threshold ?? '?'}`
    case 'target': return `${r.startValue ?? '?'} → ${r.targetValue ?? '?'} · ${r.targetDate ?? 'nincs határidő'}`
    case 'baseline': return `saját ${r.windowDays ?? 28} napos medián`
    case 'linked': return 'súlycél · ütem'
    default: return ''
  }
}

// Pillar card (Task 10, mezo-iizd.1, prototype celok.html #page-g1 `.pillar`): honest empty
// state ONLY — the scorer (arrows, %, heatmap) lands in slice 2. Every numeric slot renders
// the placeholder em dash + "még nincs adat" copy so nothing here looks computed.
export function PillarCard({ pillar, delayMs }: { pillar: LifeGoalPillarResponse; delayMs: number }) {
  return (
    <div className={`lg-pillar rise ${pillar.active ? '' : 'off'}`} style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
      <div className="ph">
        <ClayIcon name="i-cel" size={22} />
        <span className="nm">{pillar.label}</span>
        <span className={`lg-kind ${pillar.kind === 'linked' ? 'link' : ''}`}>{KIND_LABEL[pillar.kind]} · {ruleLine(pillar)}</span>
        <span className="lg-arrow none" style={{ marginLeft: 'auto' }}><span className="g" style={{ fontSize: 18 }}>—</span></span>
      </div>
      <div className="val"><b style={{ color: '#A2958A' }}>—</b><small>még nincs adat · az első nyíl 5 adat-nap után</small></div>
      <div className="lg-wk7" style={{ marginTop: 8, '--d': `${delayMs}ms` } as React.CSSProperties}>
        {Array.from({ length: 7 }, (_, i) => <i key={i} className="n" style={{ '--i': i } as React.CSSProperties} />)}
        <span className="lbl">skill · {pillar.skillKey}</span>
      </div>
    </div>
  )
}
