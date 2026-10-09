// ============================================================
// Mezo · Indító-képernyő (Folyadék F1, mezo-n4wf5.1).
//
// „Egy edény, öt csepp": egy fehér kapszula-edény megtelik öt színes folyadék-réteggel (az öt
// domain), majd a verem kifolyik az alján, és minden réteg cseppként a helyére hullik az alsó
// sávban; végül a bevezető elhalványul, és ott az app. A felhasználó felé a viselkedés VÁLTOZATLAN:
// három másodperc, aztán az app; addig a mögötte már mountolt felület inert.
//
// A mozgás tisztán CSS-idővonal (StartupSplash.css, prototípus: vilagos/keret.js `splash()`); az
// időzítések a startupChoreography.ts számtáblájából jönnek, a gyökér --sp-* property-jein át.
// A cseppek a VALÓDI alsó sáv jelölését és receptjét használják (BottomBar: navDropSpec), így
// pixelre ott érnek földet, ahol a sáv cseppjei állnak.
// ============================================================
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { PhoneFrame } from '@/app/PhoneFrame'
import { DOMAINS } from '@/app/navModel'
import { navDropSpec } from '@/app/BottomBar'
import { Drop } from '@/shared/ui/folyadek'
import {
  DROP_FALL_MS, DROP_START_MS, DROP_STAGGER_MS, FADE_AT_MS, SPLASH_DURATION_MS,
} from '@/app/startupChoreography'
import '@/app/StartupSplash.css'

/** The vessel's five liquid layers, bottom → top = Nap, Edzés, Fuel, Mezo, Én (keret.js `DOMS`: top, body). */
const LAYERS = [
  ['#19C7C0', '#1877F2'], ['#F7B23B', '#F2683A'], ['#8FD14F', '#149E6E'], ['#E06BB5', '#6B4FE0'], ['#46D3B3', '#0E94B8'],
] as const

/** A wave strip (keret.js `W`): a tiled sine, drifting sideways in the no-preference branch. */
function Wave({ color }: { color: string }) {
  return (
    <svg className="fo-sp-w" viewBox="0 0 800 20" preserveAspectRatio="none" aria-hidden="true">
      <path fill={color}
        d={`M0 10 Q25 0 50 10 ${Array.from({ length: 15 }, (_, i) => `T${100 + i * 50} 10`).join(' ')} V20 H0Z`} />
    </svg>
  )
}

/**
 * Harness-varrat (mezo-u1n6l): a layout-teszt minden route-ot HIDEG betöltéssel jár be, és a
 * bevezető három másodpercig `aria-hidden`-re teszi az egész tartalmat — egy szerep-alapú
 * lekérdezés (`getByRole`) ezért csak ~3,3 s után talál bármit. Öt domain × 3,3 s ~ 17 s a
 * 30 s-os teszt-keretből, és CI-terhelés alatt ez borította a `navigation.spec.ts`-t
 * (mindig a kör KÉSŐBBI doménjeinél — nem volt renderelési rés, csak elfogyott a keret).
 *
 * A zászló CSAK fejlesztői buildben él (`import.meta.env.DEV`), tehát a szállított appból
 * hiányzik: a felhasználó felé a bevezető változatlanul három másodperc. A `localStorage`
 * olvasása védett — privát ablakban dobhat, és akkor a bevezető a normál útján megy.
 */
function splashSkipped(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    return localStorage.getItem('mezo.splash.skip') === '1'
  } catch {
    return false
  }
}

function prefersStill(): boolean {
  if (typeof window.requestAnimationFrame !== 'function') return true
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    return false
  }
}

/** The CSS timeline's numbers, handed to the stylesheet from the one table (no copies in CSS). */
const TIMELINE = {
  '--sp-end': `${SPLASH_DURATION_MS}ms`,
  '--sp-fade': `${FADE_AT_MS}ms`,
  '--sp-drop-start': `${DROP_START_MS}ms`,
  '--sp-stagger': `${DROP_STAGGER_MS}ms`,
  '--sp-fall': `${DROP_FALL_MS}ms`,
} as CSSProperties

/** The vessel, the wordmark and the (non-interactive) bar of drops the stack lands in. */
function SplashScene() {
  return (
    <div className="fo-sp" role="status" aria-label="Boop betöltése"
      data-motion={prefersStill() ? 'still' : 'play'} style={TIMELINE}>
      <div className="fo-sp-ves" aria-hidden="true">
        <div className="fo-sp-stk">
          {LAYERS.map(([top, body], i) => (
            <i key={i} data-layer={DOMAINS[i].id}
              style={{ '--i': i, '--c1': top, '--c2': body, '--lv': `${(i + 1) * 17 + 4}%`, zIndex: 9 - i } as CSSProperties}>
              <Wave color={top} />
            </i>
          ))}
        </div>
        <em />
      </div>
      <b className="fo-sp-wm" aria-hidden="true">boop</b>
      <div className="fo-nav fo-sp-bar" aria-hidden="true">
        {DOMAINS.map((d, i) => {
          const on = d.id === 'nap'
          const spec = navDropSpec(d.id, on)
          return (
            <div key={d.id} className={on ? 'fo-nav-item on' : 'fo-nav-item'} data-domain={d.id}
              style={{ '--c': spec.color, '--i': i } as CSSProperties}>
              <span className="fo-sp-dx"><span className="fo-sp-dr"><Drop {...spec} /></span></span>
              <span className="fo-sp-l">{d.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** App-root lifetime: route changes and foregrounding never restart the intro. */
export function StartupSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(() => !splashSkipped())

  useEffect(() => {
    if (!visible) return
    const timeout = window.setTimeout(() => setVisible(false), SPLASH_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [visible])

  return (
    <>
      <div className="startup-content" inert={visible} aria-hidden={visible || undefined}>
        {children}
      </div>
      {visible && (
        <div className="startup-stage">
          <PhoneFrame>
            <SplashScene />
          </PhoneFrame>
        </div>
      )}
    </>
  )
}
