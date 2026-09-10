import { cn } from '@/shared/lib/cn'
import { useEffect, useState, type ReactNode } from 'react'
import { StatusBar } from '@/app/StatusBar'
import { daypartNow, type Daypart } from '@/shared/lib/daypart'

/** `scope`: egy útvonal-csoportra szabott megjelenés-osztály a shell BURKÁN (mezo-mhum).
 *  Azért ide kerül és nem az oldalra, mert a fejléc és a TabBar is a shellé — a Titán Nap
 *  sötét bőre csak akkor teljes, ha mind a hármat ugyanaz a scope éri el. */
export function PhoneFrame({ children, anchor = false, clock, scope }: { children: ReactNode; anchor?: boolean; clock?: string; scope?: string }) {
  const [daypart, setDaypart] = useState<Daypart>(() => daypartNow())
  useEffect(() => {
    const id = setInterval(() => setDaypart(daypartNow()), 60_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="app-root">
      <div className="phone">
        <div className={cn('phone-screen', anchor && 'anchor', scope)} data-day={daypart}>
          <div className="sky" aria-hidden="true" />
          <div className="dynamic-island" />
          <StatusBar clock={clock} />
          {children}
          <div className="home-indicator" />
        </div>
      </div>
    </div>
  )
}
