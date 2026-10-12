// ============================================================
// Mezo · FuelWindowTide — a nap étkezési ablakai edényekként a 06–24 órás vonalon (Folyadék F5, mezo-n4wf5.5;
// prototype vilagos/fuel.js `tide` / `winTide`). A Fuel beállítások két lapjának közös hős-grafikája (I terület,
// helyi darab: `.fb-tide`): minden ablak egy kis edény a saját időpontjánál, a szintje az ablak kalória-része a
// legnagyobb ablakhoz mérve, fölötte a kcal, alatta a neve; a koffein-stop szaggatott borostyán vonal a feliratával.
// `bare` = a tartalék arc: névtelen, szám nélküli, egyforma edények (amíg az ablakok nem töltöttek be).
// ============================================================
import { useId } from 'react'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'

export interface TideWindow {
  /** A nap perce (0–1439, vagy a nap folytonos tengelyén afölött). */
  time: number
  /** Az ablak neve — a felhasználó saját (tárolt) szava vagy a rendszer címkéje; itt nem fordítunk. */
  label: string
  kcal: number
}

/** A prototípus `wv`-ja: egy hullámvonal `y` magasságban. */
const wave = (y: number, x0 = -10, n = 10, a = 25, amp = 4) => `M${x0} ${y.toFixed(1)} q${a / 2} ${-amp} ${a} 0 ${`t${a} 0 `.repeat(n)}`

/** Az óra (tört) helye a vonalon; a 06 előtti / 24 utáni ablak a szélre tapad, hogy az edény a rajzon belül maradjon. */
const xOf = (hours: number) => Math.max(33, Math.min(287, 18 + ((hours - 6) / 18) * 284))

/** Két közeli ablak edénye ne fedje egymást: a sorrendet megtartva legalább 44 egységre (edény + a neve) tolja szét őket,
 *  és ha a sor vége kilógna, az egészet visszahúzza a rajzba. A hely így közelítő, az idő a lenti sorokban pontos. */
function spread(xs: number[], gap = 44): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0])
  const out = [...xs]
  let last = -Infinity
  for (const [x, i] of order) { out[i] = Math.max(x, last + gap); last = out[i] }
  const over = Math.max(0, last - 287)
  if (over > 0) {
    // shift left from the end so the last vessel stands at the edge
    let edge = 287
    for (const [, i] of [...order].reverse()) { out[i] = Math.min(out[i], edge); edge = out[i] - gap }
  }
  return out
}

const hoursOf = (hhmm: string): number | null => {
  const [h, m] = hhmm.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h + m / 60 : null
}

/** `count` egyforma, névtelen ablak 08:00-tól négyóránként elosztva a nap vonalán (a prototípus `evenW`-je, tetszőleges darabra). */
export function evenWindows(count: number): TideWindow[] {
  const n = Math.max(1, count)
  const stepMin = n === 1 ? 0 : Math.min(240, (14 * 60) / (n - 1))
  return Array.from({ length: n }, (_, i) => ({ time: 8 * 60 + i * stepMin, label: '', kcal: 0 }))
}

export function FuelWindowTide({ windows, cutoff, bare }: {
  windows: TideWindow[]
  /** A koffein-stop 'HH:mm'-ben; nélküle nincs vonal. */
  cutoff?: string | null
  bare?: boolean
}) {
  const id = 'fbt' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const T = useM().fuelBeallitas.tide
  const max = Math.max(1, ...windows.map((w) => w.kcal))
  const stop = cutoff ? hoursOf(cutoff) : null
  const xs = spread(windows.map((w) => {
    // egy éjfél utáni ablak (00:30) a nap VÉGÉN áll, nem az elején
    const hours = w.time / 60
    return xOf(hours < 5 ? hours + 24 : hours)
  }))
  return (
    <svg className="fb-tide" viewBox="0 0 320 146" role="img" aria-label={T.aria}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--liq1)" /><stop offset="1" stopColor="var(--liq2)" /></linearGradient>
      </defs>
      <path d={`${wave(104, 0, 13, 25, 5)}V118 H0Z`} fill="color-mix(in srgb,var(--liq1) 26%,#fff)" />
      <path d={`${wave(109, -12, 13, 25, 4)}V118 H-12Z`} fill="color-mix(in srgb,var(--liq2) 20%,#fff)" />
      {stop != null && cutoff && (
        <g className="fb-tide-stop">
          <path d={`M${xOf(stop).toFixed(1)} 8V112`} stroke="var(--fo-warn)" strokeWidth="1.5" strokeDasharray="3 4" />
          <text x={Math.max(60, Math.min(260, xOf(stop))).toFixed(1)} y="143" textAnchor="middle" className="w">{T.cutoff(cutoff)}</text>
        </g>
      )}
      {windows.map((w, i) => {
        const x = xs[i]
        const level = bare || w.kcal <= 0 ? 40 : Math.max(10, (w.kcal / max) * 66)
        const top = 106 - level
        return (
          <g key={i} className="fb-tide-win">
            <clipPath id={`${id}c${i}`}><rect x={x - 15} y="30" width="30" height="80" rx="15" /></clipPath>
            <rect x={x - 15} y="30" width="30" height="80" rx="15" fill="#fff" stroke="rgba(10,42,60,.12)" strokeWidth="1.5" />
            <g clipPath={`url(#${id}c${i})`}><path d={`${wave(top, x - 20, 3, 10, 2.5)}V112 H${x - 20}Z`} fill={`url(#${id})`} /></g>
            {!bare && w.kcal > 0 && <text x={x} y="22" textAnchor="middle" className="val">{fmtGrouped(w.kcal)}</text>}
            {!bare && w.label !== '' && <text x={x} y="128" textAnchor="middle" className="nm">{w.label}</text>}
          </g>
        )
      })}
      <text x="4" y="143">06</text>
      <text x="316" y="143" textAnchor="end">24</text>
    </svg>
  )
}
