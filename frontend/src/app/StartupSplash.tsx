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
// ============================================================
import { useEffect, useState, type ReactNode } from 'react'
import { PhoneFrame } from '@/app/PhoneFrame'
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
              <div className="startup-splash__mark" aria-hidden="true">
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
                      <g className="startup-splash__wave">
                        <path className="startup-splash__liquid" fill="url(#ss-orb-liquid)"
                          d="M-20 88 Q0 78 20 88 T60 88 T100 88 T140 88 T180 88 V160 H-20Z" />
                      </g>
                    </g>
                    <path className="startup-splash__hi" d="M34 44 A48 48 0 0 1 62 26" />
                  </svg>
                </div>
              </div>
              <span className="startup-splash__wordmark" aria-hidden="true">boop</span>
            </div>
          </PhoneFrame>
        </div>
      )}
    </>
  )
}
