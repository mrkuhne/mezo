import { cn } from '@/shared/lib/cn'
import { useEffect, useState, type ReactNode } from 'react'
import { StatusBar } from '@/app/StatusBar'
import { daypartNow, type Daypart } from '@/shared/lib/daypart'

export function PhoneFrame({ children, anchor = false, clock }: { children: ReactNode; anchor?: boolean; clock?: string }) {
  const [daypart, setDaypart] = useState<Daypart>(() => daypartNow())
  useEffect(() => {
    const id = setInterval(() => setDaypart(daypartNow()), 60_000)
    return () => clearInterval(id)
  }, [])
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
