import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollToOffset, scrollToTop } from '@/shared/lib/screenScroll'
import { useArrival } from '@/shared/ui/mozaik/arrival'

export function ScreenContent({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { pathname, key } = useLocation()
  const arrival = useArrival()
  // Where the user left each history entry, so a back navigation can put them back there
  // instead of at the top — losing the offset is half of what makes the browser/OS
  // swipe-back gesture feel like a reload (mezo-kuwj).
  const offsets = useRef(new Map<string, number>())
  // The pathname the scroller is currently parked on. The reset is gated on the PATH, not
  // on the history entry: a search-param-only navigation (a Mai day-hop, a FuelLog day
  // step — both `replace`) mints a fresh location key but is a view switch, not an arrival,
  // and must leave the scroll position alone.
  const parked = useRef<string | null>(null)

  // Record the offset live from the scroll event rather than reading it on the way out:
  // swapping in a shorter page clamps scrollTop in the same commit, so a read taken after
  // the route change would remember the clamped value instead of where the user was.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const remember = () => { offsets.current.set(key, el.scrollTop) }
    el.addEventListener('scroll', remember, { passive: true })
    return () => el.removeEventListener('scroll', remember)
  }, [key])

  // The .screen-content div is the app's scroll container — without this, a route
  // change keeps the previous page's scroll offset (user QA, mezo-87d2). The instant
  // (never smooth-animated) reset itself lives in scrollToTop, which a page swapping
  // its whole tree WITHOUT navigating also calls (mezo-vad0).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const remembered = offsets.current.get(key)
    if (arrival === 'pop' && remembered !== undefined) scrollToOffset(el, remembered)
    else if (parked.current !== pathname) scrollToTop(el)
    parked.current = pathname
  }, [key, pathname, arrival])

  return <div ref={ref} className="screen-content">{children}</div>
}
