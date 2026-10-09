import type { NavigateFunction as Navigate } from 'react-router-dom'

/**
 * „Vissza oda, ahonnan jöttél" (owner rule): is there an in-app entry to return to?
 *
 * The ONE decision every back control shares — the frame's title bar, `PageHead` / `FrameBack`
 * and the `useBackNav` / `useBackTo` hooks — so the rules cannot disagree.
 *
 * The browser router keeps the entry index in `history.state.idx`: 0 means the app was opened
 * on this entry (a deep link, or a redirect that REPLACED it) — nothing to return to, so the
 * back control must use its fallback route. A router that keeps no index (memory) tells by the
 * location key instead, which is `'default'` only on the initial entry.
 */
export function canGoBack(historyState: unknown, locationKey: string): boolean {
  const idx = (historyState as { idx?: unknown } | null | undefined)?.idx
  return typeof idx === 'number' ? idx > 0 : locationKey !== 'default'
}


/**
 * Leaving a form / wizard / detail page AFTER its mutation succeeded (save, create, delete,
 * submit): the entry the user is leaving must not stay behind them, or the header's history
 * back would walk straight back into the form — or into the record that was just deleted.
 * So the destination REPLACES the current entry instead of being pushed on top of it.
 */
export function leaveAfterMutation(navigate: Navigate, target: string): void {
  void navigate(target, { replace: true })
}

/**
 * The same leave, for an editor that is ALWAYS entered from one page (edit ← its detail): pop
 * back onto that page — a replace would leave it twice in a row (detail → detail). On a direct
 * open (nothing in-app behind us) the page it belongs to replaces the editor instead.
 */
export function leaveBackAfterMutation(
  navigate: Navigate, historyState: unknown, locationKey: string, origin: string,
): void {
  if (canGoBack(historyState, locationKey)) void navigate(-1)
  else void navigate(origin, { replace: true })
}

/**
 * A DELETE issued from such an editor: the record's own detail page sits right behind it and
 * must go too. Pop onto it, then replace it with the list. Only the browser router exposes the
 * entry index that proves there is a detail entry to pop onto (and fires `popstate` when the pop
 * landed); anywhere else the list simply replaces the editor.
 */
export function leaveDeletedFromEditor(
  navigate: Navigate, historyState: unknown, list: string,
): void {
  const idx = (historyState as { idx?: unknown } | null | undefined)?.idx
  if (typeof idx === 'number' && idx > 0 && typeof window !== 'undefined') {
    window.addEventListener('popstate', () => { void navigate(list, { replace: true }) }, { once: true })
    void navigate(-1)
  } else {
    void navigate(list, { replace: true })
  }
}
