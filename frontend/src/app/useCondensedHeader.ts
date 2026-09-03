// ============================================================
// Mezo · A kitapadó fejléc kompakt módja (mezo-8az6).
// Az app EGYETLEN görgetője a `.screen-content` (screenScroll.ts) — a fejléc benne
// ül, tehát a saját scrolljára iratkozunk fel, passzívan. A küszöb fölött a fejléc
// aurora háttere kifakul, és áttetsző üvegsávvá húzódik össze; az ikonok végig
// elérhetők maradnak. A scroller hiányozhat (unit teszt, portálolt felület) — ilyenkor
// a hook csendben `false`-ot ad.
// ============================================================
import { useEffect, useState } from 'react'
import { screenScroller } from '@/shared/lib/screenScroll'

/** E fölött az offset fölött kompakt a fejléc. */
const THRESHOLD = 14

export function useCondensedHeader(): boolean {
  const [condensed, setCondensed] = useState(false)
  useEffect(() => {
    const el = screenScroller()
    if (!el) return
    const read = () => setCondensed(el.scrollTop > THRESHOLD)
    read() // a belépő állapot (route-váltás után a scroller a tetején áll, de ne feltételezzük)
    el.addEventListener('scroll', read, { passive: true })
    return () => el.removeEventListener('scroll', read)
  }, [])
  return condensed
}
