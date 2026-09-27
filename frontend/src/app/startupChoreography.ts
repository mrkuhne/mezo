// ============================================================
// Mezo · Indító-képernyő koreográfiája (mezo-1dxhp).
//
// A jóváhagyott prototípus (docs/design_2.0/prototypes/indito-animacio.html, „D · Töltődés +
// keringés") képkocka-függvénye, tisztán: idő be, számok ki. A gömb a három másodperc alatt
// végig töltődik ~70%-ig (a kivezetés kezdetére áll meg), közben 0,1 s-mal utána öt ikon
// egyesével felvillan a kör mentén, és kering. Az SVG-koordináták a 150-es gömb-viewBoxban,
// az ikon-eltolások pixelben értendők.
// ============================================================

export const SPLASH_DURATION_MS = 3000
export const SPLASH_FADE_MS = 300

/** The orbit, in spawn order. `c` is the icon's accent for its glow. */
export const ORBIT_ICONS = [
  { id: 't-sun', c: 'var(--dv-amber)' },
  { id: 't-dumbbell', c: 'var(--dv-coral)' },
  { id: 't-bowl', c: 'var(--dv-sage)' },
  { id: 't-water', c: 'var(--dv-sky)' },
  { id: 't-moon', c: 'var(--dv-lav)' },
] as const

export const ORBIT_RADIUS_PX = 108
export const BUBBLE_COUNT = 7

const FILL_MS = SPLASH_DURATION_MS - SPLASH_FADE_MS // the fill comes to rest as the fade starts
const EMPTY_Y = 150 // liquid surface below the orb's rim
const FULL_Y = 48 // ~70% of the 136-unit inner circle
const SPAWN_AT = 100 // the fill leads by 0.1 s
const SPAWN_STAGGER = 240
const SPAWN_MS = 480
const SPIN_MS = 5200 // one full turn
const SHEEN_AT = 2250
const SHEEN_MS = 520
const FLASH_AT = 2450

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const outCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const inOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const sineOut = (x: number) => Math.sin((x * Math.PI) / 2)
/** 0 → 1 with a ~7% overshoot: the icon's "pop". */
const backOut = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2)
const bob = (t: number, period: number) => (1 - Math.cos((2 * Math.PI * t) / period)) / 2

export interface SplashFrame {
  /** Liquid surface y (0 = orb top, 150 = bottom) — the wave path's baseline is 88. */
  level: number
  /** Slosh rotation of the liquid, degrees, around (75, level). */
  slosh: number
  wave: number
  backWave: number
  backOpacity: number
  bubbles: { x: number; y: number; opacity: number }[]
  icons: { x: number; y: number; scale: number; opacity: number; flash: number }[]
  /** Sheen band position, percent of its own width (-120 → 320); `sheenOn` false hides it. */
  sheen: number
  sheenOn: boolean
  glow: number
}

/** The frame at `t` ms. `still` is the reduced-motion resting frame (time-independent). */
export function splashFrame(t: number, still = false): SplashFrame {
  const p = still ? 1 : sineOut(clamp(t / FILL_MS))
  const level = EMPTY_Y + (FULL_Y - EMPTY_Y) * p
  const calm = 1 - 0.75 * p

  const bubbles = Array.from({ length: BUBBLE_COUNT }, (_, i) => {
    const age = (still ? 0 : t) - (80 + i * 290)
    const y = 142 - age * 0.07
    const x = 38 + ((i * 23) % 76) + 4 * Math.sin(age / 140 + i)
    const visible = !still && age > 0 && y > level + 4
    return { x, y, opacity: visible ? 0.75 * clamp(age / 200) * clamp((y - level - 4) / 14) : 0 }
  })

  const spin = still ? 0 : t / SPIN_MS
  const icons = ORBIT_ICONS.map((_, i) => {
    const s = still ? 1 : clamp((t - SPAWN_AT - i * SPAWN_STAGGER) / SPAWN_MS)
    const th = 2 * Math.PI * (i / ORBIT_ICONS.length + spin) - Math.PI / 2
    return {
      x: ORBIT_RADIUS_PX * Math.cos(th),
      y: ORBIT_RADIUS_PX * Math.sin(th),
      scale: 0.35 + 0.65 * backOut(s),
      opacity: outCubic(s),
      flash: s > 0 && s < 1 ? 1.1 * (1 - s) : 0,
    }
  })

  const sh = clamp((t - SHEEN_AT) / SHEEN_MS)
  const flash = Math.max(0, 1 - Math.abs(t - FLASH_AT) / 260)

  return {
    level,
    slosh: still ? 0 : 7 * Math.sin(t / 240) * calm,
    wave: still ? 0 : -10 * bob(t, 1300),
    backWave: still ? 0 : -10 * bob(t + 650, 1300),
    backOpacity: still ? 0 : 0.55,
    bubbles,
    icons,
    sheen: -120 + 440 * inOutCubic(sh),
    sheenOn: !still && sh > 0 && sh < 1,
    glow: still ? 0.25 : 0.1 + 0.8 * flash + 0.15 * p,
  }
}
