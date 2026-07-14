// ============================================================
// Mezo · sportKinds — the shared sport-kind vocabulary (volleyball|cross|trx).
// One home for labels/tags so the log sheet, schedule editor, agenda row and
// heroes render the same names. `sportOf` resolves the optional discriminator
// (absent = volleyball, the Phase-1 mock default).
// ============================================================
export type SportKind = 'volleyball' | 'cross' | 'trx'

export const SPORT_KINDS: SportKind[] = ['volleyball', 'cross', 'trx']
/** Selector-chip labels (log sheet + schedule editor). */
export const SPORT_LABELS: Record<SportKind, string> = { volleyball: 'Röpi', cross: 'Cross', trx: 'TRX' }
/** `.stag`/`.typetag` tag text (weekly rows + heroes). */
export const SPORT_TAGS: Record<SportKind, string> = { volleyball: 'RÖPI', cross: 'CROSS', trx: 'TRX' }
/** Row/hero titles. */
export const SPORT_TITLES: Record<SportKind, string> = { volleyball: 'Volleyball', cross: 'Cross', trx: 'TRX' }
export const SPORT_EMOJI: Record<SportKind, string> = { volleyball: '🏐', cross: '⚡', trx: '🪢' }

export const sportOf = (s: { sport?: SportKind }): SportKind => s.sport ?? 'volleyball'
