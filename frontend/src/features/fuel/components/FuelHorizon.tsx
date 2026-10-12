// ============================================================
// Mezo · FuelHorizon — a hosszabb táv: a heti súlyátlag és a heti átlag kalória EGYMÁS ALATT, ugyanazokon a
// heteken (Fuel Titanium S3, mezo-83g0; manifeszt C3).
//
// Folyadék (mezo-n4wf5.5, prototype vilagos/fuel.js `trendek()` „a hosszabb táv" + `seriesG`): egy fehér kártya —
// fent a súly folyadék-felszínként (heti átlagok fehér pontokkal, a hét napi mérései halvány pontokként, a súlycél
// szaggatott vízvonalként), alatta a kalória keskenyebb felszíne. A két sorozat külön léptékű, ezért külön rajz.
//
// ÚJ BACKEND NINCS: a hívó a MEGLÉVŐ sorozatokból állítja elő a heteket (`useFuelHorizon`), a napi méréseket a
// súlynapló (`useWeight().weightLog`), a célt a meglévő súlycél (`useGoal()`) adja. Cél nélkül nincs vízvonal.
//
// ŐSZINTE-NULL, ez a komponens lényege: egy hiányzó minta VALÓDI SZAKADÁS a felszínben. Soha nem interpolálunk és
// soha nem húzunk nullára. Két NEM ÜRES hétnél kevesebből nem rajzolunk trendet, mert egy pontból nincs trend
// (az élő kód a lista hosszát nézte, ami a mindig 7 elemű listán sosem teljesült — owner-lista, 2026-10-12).
//
// SZÉGYENMENTES: a felület LEÍR, nem értékel, és nem állít okozatiságot — „egyik sem ok, csak együttjárás".
// ============================================================
import { Card, Empty, Head, Lab, Note, useSvgId } from '@/shared/ui/folyadek'
import { Lgd, type LgdKind } from '@/features/fuel/components/folyadek'
import { useM } from '@/shared/i18n'
import { fixed1 } from '@/features/fuel/logic/fuelWeekView'
import { addDays } from '@/shared/lib/dates'
import { fmtDate } from '@/shared/lib/format'

export interface HorizonWeek {
  /** A hét ISO hétfője — a sorrend hitelforrása. */
  startIso: string
  /** A hét kalória-átlaga — NULL, ha a héten nincs naplózott nap. */
  kcal: number | null
  /** A hét súlyátlaga kg-ban — NULL, ha a héten nincs mérés (valódi szakadás). */
  weightKg: number | null
}

/** Hány hétnek van BÁRMILYEN adata (kalória vagy súly). */
const nonEmptyWeeks = (weeks: HorizonWeek[]): number => weeks.filter((w) => w.kcal != null || w.weightKg != null).length

/** Két nem üres hétnél kevesebből nincs trend — a kártya ilyenkor a „néhány hét kell még" arcot mutatja. */
export const horizonNeedsMoreWeeks = (weeks: HorizonWeek[]): boolean => nonEmptyWeeks(weeks) < 2

/** A per-instance id that is safe inside `url(#…)` (bible trap 2). */

type Pt = [x: number, y: number]

/** A prototípus `smooth`-ja: Catmull–Rom-szerű simítás egy összefüggő szakaszra. */
function smooth(pts: Pt[]): string {
  const f = (n: number) => n.toFixed(1)
  return pts.map((p, i) => {
    if (!i) return `M${f(p[0])} ${f(p[1])}`
    const a = pts[i - 2] ?? pts[i - 1], b = pts[i - 1], d = pts[i + 1] ?? p
    return `C${f(b[0] + (p[0] - a[0]) / 6)} ${f(b[1] + (p[1] - a[1]) / 6)} ${f(p[0] - (d[0] - b[0]) / 6)} ${f(p[1] - (d[1] - b[1]) / 6)} ${f(p[0])} ${f(p[1])}`
  }).join('')
}

/** Heti pontok folyadék-felszínként (prototípus `seriesG`): a hiány VALÓDI szakadás; `days` = a hét napi mérései
 *  halvány pontként (hétfőtől vasárnapig); `target` = vízvonal a feliratával. Helyi darab: a kit `Area`-ja nem ismer
 *  hiányt, heti bontású napi pontot és vonal-feliratot. */
function Series({ values, height, color, color2, days, target, targetLabel, labels, aria, kind }: {
  values: (number | null)[]; height: number; color?: string; color2?: string
  days?: ((number | null)[] | null)[]; target?: number | null; targetLabel?: string; labels?: [string, string]; aria: string
  kind: 'weight' | 'kcal'
}) {
  const id = useSvgId('frser')
  const W = 320, pad = 12, bot = height - (labels ? 18 : 4)
  const c1 = color ?? 'var(--liq1)', c2 = color2 ?? 'var(--liq2)'
  const all = [
    ...values.filter((v): v is number => v != null),
    ...(days ?? []).flatMap((wk) => wk ?? []).filter((v): v is number => v != null),
    ...(target != null ? [target] : []),
  ]
  const mn = Math.min(...all), mx = Math.max(...all), r = mx - mn || 1
  const lo = mn - r * (target != null ? 0.10 : 0.35), hi = mx + r * 0.14
  const step = (W - 2 * pad) / Math.max(values.length - 1, 1)
  const X = (i: number) => pad + i * step
  const Y = (v: number) => 12 + (1 - (v - lo) / (hi - lo)) * (bot - 12)
  const f = (n: number) => n.toFixed(1)
  const segs: Pt[][] = []
  let cur: Pt[] = []
  values.forEach((v, i) => {
    if (v == null) { if (cur.length) segs.push(cur); cur = [] } else cur.push([X(i), Y(v)])
  })
  if (cur.length) segs.push(cur)
  return (
    <svg className={`fr-ser is-${kind}`} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={aria}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c1} stopOpacity=".85" />
          <stop offset="1" stopColor={c2} stopOpacity=".2" />
        </linearGradient>
      </defs>
      {segs.filter((s) => s.length > 1).map((s, k) => (
        <g key={k}>
          <path d={`${smooth(s)} L${f(s[s.length - 1][0])} ${bot} L${f(s[0][0])} ${bot}Z`} fill={`url(#${id})`} />
          <path className="fr-ser-line" d={smooth(s)} fill="none" stroke={c2} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      ))}
      {target != null && (
        <>
          <path className="fr-ser-goal" d={`M${pad} ${f(Y(target))}H${W - pad}`} stroke="var(--fo-ink)" strokeWidth="1.2" strokeDasharray="4 4" opacity=".55" />
          <text x={W - pad} y={f(Y(target) - 5)} textAnchor="end">{targetLabel}</text>
        </>
      )}
      {days?.map((wk, i) => wk?.map((v, j) => {
        const cx = X(i) + ((j - 3) / 7) * step
        return v == null || cx < pad || cx > W - pad
          ? null
          : <circle key={`${i}-${j}`} className="fr-ser-day" cx={f(cx)} cy={f(Y(v))} r="1.8" fill="var(--fo-ink)" opacity=".32" />
      }))}
      {values.map((v, i) => v == null ? null : (
        <circle key={i} className="fr-ser-pt" cx={f(X(i))} cy={f(Y(v))} r="3.6" fill="#fff" stroke={c2} strokeWidth="2.2" />
      ))}
      {labels && (
        <>
          <text className="fr-ser-axis" x={pad} y={height - 4}>{labels[0]}</text>
          <text className="fr-ser-axis" x={W - pad} y={height - 4} textAnchor="end">{labels[1]}</text>
        </>
      )}
    </svg>
  )
}

/** A súlynapló a horizont heteire bontva: hetenként hét hely (hétfő … vasárnap), mérés nélkül `null`. Egy napra
 *  több mérés átlaga áll. Olyan hétre, amelyiknek nincs heti átlaga, nem rajzolunk napi pontot sem. */
function dailyByWeek(weeks: HorizonWeek[], log: { date: string; value: number }[]): ((number | null)[] | null)[] {
  const byDate = new Map<string, { sum: number; n: number }>()
  for (const e of log) {
    const cell = byDate.get(e.date) ?? { sum: 0, n: 0 }
    cell.sum += e.value
    cell.n += 1
    byDate.set(e.date, cell)
  }
  return weeks.map((w) => w.weightKg == null ? null : Array.from({ length: 7 }, (_, j) => {
    const cell = byDate.get(addDays(w.startIso, j))
    return cell ? cell.sum / cell.n : null
  }))
}

export function FuelHorizon({ weeks, weightLog, goalKg, pending }: {
  weeks: HorizonWeek[]
  /** A súlynapló napi mérései (`useWeight().weightLog`) — halvány pontok a heti átlag körül. Nélküle nincs napi pont. */
  weightLog?: { date: string; value: number }[]
  /** A súlycél kg-ban (`useGoal()`); `null` / hiány = nincs vízvonal. */
  goalKg?: number | null
  /** A hetek még töltődnek: ilyenkor nem állítjuk, hogy „kevés a hét". */
  pending?: boolean
}) {
  const M = useM()
  const H = M.fuelTrendek.horizon

  // Egy pontból nincs trend — nem találunk ki vonalat.
  if (!pending && horizonNeedsMoreWeeks(weeks)) {
    return <Card className="fr-horizon is-waiting"><Empty icon="t-trend">{H.wait}</Empty></Card>
  }

  const kgs = weeks.map((w) => w.weightKg)
  const kcals = weeks.map((w) => w.kcal)
  const nKg = kgs.filter((v) => v != null).length
  const goal = goalKg != null && goalKg > 0 ? goalKg : null
  const goalText = goal == null ? '' : H.goal(fixed1(goal))
  // the axis ends: the first and the last week's Monday (prototype `dS`)
  const day = (w: HorizonWeek | undefined) => (w ? fmtDate(w.startIso, 'short') : '')
  const first = day(weeks[0]), last = day(weeks[weeks.length - 1])
  const legend: Array<[LgdKind, string]> = [
    ['liq', H.weightKey],
    ...(weightLog && weightLog.length > 0 ? [['dot', H.dailyKey] as [LgdKind, string]] : []),
    ...(goal == null ? [] : [['line', goalText] as [LgdKind, string]]),
  ]

  return (
    <Card className="fr-horizon">
      <Head icon="t-weight" title={H.weightHead} />
      {nKg > 0 && (
        <>
          <Series kind="weight" values={kgs} height={150} days={weightLog ? dailyByWeek(weeks, weightLog) : undefined}
            target={goal} targetLabel={goalText} labels={[first, last]} aria={H.weightAria(weeks.length, first, last)} />
          <Lgd items={legend} />
        </>
      )}
      {nKg === 0
        ? <Note className="fr-horizon-gapnote">{H.noWeight}</Note>
        : nKg < weeks.length && <Note className="fr-horizon-gapnote">{H.weightGap}</Note>}
      <Lab>{H.kcalLabel}</Lab>
      {kcals.some((v) => v != null) && (
        <Series kind="kcal" values={kcals} height={84} color="color-mix(in srgb,var(--fx-carb) 55%,#fff)" color2="var(--fx-carb)"
          aria={H.kcalAria(weeks.length)} />
      )}
      {/* Leírás, nem ítélet — és nem okozatiság. */}
      <Note>{H.lead}</Note>
    </Card>
  )
}
