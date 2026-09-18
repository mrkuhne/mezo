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
// ============================================================
import { useEffect, useState, type ReactNode } from 'react'
import { PhoneFrame } from '@/app/PhoneFrame'
import { ClaySpot } from '@/shared/ui/clay'
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
                <ClaySpot name="s-orb" size={168} />
              </div>
              <span className="startup-splash__wordmark" aria-hidden="true">boop</span>
            </div>
          </PhoneFrame>
        </div>
      )}
    </>
  )
}
