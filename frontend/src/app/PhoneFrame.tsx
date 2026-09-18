import { cn } from '@/shared/lib/cn'
import { useEffect, useState, type ReactNode } from 'react'
import { StatusBar } from '@/app/StatusBar'
import { daypartNow, type Daypart } from '@/shared/lib/daypart'
import { installViewportInsets } from '@/shared/lib/viewportInsets'

/* A `scope` prop (mezo-mhum) a Titán sötét bőrt vitte a shell burkára; a
   visszaöltöztetés (mezo-ju4j6.3) törölte az egyetlen hívóját és vele a propot is — a
   shell megjelenése innentől nem útvonal-függő. */
export function PhoneFrame({ children, anchor = false, clock }: { children: ReactNode; anchor?: boolean; clock?: string }) {
  const [daypart, setDaypart] = useState<Daypart>(() => daypartNow())
  useEffect(() => {
    const id = setInterval(() => setDaypart(daypartNow()), 60_000)
    return () => clearInterval(id)
  }, [])
  // The shell must track the VISIBLE viewport, not the layout one, or the mobile
  // keyboard pushes every docked surface (sheets, tab bar, save bars) off-screen.
  useEffect(() => installViewportInsets(), [])
  return (
    <div className="app-root">
      <div className="phone">
        <div className={cn('phone-screen', anchor && 'anchor')} data-day={daypart}>
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
