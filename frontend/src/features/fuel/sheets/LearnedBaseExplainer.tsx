import { useEffect, useState, type ReactNode } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { useExpenditureExplanation } from '@/data/fuel/expenditureHooks'
import type { ExpenditureExplanation } from '@/data/fuel/expenditureApi'
import { LearnedBaseChart } from '@/features/fuel/sheets/LearnedBaseChart'
import { dec, huShortDate, nf, round10, signed } from '@/features/fuel/sheets/learnedBaseFormat'

// „Hogy tanultam?” (mezo-y72o3) — the learned base's explainer inside the energy sheet's Alap block.
// Design: docs/design_2.0/prototypes/hogy-tanultam.html (owner-approved). Üveg canon: the sheet is
// the only glass; every section here is a FLAT cell (rank 3), Titanium 3D icons, no emojis.
// Honest data: every number comes from the persisted explanation; a section/line whose data is
// missing is hidden (never a 0 or a guessed fallback).

type Confidence = ExpenditureExplanation['confidence']
const CONFIDENCE_WORD: Record<Confidence, string> = { low: 'Még tanulok', medium: 'Közepesen biztos', high: 'Biztos' }
const CONFIDENCE_LINE: Record<Confidence, string> = {
  low: 'Ez még a „tanulok” szakasz — a képlettől ezért csak lépésenként távolodom.',
  medium: 'Már elég sok adatot láttam, de a keretet továbbra is csak lépésenként igazítom.',
  high: 'Ennyi adatból már magabiztosan tanultam.',
}
/** The why-note shows only when the stepped base and the simple estimate really differ. */
export const WHY_NOTE_MIN_GAP_KCAL = 30

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const ZONE: Record<Confidence, number> = { low: 0, medium: 1, high: 2 }
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
/**
 * Meter pin position (0..1). The bar is three equal zones (low | medium | high); within a zone the
 * ±1 SD places the pin linearly (low: 300→200, medium: 200→100, high: 100→0 kcal). The pin is
 * always clamped into the SERVED confidence's zone, so the lit word and the pin never disagree.
 */
export const meterPosition = (sdKcal: number, confidence: Confidence) => {
  const zone = ZONE[confidence]
  const hi = 300 - zone * 100 // the zone's left-edge SD
  return (zone + clamp01((hi - sdKcal) / 100)) / 3
}

function Cell({ num, title, children }: { num: number; title: string; children: ReactNode }) {
  return (
    <section className="flp-how-cell">
      <h4><span className="num">{num}</span>{title}</h4>
      {children}
    </section>
  )
}

function Meter({ sdKcal, confidence, reduce }: { sdKcal: number; confidence: Confidence; reduce: boolean }) {
  const target = meterPosition(sdKcal, confidence) * 100
  const [left, setLeft] = useState(reduce ? target : 0)
  useEffect(() => {
    if (reduce) return
    const raf = requestAnimationFrame(() => setLeft(target))
    return () => cancelAnimationFrame(raf)
  }, [reduce, target])
  return (
    <>
      <div className="flp-how-meter"><span className="pin" style={{ left: `${left}%` }} /></div>
      <div className="flp-how-meter-lbl">
        {(Object.keys(CONFIDENCE_WORD) as Confidence[]).map(c => (
          <span key={c} className={c === confidence ? 'on' : undefined}>{CONFIDENCE_WORD[c]}</span>
        ))}
      </div>
    </>
  )
}

export function LearnedBaseExplainerBody({ explanation: x, reducedMotion }: {
  explanation: ExpenditureExplanation
  /** Test seam; defaults to `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}) {
  const [reduce] = useState(() => reducedMotion ?? prefersReducedMotion())

  // `tissueRateKgPerWeek` is null on HOLDING rows / without a filter trace → no section 3 at all.
  const hasCalc = x.avgIntakeKcal != null && x.tissueRateKgPerWeek != null && x.avgMovementKcal != null && x.simpleBaseKcal != null
  const hasChart = x.series.length > 0
  const suspicious = x.excludedDays.filter(d => d.reason === 'suspicious')
  const marked = x.excludedDays.filter(d => d.reason === 'marked')
  const hasFiltered = x.excludedDays.length > 0 || x.waterEvents.length > 0 || x.unloggedDays > 0
  const showStart = x.startBaseKcal !== x.formulaBaseKcal

  // Consecutive numbering over the sections actually shown.
  let n = 0
  const num = { data: ++n, chart: hasChart ? ++n : 0, calc: hasCalc ? ++n : 0, filtered: hasFiltered ? ++n : 0, conf: ++n, steps: ++n }
  const simple = x.simpleBaseKcal
  const showWhy = simple != null && Math.abs(x.appliedBaseKcal - simple) >= WHY_NOTE_MIN_GAP_KCAL

  return (
    <div className="flp-how-in">
      <Cell num={num.data} title="Mit néztem meg">
        <div className="flp-how-stats">
          <div className="flp-how-stat"><Icon3D name="t-bowl" size={28} /><b>{x.usableDays}</b><span>teljes nap<br />felírt evéssel</span></div>
          <div className="flp-how-stat"><Icon3D name="t-weight" size={28} /><b>{x.weighInDays}</b><span>mérlegelés</span></div>
          <div className="flp-how-stat"><Icon3D name="t-calendar" size={28} /><b>{x.historyWeeks}</b><span>hét<br />előzmény</span></div>
        </div>
        <p className="flp-how-fine">Csak azokat a napokat számoltam, amikor az evésed teljesnek tűnt. A mai napot soha nem nézem, mert még tart.</p>
      </Cell>

      {hasChart && (
        <Cell num={num.chart} title="A súlyod és az evésed együtt">
          <LearnedBaseChart series={x.series} historyWeeks={x.historyWeeks} reducedMotion={reduce} />
          <div className="flp-how-legend">
            <span><i className="ok" />számít</span>
            <span><i className="bad" />hiányosnak tűnt</span>
            <span><i className="ln trend" />súlytrend</span>
            <span><i className="ln water" />ebből víz</span>
          </div>
        </Cell>
      )}

      {hasCalc && (
        <Cell num={num.calc} title="A számítás, egyszerűen">
          <div className="flp-how-calc">
            <div className="row"><Icon3D name="t-bowl" size={24} />
              <span className="l">Átlagosan ennyit ettél<small>a {x.usableDays} teljes napon</small></span><span className="r">{nf(x.avgIntakeKcal!)}</span></div>
            <div className="row"><Icon3D name="t-weight" size={24} />
              {x.tissueRateKgPerWeek! > 0
                ? <span className="l">− ami súlyként megmaradt<small>+{dec(x.tissueRateKgPerWeek!, 2)} kg/hét valódi gyarapodás (víz nélkül)</small></span>
                : x.tissueRateKgPerWeek! < 0
                  ? <span className="l">+ amit a tartalékaidból pótoltál<small>−{dec(Math.abs(x.tissueRateKgPerWeek!), 2)} kg/hét valódi fogyás (víz nélkül)</small></span>
                  : <span className="l">± nem változott a súlyod<small>0 kg/hét (víz nélkül)</small></span>}
              <span className="r">{signed(-x.tissueKcalPerDay!)}</span></div>
            <div className="row"><Icon3D name="t-steps" size={24} />
              <span className="l">− amit mozgással égettél<small>logolt mozgás, napi átlag</small></span><span className="r">{signed(-x.avgMovementKcal!)}</span></div>
            <div className="row tot"><span className="l">= ennyit égetsz mozgás nélkül</span><span className="r">≈ {nf(round10(simple!))}</span></div>
          </div>
          {showWhy && (
            <p className="flp-how-fine flp-how-why">
              <b>Miért {nf(x.appliedBaseKcal)} és nem {nf(round10(simple!))}?</b>{' '}
              {x.confidence === 'high'
                ? `Mert a keretedet nem ugrasztom ide egyszerre — hetente lépek felé (${num.steps}. pont).`
                : `Mert még bizonytalan vagyok, a keretedet nem ugrasztom ide egyszerre — hetente lépek felé (${num.steps}. pont).`}
            </p>
          )}
          <p className="flp-how-fine">A valódi számítás napról napra halad, és minden mérlegelés egy kicsit pontosít rajta. Ez a kerekített, egyszerű változata.</p>
        </Cell>
      )}

      {hasFiltered && (
        <Cell num={num.filtered} title="Amit kiszűrtem, hogy ne tévesszen meg">
          <div className="flp-how-chips">
            {suspicious.length > 0 && (
              <div className="flp-how-chip"><Icon3D name="t-shield" size={26} />
                <div className="tx"><b>{suspicious.length} hiányosnak tűnő nap</b>Jóval a szokásos evésed alatt voltak, ezért nem vettem kevés evésnek — kihagytam őket.
                  <div className="days">{suspicious.map(d => <span key={d.date}>{huShortDate(d.date)} · {nf(d.kcal)}</span>)}</div></div></div>
            )}
            {marked.length > 0 && (
              <div className="flp-how-chip"><Icon3D name="t-shield" size={26} />
                <div className="tx"><b>{marked.length} általad hiányosnak jelölt nap</b>Ezeket te jelölted hiányosnak, ezért kihagytam őket.
                  <div className="days">{marked.map(d => <span key={d.date}>{huShortDate(d.date)} · {nf(d.kcal)}</span>)}</div></div></div>
            )}
            {x.waterEvents.map(w => (
              <div key={w.date} className="flp-how-chip"><Icon3D name="t-water" size={26} />
                <div className="tx"><b>Víz, nem zsír · {huShortDate(w.date)}. körül</b>A súlyod ~{dec(w.kg, 1)} kg-ot ugrott. Ez víz és glikogén, ezért nem számoltam hízásnak.</div></div>
            ))}
            {x.unloggedDays > 0 && (
              <div className="flp-how-chip"><Icon3D name="t-calendar" size={26} />
                <div className="tx"><b>{x.unloggedDays} nap felírás nélkül</b>Ezekből a napokból nem tanultam semmit — nem is tippeltem helyettük.</div></div>
            )}
          </div>
        </Cell>
      )}

      <Cell num={num.conf} title="Mennyire vagyok biztos benne">
        <p>A mostani becslésem <b>±{nf(round10(x.posteriorSdKcal))} kcal</b> pontos. {CONFIDENCE_LINE[x.confidence]}</p>
        <Meter sdKcal={x.posteriorSdKcal} confidence={x.confidence} reduce={reduce} />
        {x.confidence !== 'high' && (
          <p className="flp-how-fine">Minél több teljes napot és mérlegelést látok, annál biztosabb leszek.</p>
        )}
      </Cell>

      <Cell num={num.steps} title="Hogyan léptem">
        <div className="flp-how-steps">
          <div className="flp-how-step"><b>{nf(x.formulaBaseKcal)}</b><span>képlet</span></div>
          {showStart && (
            <>
              <span className="ar">→</span>
              <div className="flp-how-step"><b>{nf(x.startBaseKcal)}</b><span>a korábbi igazításaiddal</span></div>
            </>
          )}
          {Math.round(x.stepKcal) !== 0 && (
            <>
              <span className="ar">→</span>
              <div className={`flp-how-step ${x.stepKcal < 0 ? 'is-down' : 'is-up'}`}><b>{signed(x.stepKcal)}</b><span>e heti lépés</span></div>
            </>
          )}
          <span className="ar">→</span>
          <div className="flp-how-step is-now"><b>{nf(x.appliedBaseKcal)}</b><span>most</span></div>
        </div>
        <p className="flp-how-fine">Hetente csak kis lépést teszek, és új irányba először csak félig — egy furcsa hét így nem rántja el a keretet.</p>
      </Cell>
    </div>
  )
}

/** Data-bound explainer — mounted only once the „Hogy tanultam?” toggle first opens (lazy fetch). */
export function LearnedBaseExplainer({ reducedMotion }: { reducedMotion?: boolean }) {
  const { data, isPending, isError } = useExpenditureExplanation(true)
  if (data) return <LearnedBaseExplainerBody explanation={data} reducedMotion={reducedMotion} />
  return (
    <div className="flp-how-in">
      <p className="flp-how-fine flp-how-state">
        {isPending ? 'Betöltöm, hogyan tanultam…' : isError ? 'Most nem sikerült betölteni a magyarázatot.' : 'Még nincs elég adat a magyarázathoz.'}
      </p>
    </div>
  )
}
