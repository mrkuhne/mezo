// ============================================================
// Mezo · Indító-képernyő (mezo-qducz; visszaöltöztetve mezo-ju4j6.3).
//
// A Titán változat egy ÉLŐ 3D jelenetet (TitanArtwork/WebGL) mutatott hideg grafit
// vásznon, és épp ezért kellett neki egy „készen van-e már" varrat: a három látható
// másodperc csak az első kirajzolt kockától indult, egy beragadt chunkra pedig 5
// másodperces vészkijárat vigyázott. A visszaállított világ jele STATIKUS agyag-gömb
// (`s-orb`) borostyán halo-sávon (style bible §2.2 C + §6) — az első kockán ott van,
// tehát a készültség-varrat tárgytalan, és vele a vészidőzítő is. A felhasználó felé a
// viselkedés VÁLTOZATLAN: három másodperc, aztán az app; addig a mögötte már mountolt
// felület inert.
//
// Üveg (mezo-me75u.10): a jel egy 150px-es levendula ÜVEG-GÖMB, benne levendula folyadék lassú
// hullámmal és egy fény-ívvel (a fejléc napi gömbjének rokona), levendula→arany halón, alatta a
// „boop" gradiens szó-logó. Mozgás csak a no-preference ágban; időzítés és viselkedés változatlan.
//
// Töltődés + keringés (mezo-1dxhp, prototípus indito-animacio.html „D"): a gömb a három
// másodperc alatt végig töltődik ~70%-ig, közben öt ikon egyesével felvillan körülötte és
// kering, a végén fénycsík söpör át az üvegen. A képkockákat a tiszta `splashFrame` adja, egy
// rAF-hurok írja a ref-ekre; csökkentett mozgásnál a nyugalmi kocka áll, semmi sem mozog.
// ============================================================
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { PhoneFrame } from '@/app/PhoneFrame'
import { Icon3D } from '@/shared/ui/clay'
import {
  BUBBLE_COUNT, ORBIT_ICONS, SPLASH_DURATION_MS, splashFrame,
} from '@/app/startupChoreography'
import '@/app/StartupSplash.css'

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

/** The glass orb with the fill + orbit choreography, driven by one rAF loop for the 3 s. */
function SplashMark() {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const q = <T extends Element>(sel: string) => el.querySelector<T>(sel)!
    const level = q<SVGGElement>('.startup-splash__level')
    const slosh = q<SVGGElement>('.startup-splash__slosh')
    const wave = q<SVGGElement>('.startup-splash__wave')
    const back = q<SVGPathElement>('.startup-splash__back')
    const sheen = q<HTMLElement>('.startup-splash__sheen')
    const glow = q<HTMLElement>('.startup-splash__glow')
    const bubbles = [...el.querySelectorAll<SVGCircleElement>('.startup-splash__bubble')]
    const icons = [...el.querySelectorAll<HTMLElement>('.startup-splash__orbit-ic')]

    const paint = (t: number, still: boolean) => {
      const f = splashFrame(t, still)
      level.setAttribute('transform', `translate(0 ${f.level - 88})`)
      slosh.setAttribute('transform', `rotate(${f.slosh} 75 88)`)
      wave.setAttribute('transform', `translate(${f.wave} 0)`)
      back.setAttribute('transform', `translate(${f.backWave} -3)`)
      back.setAttribute('opacity', String(f.backOpacity))
      f.bubbles.forEach((b, i) => {
        bubbles[i].setAttribute('cx', String(b.x))
        bubbles[i].setAttribute('cy', String(b.y))
        bubbles[i].setAttribute('opacity', String(b.opacity))
      })
      f.icons.forEach((ic, i) => {
        const node = icons[i]
        node.style.transform = `translate(${ic.x}px, ${ic.y}px) scale(${ic.scale})`
        node.style.opacity = String(ic.opacity)
        node.style.filter = ic.flash > 0 ? `brightness(${1 + ic.flash})` : ''
      })
      sheen.style.opacity = f.sheenOn ? '1' : '0'
      sheen.style.transform = `skewX(-20deg) translateX(${f.sheen}%)`
      glow.style.opacity = String(f.glow)
    }

    if (prefersStill()) {
      paint(0, true)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = now - start
      paint(t, false)
      if (t < SPLASH_DURATION_MS) raf = requestAnimationFrame(tick)
    }
    paint(0, false)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="startup-splash__mark" aria-hidden="true" ref={root}>
      <div className="startup-splash__glow" />
      {ORBIT_ICONS.map((icon) => (
        <span key={icon.id} className="startup-splash__orbit-ic" style={{ '--c': icon.c } as React.CSSProperties}>
          <Icon3D name={icon.id} size={46} />
        </span>
      ))}
      <div className="startup-splash__orb glass">
        <svg viewBox="0 0 150 150">
          <defs>
            <clipPath id="ss-orb-clip"><circle cx="75" cy="75" r="68" /></clipPath>
            <linearGradient id="ss-orb-liquid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E6DDFF" />
              <stop offset=".55" stopColor="#AB9FD2" />
              <stop offset="1" stopColor="#5E4F9A" />
            </linearGradient>
          </defs>
          <g clipPath="url(#ss-orb-clip)">
            <g className="startup-splash__level">
              <g className="startup-splash__slosh">
                <path className="startup-splash__back" fill="#5E4F9A" opacity="0"
                  d="M-20 88 Q0 98 20 88 T60 88 T100 88 T140 88 T180 88 V220 H-20Z" />
                <g className="startup-splash__wave">
                  <path className="startup-splash__liquid" fill="url(#ss-orb-liquid)"
                    d="M-20 88 Q0 78 20 88 T60 88 T100 88 T140 88 T180 88 V220 H-20Z" />
                </g>
              </g>
            </g>
            {Array.from({ length: BUBBLE_COUNT }, (_, i) => (
              <circle key={i} className="startup-splash__bubble" r={1.4 + (i % 3) * 0.7} opacity="0" />
            ))}
          </g>
          <path className="startup-splash__hi" d="M34 44 A48 48 0 0 1 62 26" />
        </svg>
        <i className="startup-splash__sheen" />
      </div>
    </div>
  )
}

/** App-root lifetime: route changes and foregrounding never restart the intro. */
export function StartupSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(() => !splashSkipped())

  useEffect(() => {
    if (!visible) return
    const timeout = window.setTimeout(() => setVisible(false), 3000)
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
            <div className="startup-splash" role="status" aria-label="Boop betöltése">
              <SplashMark />
              <span className="startup-splash__wordmark" aria-hidden="true">boop</span>
            </div>
          </PhoneFrame>
        </div>
      )}
    </>
  )
}
