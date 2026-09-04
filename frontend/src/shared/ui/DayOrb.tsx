// ============================================================
// Mezo · DayOrb — a fejléc napi állapotjelzője (mezo-idz2).
// A meglévő `#s-orb` clay sprite szürkén, alulról fölfelé kitöltve. A sprite-hoz NEM
// nyúlunk (1:1 asset-kontraktus, shared/ui/clay/index.tsx): az alap egy `<use>` szürke-
// szűrővel, a kitöltés az orb testének újrarajzolása a nap tónusával, clipPath-be zárva.
// Buta prezentáció: a számokat a `useDayOrbFill` hook adja.
// ============================================================
import { useId } from 'react'
import type { ClaySpotName } from '@/shared/ui/clay'

/** Az alap sprite — a `ClaySpotName` unión keresztül nevezve, hogy egy sprite-átnevezés
 *  tsc-n bukjon, ne csendben, futásidőben (a `<use href>`-hez kézzel írt `'#s-orb'`
 *  string ezt megkerülte). A `ClaySpot` komponens nem jó ide: az orbnak a saját svg-jén
 *  belül, saját `className`-mel kell a `<use>`. */
const ORB_SPRITE: ClaySpotName = 's-orb'

/** A `#s-orb` teste: `circle cx=50 cy=48 r=34` → y-ban 14…82. */
const ORB_TOP = 14
const ORB_BOTTOM = 82
const ORB_SPAN = ORB_BOTTOM - ORB_TOP

/** A tónus két végpontja. A telt hármas maga az `sg-orb` gradiens a sprite-ból. */
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

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="dayorb">
      <defs>
        <clipPath id={`dayorb-fill-${uid}`}>
          <rect x="0" y={fillY} width="100" height={100 - fillY} />
        </clipPath>
        <clipPath id={`dayorb-body-${uid}`}>
          <circle cx="50" cy="48" r="34" />
        </clipPath>
        <radialGradient id={`dayorb-grad-${uid}`} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.45" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </radialGradient>
      </defs>

      <use href={`#${ORB_SPRITE}`} className="dayorb-base" />

      {clipped > 0 && (
        <g clipPath={`url(#dayorb-fill-${uid})`} className="dayorb-fill">
          <ellipse cx="50" cy="90" rx="26" ry="6" fill={stops[2]} opacity="0.28" />
          <circle cx="50" cy="48" r="34" fill={`url(#dayorb-grad-${uid})`} />
          <ellipse cx="37" cy="32" rx="12" ry="8" fill="rgba(255,255,255,0.55)" transform="rotate(-24 37 32)" />
          <path d="M27 61a28 28 0 0 0 13 11" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {clipped > 0 && clipped < 100 && (
        <g clipPath={`url(#dayorb-body-${uid})`}>
          <rect className="dayorb-meniscus" x="8" y={fillY - 1} width="84" height="2" rx="1" fill={stops[2]} opacity="0.7" />
        </g>
      )}
    </svg>
  )
}
