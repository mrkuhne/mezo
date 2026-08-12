import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export function ScreenContent({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  // The .screen-content div is the app's scroll container — without this, a route
  // change keeps the previous page's scroll offset (user QA, mezo-87d2).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // `behavior: 'instant'` — NOT a bare `scrollTop = 0`: `.screen-content` carries
    // `scroll-behavior: smooth`, so the assignment starts an ANIMATED scroll that keeps
    // running into the next frames and overrides anything the landing page does with its own
    // scroll position (it ate the chat's scroll-to-newest, mezo-at8x.2). A route change should
    // land at the top instantly anyway. scrollTo is guarded — jsdom implements neither it nor
    // layout, and the assignment fallback keeps the shell tests working.
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior: 'instant' })
    else el.scrollTop = 0
  }, [pathname])
  return <div ref={ref} className="screen-content">{children}</div>
}
