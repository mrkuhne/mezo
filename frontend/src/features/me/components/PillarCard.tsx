import { ClayIcon } from '@/shared/ui/clay'
import type { LifeGoalPillarResponse, PillarProgress } from '@/data/lifegoal/lifegoalApi'
import { ARROW_CLASS, ARROW_GLYPH, DOT_CLASS, KIND_LABEL } from '@/features/me/logic/lifegoalLabels'

// Rule-line copy per pillar kind (prototype celok.html #page-g1 `.kind` chip text,
// e.g. "átlag · ≥ 160 g", "szokás · 4× / hét"). The scorer (slice 2) will replace the
// honest `—`/dashed-dot placeholders below — this line itself is a static contract
// summary, not a computed figure, so it renders now with no fabrication risk.
function ruleLine(p: LifeGoalPillarResponse): string {
  const r = p.rule ?? {}
  switch (p.kind) {
    case 'habit': return `${r.daysPerWeek ?? '—'}× / hét`
    case 'average': return `${r.windowDays ?? 7} nap átlag · ${r.comparator === 'lte' ? '≤' : '≥'} ${r.threshold ?? '—'}`
    case 'target': return `${r.startValue ?? '—'} → ${r.targetValue ?? '—'} · ${r.targetDate ?? 'nincs határidő'}`
    case 'baseline': return `saját ${r.windowDays ?? 28} napos medián`
    case 'linked': return 'súlycél · ütem'
    default: return ''
  }
}

// Task 9 (mezo-iizd.5): the value row once `progress` resolves — currentValue plus a
// reference (the rule's threshold/expected/median), or the down-arrow habit exception.
function valueLine(pillar: LifeGoalPillarResponse, progress: PillarProgress): string {
  if (progress.arrow === 'down' && pillar.kind === 'habit' && progress.missingHitDays !== undefined) {
    return `még ${progress.missingHitDays} hit-nap a fordulásig`
  }
  const ref = progress.referenceValue !== undefined ? ` · cél ${progress.referenceValue}` : ''
  return `${ruleLine(pillar)}${ref}`
}

// Pillar card (Task 10, mezo-iizd.1 → live progress in Task 10, mezo-iizd.5, prototype
// celok.html #page-g1 `.pillar`): `progress` undefined renders the honest empty state
// (every numeric slot `—` + "még nincs adat" — mock mode always has data, real mode shows
// this only under its loading window); an `insufficient` arrow renders the SAME honest
// state even once `progress` resolves, on purpose — too little data must never read as a
// direction. `period` toggles the week 7-dot view vs. the month 28-cell heatmap, both fed
// by the same `progress.days` (Task 9's Hét/Hónap chips, CelPage-driven).
export function PillarCard({
  pillar, progress, delayMs, period = 'week',
}: {
  pillar: LifeGoalPillarResponse
  progress?: PillarProgress
  delayMs: number
  period?: 'week' | 'month'
}) {
  const honest = !progress || progress.arrow === 'insufficient'
  const arrowClass = honest ? 'none' : ARROW_CLASS[progress!.arrow]
  const arrowGlyph = honest ? '—' : ARROW_GLYPH[progress!.arrow]

  return (
    <div className={`lg-pillar rise ${pillar.active ? '' : 'off'}`} style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
      <div className="ph">
        <ClayIcon name="i-cel" size={22} />
        <span className="nm">{pillar.label}</span>
        <span className={`lg-kind ${pillar.kind === 'linked' ? 'link' : ''}`}>{KIND_LABEL[pillar.kind]} · {ruleLine(pillar)}</span>
        <span className={`lg-arrow ${arrowClass}`} style={{ marginLeft: 'auto' }}><span className="g" style={{ fontSize: 18 }}>{arrowGlyph}</span></span>
      </div>
      {honest
        ? <div className="val"><b style={{ color: '#A2958A' }}>—</b><small>még nincs adat · az első nyíl 5 adat-nap után</small></div>
        : <div className="val"><b>{progress!.currentValue ?? '—'}</b><small>{valueLine(pillar, progress!)}</small></div>}
      {period === 'month' && progress
        ? (
          <div className="lg-hm" style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
            {progress.days.map((d, i) => <i key={d.day} className={DOT_CLASS[d.status]} style={{ '--i': i } as React.CSSProperties} />)}
          </div>
        )
        : (
          <div className="lg-wk7" style={{ marginTop: 8, '--d': `${delayMs}ms` } as React.CSSProperties}>
            {(progress ? progress.days.slice(-7) : Array.from({ length: 7 }, () => null)).map((d, i) => (
              <i key={d?.day ?? i} className={d ? DOT_CLASS[d.status] : 'n'} style={{ '--i': i } as React.CSSProperties} />
            ))}
            <span className="lbl">skill · {pillar.skillKey}</span>
          </div>
        )}
    </div>
  )
}
