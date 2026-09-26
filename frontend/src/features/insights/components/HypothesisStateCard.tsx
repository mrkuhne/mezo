// ============================================================
// Mezo · HypothesisStateCard — a laborfüzet „Igaz ez rám?" hero-ja (Reflexió S6, mezo-eq85.6;
// üvegben: Üvegesítés U8a, mezo-me75u.13 — prototypes/uveg-uzenofal.html #minta/viz).
// Az oldal EGYETLEN üveg-hero-ja: kút a lombikkal + eyebrow + a hipotézis kérdése címként +
// állapot-pirula, alatta a miértje, a nagy NAP-gyűrű (n / a terv minimuma) mellett EGY emberi válasz-mondat,
// a bizonyosság-sáv és — amíg dönthető — a három döntés a magyarázó sorral.
// A bizonyosság a szerver DETERMINISZTIKUS `belief`-je — sosem LLM-becslés, és nyers
// r/p SOHA nem kerül a kártya arcára (az a `Háttér` fold dolga).
// ============================================================
import type { Icon3DName } from '@/shared/ui/clay'
import { DOMAIN_META } from '@/features/insights/logic/domains'
import { isStatisticalMechanism, patternHeadline } from '@/features/insights/logic/patternCopy'
import {
  DayRing, DecisionNote, DecisionRow, DetailHero, StatePill, patternDecisionButtons, type DetailTone,
} from '@/features/insights/components/DetailHero'
import type { Pattern, PatternMonitorPair, PatternRowStatus, PatternStatus, PatternTestPlan } from '@/data/types'

/** A prototípus állapot-pirulái — a hat perzisztált sor-státusz emberi szava, tónusa és jele. */
const STATE_PILL: Record<PatternRowStatus, { label: string; tone: DetailTone; art: Icon3DName }> = {
  monitoring: { label: 'FIGYELEM', tone: 'sky', art: 't-lens' },
  proposed: { label: 'GYŰLIK', tone: 'lav', art: 't-clock' },
  confirmed: { label: 'BEÉPÜLT', tone: 'sage', art: 't-tick' },
  refuted: { label: 'ELENGEDVE', tone: 'mute', art: 't-skip' },
  dormant: { label: 'PIHEN', tone: 'mute', art: 't-clock' },
  rejected: { label: 'ELVETVE', tone: 'mute', art: 't-skip' },
}

/** A cím alatti sor: MIÉRT figyeljük — a pár kézzel írt miértje. Ha ugyanazt mondaná, mint a
 *  cím (a reflexiós sor szintetikus párjánál előfordulhat), elmarad; a nyilas belső párcím és a
 *  gépi statisztika sosem kerül ide (mezo-0469). */
export function hypothesisContext(pair: PatternMonitorPair, headline: string): string | null {
  const why = pair.mechanismHu?.trim()
  if (!why || why === headline || isStatisticalMechanism(why)) return null
  return why
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
  const headline = patternHeadline(pair.title, pair)
  const context = hypothesisContext(pair, headline)
  const pill = status === 'proposed' && enoughDays
    ? { label: 'DÖNTHETSZ', tone: 'gold' as const, art: 't-sprout' as const }
    : STATE_PILL[status]

  return (
    <DetailHero tone="lav" art="t-flask" labelledBy="pdt-answer"
      eyebrow={`${pattern.categoryLabel} · ${domain.label.toLowerCase()}`} title={headline}
      pill={<StatePill label={pill.label} tone={pill.tone} art={pill.art} />}>
      {context && <p className="pdt-hypothesis">{context}</p>}

      <div className="pdt-core">
        {/* a gyűrű UGYANAZT a napszámot mondja, mint a lenti grafikon (mezo-twizx) */}
        <DayRing value={dayCount} of={dayCount <= minN ? minN : undefined}
          pct={minN > 0 ? dayCount / minN * 100 : 100} unit="NAP" tone={enoughDays ? 'gold' : 'lav'}
          ariaLabel={`${dayCount} nap a terv ${minN} napos minimumából`} />
        <div className="pdt-answer">
          <h1 id="pdt-answer">{hypothesisAnswer(pattern, minN, dayCount)}</h1>
          <p className="pdt-answer-sub">
            {pair.groupOneDays != null && pair.groupZeroDays != null
              ? <><b>{pair.groupOneDays}</b> ilyen napot tudok összevetni <b>{pair.groupZeroDays}</b> másikkal</>
              : <><b>{dayCount}</b> napot tudok összevetni</>}
            {enoughDays ? ' — elég ahhoz, hogy dönts.' : <>. <b>{minN}</b> napnál mondok többet.</>}
          </p>
        </div>
      </div>

      {belief != null && (
        <div className="pdt-belief" style={{ '--v': `${belief}%` } as React.CSSProperties}>
          <strong>{belief}%<small>bizonyosság</small></strong>
          <p>
            A bizonyosságot a <b>számítás</b> és a <b>te válaszaid</b> mozgatják. Mezo csak
            megfogalmazza. Te bármikor felülírhatod.
          </p>
        </div>
      )}

      {decidable && (
        <>
          <DecisionRow label="Döntés a mintáról"
            buttons={patternDecisionButtons((verb) => onDecide(verb))} />
          <DecisionNote />
        </>
      )}
    </DetailHero>
  )
}
