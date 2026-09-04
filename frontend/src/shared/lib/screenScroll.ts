// ============================================================
// Mezo · The app's single scroll container (.screen-content, prototype.css)
// and the "jump it to the top" primitive.
//
// ScreenContent resets the offset on every ROUTE change; a page that swaps its
// whole tree WITHOUT navigating (the active workout's prep → active phase flip,
// mezo-vad0) must ask for the same reset itself — otherwise the new screen
// renders under the previous one's scroll offset.
// ============================================================

/** The app's one scroller — null outside the shell (unit tests, portaled sheets). */
export function screenScroller(): HTMLElement | null {
  return document.querySelector('.screen-content')
}

/**
 * Jump a scroll container to the top INSTANTLY. `behavior: 'instant'` is deliberate
 * (not a bare `scrollTop = 0`): `.screen-content` carries `scroll-behavior: smooth`, so
 * the assignment would start an ANIMATED scroll that keeps running into the next frames
 * and overrides whatever the landing screen does with its own scroll position. The
 * scrollTo guard + assignment fallback keeps this working in jsdom, which implements
 * neither scrollTo nor layout.
 */
export function scrollToTop(el: HTMLElement | null): void {
  scrollToOffset(el, 0)
}

/**
 * Jump a scroll container to a REMEMBERED offset instantly — the back-navigation
 * counterpart of `scrollToTop` (mezo-kuwj), sharing its `behavior: 'instant'` rationale
 * and its jsdom-safe scrollTo guard.
 */
export function scrollToOffset(el: HTMLElement | null, top: number): void {
  if (!el) return
  if (typeof el.scrollTo === 'function') el.scrollTo({ top, behavior: 'instant' })
  else el.scrollTop = top
}
