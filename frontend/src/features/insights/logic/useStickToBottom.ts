import { useCallback, useEffect, useRef } from 'react'

/** How close to the bottom still counts as "parked at the bottom" (px). */
const BOTTOM_THRESHOLD_PX = 96

/**
 * Keeps a conversation pinned to its newest message (mezo-at8x.2).
 *
 * The chat has no scroller of its own — it rides `.screen-content`, the single app scroller
 * (see `prototype.css`). Two things follow from that:
 *
 * 1. **rAF, not a bare effect.** `ScreenContent` resets that scroller to `scrollTop = 0` on
 *    every route change, and a parent's effect runs AFTER its children's — so a scroll issued
 *    straight from ChatPage's effect gets undone on the way in. The rAF callback runs after
 *    both, so it wins.
 * 2. **Stick only while the user is at the bottom.** Streaming deltas arrive many times per
 *    second; yanking the view down while the user is scrolled up reading history would make
 *    the transcript unreadable.
 */
export function useStickToBottom<T extends HTMLElement>() {
  const endRef = useRef<T>(null)
  const stuck = useRef(true)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      const end = endRef.current
      // jsdom has no layout and no scrollIntoView — the guard keeps component tests honest.
      if (end && typeof end.scrollIntoView === 'function') {
        end.scrollIntoView({ block: 'end', behavior })
      }
      stuck.current = true
    })
  }, [])

  const scrollIfStuck = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      if (stuck.current) scrollToBottom(behavior)
    },
    [scrollToBottom],
  )

  useEffect(() => {
    const scroller = endRef.current?.closest('.screen-content')
    if (!scroller) return
    const onScroll = () => {
      stuck.current =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < BOTTOM_THRESHOLD_PX
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  return { endRef, scrollToBottom, scrollIfStuck }
}
