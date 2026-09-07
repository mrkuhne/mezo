// ============================================================
// Mezo · TestPlanTiles — a laborfüzet „A teszt-terv" szekciója (Reflexió S6, mezo-eq85.6)
// Vizuális igazság: docs/design_2.0/prototypes/eszrevetelek.html #labScreen `.plan-grid`
// + `.plan-strip`. A terv ELŐRE rögzített (falszifikálhatóság): a két csempe és a négy
// szám mind a `testPlan`-ből jön, sosem a mai adatból — így nem lehet utólag kitalálni.
// ============================================================
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import type { MetricDomain, PatternMetricValueKind, PatternMonitorPair, PatternTestPlan } from '@/data/types'

/** Domén → clay szimbólum. Reflexió-sorozat lehet `people:`/`topic:` kulcs is (domén `mind`),
 *  ezért a doménre képezünk, nem a metrika-katalógusra (az ilyen kulcsra nem is találna). */
const DOMAIN_CLAY: Record<MetricDomain, ClayIconName> = {
  sleep: 'i-alvas',
  train: 'i-edzes',
  fuel: 'i-fuel',
  mind: 'i-naplo',
  body: 'i-suly',
  other: 'i-eletjel',
}

function valueKindLine(kind: PatternMetricValueKind | undefined): string {
  if (kind === 'binary') return 'napi jel · 0 / 1'
  if (kind === 'clock_hour') return 'napi időpont'
  return 'napi érték'
}

function PlanTile({ side, label, name, kind, domain }: {
  side: 'a' | 'b'
  label: string
  name: string
  kind: PatternMetricValueKind | undefined
  domain: MetricDomain | undefined
}) {
  return (
    <article className={`pdt-plan-tile pdt-plan-tile-${side}`}>
      <span className="pdt-plan-src"><ClayIcon name={DOMAIN_CLAY[domain ?? 'other']} size={18} /></span>
      <div className="pdt-tile-label">{label}</div>
      <div className="pdt-plan-nm">{name}</div>
      <div className="pdt-plan-sb">{valueKindLine(kind)}</div>
    </article>
  )
}

/** A `pair` a drótról MINDIG megjön (`PatternPairDetail.pair` nem nullázható) — reflexiós sorra a
 *  backend a teszt-tervből épít szintetikus párt, ezért az érték-fajta és a domén sosem hiányzik. */
export function TestPlanTiles({ plan, pair }: { plan: PatternTestPlan; pair: PatternMonitorPair }) {
  return (
    <>
      <section className="pdt-plan-grid" aria-label="A teszt-terv két fele">
        <PlanTile side="a" label="Ha…" name={plan.seriesALabel}
          kind={pair.metricAValueKind} domain={pair.metricADomain} />
        <PlanTile side="b" label="…akkor" name={plan.seriesBLabel}
          kind={pair.metricBValueKind} domain={pair.metricBDomain} />
      </section>
      <div className="pdt-plan-strip">
        <span><b>+{plan.lagDays} nap</b>eltolás</span>
        <span><b>{plan.minN} nap</b>kell minimum</span>
        <span><b>{plan.expectedDirection === 'positive' ? 'több' : 'kevesebb'}</b>várt irány</span>
        <span><b>{plan.windowDays} nap</b>ablak</span>
      </div>
    </>
  )
}
