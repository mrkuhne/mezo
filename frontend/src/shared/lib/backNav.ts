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
