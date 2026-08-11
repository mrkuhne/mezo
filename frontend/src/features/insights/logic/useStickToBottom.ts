import { useCallback, useEffect, useRef } from 'react'

/** How close to the bottom still counts as "parked at the bottom" (px). */
const BOTTOM_THRESHOLD_PX = 96
/** How long after a programmatic scroll its own scroll events are ignored (ms). */
const SETTLE_MS = 500

/**
 * Keeps a conversation pinned to its newest message (mezo-at8x.2).
 *
 * The chat has no scroller of its own — it rides `.screen-content`, the single app scroller
 * (see `prototype.css`). Four things follow from that, each one a bug caught in browser QA:
 *
 * 1. **rAF, not a bare effect.** `ScreenContent` resets that scroller to `scrollTop = 0` on
 *    every route change, and a parent's effect runs AFTER its children's — so a scroll issued
 *    straight from ChatPage's effect gets undone on the way in. The rAF callback runs after
 *    both, so it wins.
 * 2. **`behavior: 'instant'`, always.** `.screen-content` carries `scroll-behavior: smooth`,
 *    which a bare `scrollTop =` (and `behavior: 'auto'`, which per spec DEFERS to the CSS
 *    value) both inherit — and in this container a smooth scroll never lands: it is cancelled
 *    by the next scroll operation, so re-anchoring crawled a few pixels and stopped, or did
 *    nothing at all. `'instant'` is the only value that reliably jumps.
 * 3. **Re-anchor when the content grows.** One scroll at mount is not enough: cards and web
 *    fonts finish laying out after that frame, so the transcript grows *under* an already-
 *    anchored view and the last turn ends up half-cut. A ResizeObserver re-anchors while the
 *    user is still parked at the bottom — which also covers a streaming answer growing line
 *    by line.
 * 4. **Stick only while the USER is at the bottom.** Yanking the view down while they are
 *    scrolled up reading history would make the transcript unusable — but a smooth
 *    programmatic scroll emits its own scroll events on the way, which read as "not at the
 *    bottom yet" and would switch sticking off mid-flight. Hence the settle window.
 */
export function useStickToBottom<T extends HTMLElement>() {
  const endRef = useRef<T>(null)
  const stuck = useRef(true)
  const settleUntil = useRef(0)

  const scrollerOf = () =>
    (endRef.current?.closest('.screen-content') as HTMLElement | null) ?? null

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const scroller = scrollerOf()
      stuck.current = true
      settleUntil.current = Date.now() + SETTLE_MS
      if (scroller?.scrollTo) {
        // Driving the scroller directly (rather than aligning the sentinel) is immune to how
        // the engine reads `block: 'end'` against a padded scrollport.
        scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'instant' })
        return
      }
      // No app scroller in reach (component tests, any other mount) — fall back to the anchor.
      // jsdom implements neither scrollIntoView nor layout, hence the guard.
      const end = endRef.current
      if (end && typeof end.scrollIntoView === 'function') {
        end.scrollIntoView({ block: 'end', behavior: 'instant' })
      }
    })
  }, [])

  const scrollIfStuck = useCallback(() => {
    if (stuck.current) scrollToBottom()
  }, [scrollToBottom])

  useEffect(() => {
    const scroller = scrollerOf()
    if (!scroller) return
    const onScroll = () => {
      if (Date.now() < settleUntil.current) return
      stuck.current =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < BOTTOM_THRESHOLD_PX
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })

    // Late layout (fonts, cards, a streaming answer) must not leave the view behind.
    const thread = endRef.current?.parentElement
    const observer =
      thread && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (!stuck.current) return
            settleUntil.current = Date.now() + SETTLE_MS
            scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'instant' })
          })
        : null
    if (thread) observer?.observe(thread)

    return () => {
      scroller.removeEventListener('scroll', onScroll)
      observer?.disconnect()
    }
  }, [])

  return { endRef, scrollToBottom, scrollIfStuck }
}
