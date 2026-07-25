import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export function ScreenContent({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  // The .screen-content div is the app's scroll container — without this, a route
  // change keeps the previous page's scroll offset (user QA, mezo-87d2).
  useEffect(() => {
    // scrollTop assignment (not scrollTo()) — works in every engine incl. jsdom.
    if (ref.current) ref.current.scrollTop = 0
  }, [pathname])
  return <div ref={ref} className="screen-content">{children}</div>
}
