// ============================================================
// Mezo · Indító-képernyő (Folyadék F1, mezo-n4wf5.1).
//
// „Cím, és kiesnek a cseppek" (owner, 2026-10-19, mezo-rn5q7 — az edény-feltöltés túl hosszú volt):
// megjelenik a „boop" szó-logó, belőle balról jobbra kihullik az öt menü-csepp, és mindegyik a
// helyére esik az alsó sávban; végül a bevezető elhalványul, és ott az app — a színpad ÁTLÁTSZÓ
// rátét (a saját telefon-kerete semmit nem fest), így a halványulás a mögötte már mountolt appba
// olvad át. 1,6 másodperc, aztán az app; addig a mögötte már mountolt felület inert.
//
// A mozgás tisztán CSS-idővonal (StartupSplash.css, prototípus: vilagos/keret.js `splash()`); az
// időzítések a startupChoreography.ts számtáblájából jönnek, a gyökér --sp-* property-jein át.
// A cseppek a VALÓDI alsó sáv jelölését és receptjét használják (BottomBar: navDropSpec), így
// pixelre ott érnek földet, ahol a sáv cseppjei állnak.
// ============================================================
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { PhoneFrame } from '@/app/PhoneFrame'
import { DOMAINS, activeDomainId, domainName } from '@/app/navModel'
import { useM } from '@/shared/i18n'
import { navDropSpec } from '@/app/BottomBar'
import { Drop } from '@/shared/ui/folyadek'
import {
  DROP_FALL_MS, DROP_START_MS, DROP_STAGGER_MS, FADE_AT_MS, SPLASH_DURATION_MS,
} from '@/app/startupChoreography'
import '@/app/StartupSplash.css'

/**
 * Harness-varrat (mezo-u1n6l): a layout-teszt minden route-ot HIDEG betöltéssel jár be, és a
 * bevezető a teljes idejére `aria-hidden`-re teszi az egész tartalmat — egy szerep-alapú
 * lekérdezés (`getByRole`) ezért csak utána talál bármit. Öt domain × (akkor) 3,3 s ~ 17 s a
 * 30 s-os teszt-keretből, és CI-terhelés alatt ez borította a `navigation.spec.ts`-t
 * (mindig a kör KÉSŐBBI doménjeinél — nem volt renderelési rés, csak elfogyott a keret).
 *
 * A zászló CSAK fejlesztői buildben él (`import.meta.env.DEV`), tehát a szállított appból
 * hiányzik: a felhasználó felé a bevezető változatlanul lefut. A `localStorage`
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

/** The wordmark and the (non-interactive) bar of drops that fall out of it. */
function SplashScene() {
  const label = useM().frame.splash.label
  // The drop that lands „on" is the domain the app opens on (read once from the URL — the stage
  // lives outside the router), so the scene dissolves into the real bar without a size jump.
  const opening = activeDomainId(typeof window !== 'undefined' ? window.location.pathname : '') ?? 'nap'
  return (
    <div className="fo-sp" role="status" aria-label={label}
      data-motion={prefersStill() ? 'still' : 'play'} style={TIMELINE}>
      <b className="fo-sp-wm" aria-hidden="true">boop</b>
      <div className="fo-nav fo-sp-bar" aria-hidden="true">
        {DOMAINS.map((d, i) => {
          const on = d.id === opening
          const spec = navDropSpec(d.id, on)
          return (
            <div key={d.id} className={on ? 'fo-nav-item on' : 'fo-nav-item'} data-domain={d.id}
              style={{ '--c': spec.color, '--i': i } as CSSProperties}>
              <span className="fo-sp-dx"><span className="fo-sp-dr"><Drop {...spec} /></span></span>
              <span className="fo-sp-l">{domainName(d)}</span>
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
