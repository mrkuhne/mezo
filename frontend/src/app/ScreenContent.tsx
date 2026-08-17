import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollToTop } from '@/shared/lib/screenScroll'

export function ScreenContent({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  // The .screen-content div is the app's scroll container — without this, a route
  // change keeps the previous page's scroll offset (user QA, mezo-87d2). The instant
  // (never smooth-animated) reset itself lives in scrollToTop, which a page swapping
  // its whole tree WITHOUT navigating also calls (mezo-vad0).
  useEffect(() => {
    scrollToTop(ref.current)
  }, [pathname])
  return <div ref={ref} className="screen-content">{children}</div>
}
