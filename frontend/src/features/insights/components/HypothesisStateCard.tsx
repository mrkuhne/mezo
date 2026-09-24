// ============================================================
// Mezo · HypothesisStateCard — a laborfüzet állapot-kártyája (Reflexió S6, mezo-eq85.6)
// Vizuális igazság: docs/design_2.0/prototypes/eszrevetelek.html #labScreen `.state-card`.
// Poszter-anatómia: eyebrow + clay-lombik + állapot-pirula, alatta a hipotézis kérdése,
// EGY emberi válasz-mondat, a két csoport összevetése és a bizonyosság-gyűrű.
// A gyűrű száma a szerver DETERMINISZTIKUS `belief`-je — sosem LLM-becslés, és nyers
// r/p SOHA nem kerül a kártya arcára (az a `Háttér` fold dolga).
// ============================================================
import { ClayIcon } from '@/shared/ui/clay'
import { DOMAIN_META } from '@/features/insights/logic/domains'
import type { Pattern, PatternMonitorPair, PatternRowStatus, PatternStatus, PatternTestPlan } from '@/data/types'

/** A prototípus állapot-pirulái — a hat perzisztált sor-státusz emberi szava. */
const STATE_PILL: Record<PatternRowStatus, string> = {
  monitoring: 'FIGYELEM',
  proposed: 'GYŰLIK',
  confirmed: 'BEÉPÜLT',
  refuted: 'ELENGEDVE',
  dormant: 'PIHEN',
  rejected: 'ELVETVE',
}

/** `Hipotézis: {cím}?` — a cím záró írásjele nélkül, hogy sose legyen „…?." vagy „…??". */
export function hypothesisQuestion(title: string): string {
  return `Hipotézis: ${title.trim().replace(/[.?!]+$/, '')}?`
}

/**
 * Az EGY mondat, ami kimondja, hol tart a hipotézis. A sorrend számít: a felhasználó döntése
 * (`confirmed`) mindent felülír, utána a terv minimuma (addig egyetlen irány sem állítható),
 * és csak azután beszélhet a találat/nem-találat arány. A `minN` mindig az ELŐRE rögzített
 * tervből jön — alapértelmezett szám itt hazugság lenne (a terv a falszifikálhatóság horgonya).
 *
 * `dayCount` = a lent kirajzolt „Az eddigi napok" pontjainak száma (a pár összevethető napjai).
 * A terv minimuma ERRE vonatkozik, nem az éjszakai figyelő-mérlegre (`evidenceHits +
 * evidenceMisses`): az egy javasolt sornál még 0, miközben a grafikon már 8 napot mutat
 * (mezo-twizx) — „gyűlik" a 8 kirajzolt nap mellett ellentmondás volna.
 */
export function hypothesisAnswer(pattern: Pattern, minN: number, dayCount: number): string {
  if (pattern.status === 'confirmed') return 'Beépült.'
  if (dayCount < minN) return 'Ígéretes, de még gyűlik.'
  const hits = pattern.evidenceHits
  const misses = pattern.evidenceMisses
  // Elég nap van, de a figyelő-mérleg még nem ítélhet — a döntés a tiéd.
  if (hits + misses < minN) return 'Ígéretes — elég nap van a döntéshez.'
  if (misses > hits) return 'Nem igazolódik.'
  if (hits >= 3 * misses) return 'Tartja magát.'
  return 'Vegyes kép — még figyelem.'
}

export function HypothesisStateCard({ pattern, pair, dayCount, plan, onDecide }: {
  pattern: Pattern
  /** A drót MINDIG ad párt (`PatternPairDetail.pair` nem nullázható) — reflexiós sorra a
   *  teszt-tervből épített szintetikus párt. */
  pair: PatternMonitorPair
  /** A lenti „Az eddigi napok" grafikon napjainak száma (`PatternPairDetail.days.length`) —
   *  a kártya minden nap-száma ebből jön, hogy a kettő sose mondjon mást. */
  dayCount: number
  plan: PatternTestPlan
  onDecide: (status: PatternStatus) => void
}) {
  const status = pattern.status ?? 'proposed'
  const domain = DOMAIN_META[pair.metricBDomain ?? 'other']
  const minN = plan.minN
  const enoughDays = dayCount >= minN
  const belief = pattern.belief == null ? null : Math.round(pattern.belief * 100)
  // A már megítélt sor olvasható állapot-hero: a döntést nem lehet kétszer meghozni (a
  // katalógus-hero rég érvényes szabálya, ld. PatternDetailHero).
  const decidable = status !== 'confirmed' && status !== 'rejected'

  return (
    <section className="pdt-state-card" aria-labelledby="pdt-answer">
      <div className="pdt-hero-top">
        <span className="pdt-hero-icon"><ClayIcon name="i-lombik" size={26} /></span>
        <span>
          <small>{pattern.categoryLabel} · {domain.label.toLowerCase()}</small>
          <b>{pair.title}</b>
        </span>
        <span className="pdt-state-pill">
          {status === 'proposed' && enoughDays ? 'DÖNTHETSZ' : STATE_PILL[status]}
        </span>
      </div>

      <p className="pdt-hypothesis">{hypothesisQuestion(pattern.title)}</p>
      <h1 id="pdt-answer">{hypothesisAnswer(pattern, minN, dayCount)}</h1>
      <p className="pdt-answer-sub">
        {pair.groupOneDays != null && pair.groupZeroDays != null
          ? <><b>{pair.groupOneDays}</b> ilyen napot tudok összevetni <b>{pair.groupZeroDays}</b> másikkal</>
          : <><b>{dayCount}</b> napot tudok összevetni</>}
        {enoughDays ? ' — elég ahhoz, hogy dönts.' : <>. <b>{minN}</b> napnál mondok többet.</>}
      </p>

      {belief != null && (
        <div className="pdt-belief">
          <div className="pdt-belief-ring" style={{ '--v': `${belief}%` } as React.CSSProperties}>
            <div className="in">{belief}%<small>bizonyosság</small></div>
          </div>
          <p>
            A bizonyosságot a <b>számítás</b> és a <b>te válaszaid</b> mozgatják. Mezo csak
            megfogalmazza. Te bármikor felülírhatod.
          </p>
        </div>
      )}

      {decidable && (
        <div className="pdt-actions">
          <button type="button" className="pdt-action-primary" onClick={() => onDecide('confirm')}>Megerősítem</button>
          <button type="button" onClick={() => onDecide('monitor')}>Figyeljük</button>
          <button type="button" onClick={() => onDecide('reject')}>Elvetem</button>
        </div>
      )}
    </section>
  )
}
