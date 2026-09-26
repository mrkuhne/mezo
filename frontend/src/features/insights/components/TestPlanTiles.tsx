// ============================================================
// Mezo · TestPlanTiles — a laborfüzet „A teszt-terv" szekciója (Reflexió S6, mezo-eq85.6)
// Vizuális igazság (üvegben, mezo-me75u.13): docs/design_2.0/prototypes/uveg-uzenofal.html
// #minta/viz `.plan2` + `.pstrip` — EGY lapos panel, benne a két lapos csempe (HA… / …AKKOR — nyíl nélkül, mezo-0469)
// és a négy szám, a minimum kiemelve. A terv ELŐRE rögzített (falszifikálhatóság): a két
// csempe és a négy szám mind a `testPlan`-ből jön, sosem a mai adatból.
// ============================================================
import { Icon3D } from '@/shared/ui/clay'
import { PATTERN_DOMAIN_ART } from '@/features/insights/components/PatternDomainMark'
import type { MetricDomain, PatternMetricValueKind, PatternMonitorPair, PatternTestPlan } from '@/data/types'

/** Mit nézünk meg minden nap ennél a jelnél — köznyelven, kód-jelölés nélkül (mezo-0469). */
function valueKindLine(kind: PatternMetricValueKind | undefined): string {
  if (kind === 'binary') return 'megtörtént-e aznap'
  if (kind === 'clock_hour') return 'hánykor volt'
  return 'mennyi volt aznap'
}

/** Mikor nézzük a hatást — „+1 nap eltolás" helyett. */
function lagWord(lagDays: number): string {
  if (lagDays === 0) return 'aznap'
  if (lagDays === 1) return 'másnap'
  return `${lagDays} nap múlva`
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
      <span className="pdt-plan-src"><Icon3D name={PATTERN_DOMAIN_ART[domain ?? 'other']} size={28} /></span>
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
    <section className="pdt-flat pdt-plan rise" aria-label="A teszt-terv">
      <div className="pdt-plan-grid" role="group" aria-label="A teszt-terv két fele">
        <PlanTile side="a" label="Ha…" name={plan.seriesALabel}
          kind={pair.metricAValueKind} domain={pair.metricADomain} />
        <PlanTile side="b" label="…akkor" name={plan.seriesBLabel}
          kind={pair.metricBValueKind} domain={pair.metricBDomain} />
      </div>
      <div className="pdt-plan-strip">
        <span className="is-word"><b>{lagWord(plan.lagDays)}</b>nézem a hatást</span>
        <span className="is-key"><b>{plan.minN}<i> nap</i></b>kell a döntéshez</span>
        <span className="is-word"><b>{plan.expectedDirection === 'positive' ? 'több' : 'kevesebb'}</b>amit várok</span>
        <span><b>{plan.windowDays}<i> nap</i></b>ennyit nézek vissza</span>
      </div>
    </section>
  )
}
