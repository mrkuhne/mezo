// ============================================================
// Mezo · TitanCompanion — Nap/Mai presence mark (mezo-mhum): a titanium-petal
// + gold-core companion form, its aura tinted by the FIRST THREE need colors
// (proportional to band — dimmer when the need is unmet, honest but calm).
// Tapping it opens the Életjelek surface.
//
// Task 7 (mezo-mhum, tulajdonosi visszanyitás): a jel ÉL. Ahol a böngésző elbírja, a
// prototípus valódi Three.js jelenete rajzolódik ide (`TitanScene`, folyékony titán +
// arany mag + pályák, bloommal). Ahol nem — csökkentett mozgás, WebGL nélküli böngésző
// vagy teszt-környezet —, ott a korábbi statikus SVG marad, változatlanul.
//
// A three.js KIZÁRÓLAG lusta úton (React.lazy + dynamic import) jön be, hogy a saját
// chunkjában maradjon; a `live` kapu miatt a dinamikus import el sem indul, ha a jelenet
// úgysem futna. A Suspense fallback ugyanaz az SVG, tehát a helye sosem ugrik meg.
// ============================================================
import { Suspense, lazy, useState } from 'react'
import type { NeedState } from '@/features/today/logic/needs'
import { NEED_META } from '@/features/today/logic/needs'
import { cn } from '@/shared/lib/cn'

const TitanScene = lazy(() =>
  import('@/features/today/components/TitanScene').then((m) => ({ default: m.TitanScene })),
)

const AURA_ALPHA: Record<NeedState['band'], number> = {
  green: 0.35,
  yellow: 0.22,
  red: 0.12,
  critical: 0.12,
}

function withAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
}

/** Fut-e itt egyáltalán az élő jelenet? KÉT feltétel, és mindkettő a renderelés ELŐTT dől el,
 *  hogy a `React.lazy` importja el se induljon feleslegesen:
 *   1. a felhasználó nem kért csökkentett mozgást (a jelenet folyamatosan mozog);
 *   2. van WebGL (a jsdom-nak és a régi/kikapcsolt böngészőknek nincs — ott az SVG a helyes).
 *  Egyszer, mountkor kiértékelve: a WebGL megléte nem változik futás közben, a mozgás-
 *  preferencia változását pedig maga a jelenet kezeli (szünetelteti magát). */
function detectLive(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  // A konstruktor-próba ELŐBB: a jsdomnak nincs `WebGL2RenderingContext`-je, és így a
  // `getContext` meghívása (ami ott minden teszt-renderben egy „not implemented" zajsort
  // írna a konzolra) el sem indul. Böngészőben mindkét ellenőrzés lefut.
  if (!('WebGL2RenderingContext' in window)) return false
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'))
  } catch {
    return false
  }
}

/** A statikus jel: a nyugalmi állapot ÉS a jelenet betöltése alatti fallback. */
function TitanMark() {
  return (
    <svg className="titan-svg" viewBox="0 0 180 180" aria-hidden="true">
      <defs>
        <radialGradient id="titan-gold" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#fff6da" />
          <stop offset="55%" stopColor="#e7c467" />
          <stop offset="100%" stopColor="#a9803a" />
        </radialGradient>
        <linearGradient id="titan-metal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e4e1ec" />
          <stop offset="45%" stopColor="#b6b1c8" />
          <stop offset="100%" stopColor="#8b86a3" />
        </linearGradient>
        <radialGradient id="titan-planet" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#e3d3ff" />
          <stop offset="100%" stopColor="#8f6fd1" />
        </radialGradient>
      </defs>
      <g className="titan-form">
        <g className="titan-rings">
          <ellipse cx="90" cy="90" rx="76" ry="36" transform="rotate(-30 90 90)" fill="none" stroke="#9c8cbb" strokeWidth="1.4" />
          <ellipse cx="90" cy="90" rx="66" ry="30" transform="rotate(38 90 90)" fill="none" stroke="#c9bfe0" strokeWidth="1" />
          <circle className="titan-planet" cx="152" cy="59" r="6" fill="url(#titan-planet)" />
        </g>
        <g className="titan-petals" fill="url(#titan-metal)" stroke="#b6b1c8" strokeWidth="1">
          <path d="M84 20C22 31 25 107 62 124L73 90C48 70 61 47 84 20Z" />
          <path d="M84 20C22 31 25 107 62 124L73 90C48 70 61 47 84 20Z" transform="rotate(120 90 90)" />
          <path d="M84 20C22 31 25 107 62 124L73 90C48 70 61 47 84 20Z" transform="rotate(240 90 90)" />
        </g>
        <circle className="titan-core" cx="90" cy="90" r="24" fill="url(#titan-gold)" />
      </g>
    </svg>
  )
}

export function TitanCompanion({ states, onOpenSignals }: { states: NeedState[]; onOpenSignals: () => void }) {
  const [live] = useState(detectLive)
  const auraStates = states.slice(0, 3)
  const auraVars = Object.fromEntries(
    auraStates.map((s, i) => [`--aura-${i}`, withAlpha(NEED_META[s.key].color, AURA_ALPHA[s.band])]),
  ) as React.CSSProperties

  return (
    <button type="button" className={cn('titan-companion', live && 'is-live')} onClick={onOpenSignals} aria-label="Életjelek">
      <span className="titan-aura" style={auraVars} aria-hidden="true" />
      {live ? (
        <Suspense fallback={<TitanMark />}><TitanScene /></Suspense>
      ) : (
        <TitanMark />
      )}
    </button>
  )
}
