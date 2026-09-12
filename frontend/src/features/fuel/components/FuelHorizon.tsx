// ============================================================
// Mezo · FuelHorizon — a hosszabb táv: evés és súly EGY időtengelyen (Fuel Titanium S3,
// mezo-83g0; manifeszt C3).
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `horizonChart` (:223) + `trendHorizonGlass` (:283), a fuel-pages.css `.tx-chart`/`.tx-legend`
// blokkjaival. Geometria 1:1 a prototípusból: 336×150 viewBox, 18..318 vízszintes sáv, három
// halk rácsvonal, 30..110 értéksáv, a kalória területkitöltéssel, a súly szaggatott vonallal
// és pontokkal.
//
// ÚJ BACKEND NINCS: a hívó a MEGLÉVŐ sorozatokból állítja elő a heteket (a heti rollup
// kalória-átlaga + a súlynapló heti átlaga, ugyanaz a sorozat, amiből az Én a súlyt rajzolja).
//
// ŐSZINTE-NULL, ez a komponens lényege: egy hiányzó minta VALÓDI SZAKADÁS a vonalban. Soha nem
// interpolálunk és soha nem húzunk nullára — a path ilyenkor több `M…` szakaszból áll. Két hétnél
// kevesebb adatnál egyáltalán nem rajzolunk trendet, mert egy pontból nincs trend.
//
// SZÉGYENMENTES: a felület LEÍR, nem értékel, és nem állít okozatiságot — „egyik sem ok, csak
// együttjárás" (a prototípus `trendHorizonGlass`-ának hangja).
// ============================================================
import { ClayIcon } from '@/shared/ui/clay'

export interface HorizonWeek {
  /** A hét ISO hétfője — a sorrend hitelforrása. */
  startIso: string
  /** Rövid, kiírható hét-felirat (pl. „Szept 7"). */
  label: string
  /** A hét kalória-átlaga — NULL, ha a héten nincs naplózott nap. */
  kcal: number | null
  /** A hét súlyátlaga kg-ban — NULL, ha a héten nincs mérés (valódi szakadás). */
  weightKg: number | null
}

// A prototípus `horizonChart` geometriája.
const X0 = 18
const X1 = 318
const Y_TOP = 30
const Y_BOTTOM = 110
const AREA_BASE = 118

/** Egy sorozat `d` attribútuma, a HIÁNYOKAT valódi szakadásként kezelve: minden folytonos
 *  szakasz új `M`-mel kezdődik, egyetlen pontos szakasz pedig egy apró tüske helyett kimarad a
 *  vonalból (a súlynál a pont maga jelzi). */
function brokenPath(points: ({ x: number; y: number } | null)[]): string {
  const segments: string[] = []
  let current: string[] = []
  for (const p of points) {
    if (p == null) {
      if (current.length > 1) segments.push(`M${current.join('L')}`)
      current = []
      continue
    }
    current.push(`${p.x} ${p.y}`)
  }
  if (current.length > 1) segments.push(`M${current.join('L')}`)
  return segments.join('')
}

/** Érték → y, a sorozat saját min/max-ára skálázva (egy kis párnával, hogy a szélső pont ne
 *  tapadjon a rács szélére). Konstans sorozat a sáv közepén fut — nem osztunk nullával. */
function scaler(values: number[]): (v: number) => number {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const mid = (Y_TOP + Y_BOTTOM) / 2
  if (span === 0) return () => mid
  const pad = span * 0.12
  const lo = min - pad
  const hi = max + pad
  return (v) => Y_BOTTOM - ((v - lo) / (hi - lo)) * (Y_BOTTOM - Y_TOP)
}

export function FuelHorizon({ weeks }: { weeks: HorizonWeek[] }) {
  // Egy pontból nincs trend — nem találunk ki vonalat.
  if (weeks.length < 2) {
    return (
      <div className="ftx-horizon is-waiting">
        <p className="ftx-horizon-wait">
          <span aria-hidden="true"><ClayIcon name="i-trend" size={30} /></span>
          <span>Néhány hét kell még ehhez a képhez — egyetlen hétből nincs trend, és nem rajzolunk
            olyat, ami nincs.</span>
        </p>
      </div>
    )
  }

  const x = (i: number) => X0 + (i * (X1 - X0)) / (weeks.length - 1)
  const kcals = weeks.map(w => w.kcal).filter((v): v is number => v != null)
  const weights = weeks.map(w => w.weightKg).filter((v): v is number => v != null)
  const ky = kcals.length > 0 ? scaler(kcals) : null
  const wy = weights.length > 0 ? scaler(weights) : null

  const kcalPoints = weeks.map((w, i) => (w.kcal != null && ky ? { x: x(i), y: ky(w.kcal) } : null))
  const weightPoints = weeks.map((w, i) => (w.weightKg != null && wy ? { x: x(i), y: wy(w.weightKg) } : null))
  const kcalPath = brokenPath(kcalPoints)
  const weightPath = brokenPath(weightPoints)

  // A terület csak ÖSSZEFÜGGŐ kalória-sorozatnál záródik — hiánynál nem hamisítunk felszínt.
  const kcalUnbroken = kcalPoints.every(p => p != null)

  return (
    <div className="ftx-horizon">
      <svg
        className="ftx-horizon-chart"
        viewBox="0 0 336 150"
        role="img"
        aria-label={`Heti átlag kalória és heti súlyátlag ${weeks.length} héten át,`
          + ` ${weeks[0].label} és ${weeks[weeks.length - 1].label} között`}
      >
        <defs>
          <linearGradient id="ftx-horizon-area" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="var(--sky)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--sky)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="ftx-horizon-grid" d={`M${X0} ${Y_TOP}H${X1}M${X0} 70H${X1}M${X0} ${Y_BOTTOM}H${X1}`} />
        {kcalUnbroken && kcalPath !== '' && (
          <path
            className="ftx-horizon-area"
            d={`${kcalPath}L${X1} ${AREA_BASE}L${X0} ${AREA_BASE}Z`}
            fill="url(#ftx-horizon-area)"
          />
        )}
        {kcalPath !== '' && <path className="ftx-horizon-kcal" d={kcalPath} />}
        {weightPath !== '' && <path className="ftx-horizon-weight" d={weightPath} />}
        {weightPoints.map((p, i) => p && (
          <circle key={weeks[i].startIso} className="ftx-horizon-dot" cx={p.x} cy={p.y} r={3} />
        ))}
        <text className="ftx-horizon-axis" x={X0} y={142}>{weeks[0].label}</text>
        <text className="ftx-horizon-axis" x={X1} y={142} textAnchor="end">
          {weeks[weeks.length - 1].label}
        </text>
      </svg>
      <p className="ftx-horizon-legend">
        <em className="is-kcal">heti átlag kcal</em>
        <em className="is-weight">heti súlyátlag</em>
      </p>
      {/* Leírás, nem ítélet — és nem okozatiság. */}
      <p className="ftx-horizon-lead">
        A heti átlagok egymás mellett: a kalória és a súly ugyanazon a héten. Egyik sem ok, csak
        együttjárás.
      </p>
      {weights.length === 0 && (
        <p className="ftx-horizon-gapnote">
          Súlymérés nélkül ehhez a héthez nincs súlyvonal — a hiányt meghagyjuk hiánynak.
        </p>
      )}
      {weights.length > 0 && weights.length < weeks.length && (
        <p className="ftx-horizon-gapnote">
          Ahol nincs mérés, ott a súlyvonal megszakad — nem találgatunk közé értéket.
        </p>
      )}
    </div>
  )
}
