// ============================================================
// Mezo · DayOrb — a fejléc napi állapotjelzője (mezo-idz2).
// Üveg (bible §7.1, mezo-me75u.1): egy üveggömb, benne korall folyadék, ami alulról a
// `pct`-ig emelkedik, lassú vízszintes hullámmal (csökkentett mozgásnál áll), korall
// derengéssel és egy fehér fényívvel bal fent. A tónus (`intensity`) a folyadék
// gradiensét festi a kifakult és a telt végpont között. A gömb üvegét a gomb adja
// (`.nap-avatar.glass`), ez az svg a belseje. Buta prezentáció: a számokat a
// `useDayOrbFill` hook adja.
// ============================================================
import { useId } from 'react'

/** A gömb teste: `circle cx=50 cy=50 r=40` → y-ban 10…90. */
const ORB_TOP = 10
const ORB_BOTTOM = 90
const ORB_SPAN = ORB_BOTTOM - ORB_TOP

/** A tónus két végpontja — a folyadék gradiense (fent → lent). */
const PALE = ['#f3e2d9', '#e3bdab', '#c69c89'] as const
const FULL = ['#ffc3a8', '#ff7a55', '#d8481f'] as const

function lerpHex(from: string, to: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  let out = '#'
  for (let i = 0; i < 3; i++) {
    const v = Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t)
    out += v.toString(16).padStart(2, '0')
  }
  return out
}

interface DayOrbProps {
  /** 0…100 — mennyit tudunk a napról. */
  pct: number
  /** 0…1 — a nap minőségéből számolt telítettség. */
  intensity: number
  size?: number
}

export function DayOrb({ pct, intensity, size = 40 }: DayOrbProps) {
  // React 19 `useId`-je `_r_0_` alakú — a korábbi `.replace(/:/g, '')` a React-18-as
  // `:r0:` formátum maradványa volt, itt állandó no-op. A `DayOrb.test.tsx` őrzi, hogy az
  // id `url(#…)`-ben biztonságos maradjon, ha a React formátumot vált.
  const uid = useId()
  const clipped = Math.max(0, Math.min(100, pct))
  const fillY = ORB_BOTTOM - (clipped / 100) * ORB_SPAN
  const t = Math.max(0, Math.min(1, intensity))
  const stops = [lerpHex(PALE[0], FULL[0], t), lerpHex(PALE[1], FULL[1], t), lerpHex(PALE[2], FULL[2], t)]

  /** A folyadék felszíne: hullám a `fillY` szinten (fél hullámhossz 30, amplitúdó 6). */
  const wave = `M-10 ${fillY} Q5 ${fillY - 6} 20 ${fillY} T50 ${fillY} T80 ${fillY} T110 ${fillY} T140 ${fillY} V110 H-10Z`

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="dayorb">
      <defs>
        <clipPath id={`dayorb-body-${uid}`}>
          <circle cx="50" cy="50" r="40" />
        </clipPath>
        <linearGradient id={`dayorb-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.5" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
      </defs>

      <circle className="dayorb-glass" cx="50" cy="50" r="40" />

      {clipped > 0 && (
        <g clipPath={`url(#dayorb-body-${uid})`} className="dayorb-liquid" data-level={fillY}>
          {clipped < 100
            ? <g className="dayorb-wave"><path d={wave} fill={`url(#dayorb-grad-${uid})`} /></g>
            : <circle cx="50" cy="50" r="40" fill={`url(#dayorb-grad-${uid})`} />}
        </g>
      )}

      <path className="dayorb-hi" d="M27 30 A28 28 0 0 1 42 21" />
    </svg>
  )
}
