// ============================================================
// Mezo · sportKinds — the shared sport-kind vocabulary. Widened to the ten
// wire sport-session ids (mezo-88iwa.9, `SportSessionCreateRequest.sport`
// pattern `^(volleyball|cross|trx|bike|swim|football|basketball|tennis|hike|other)$`).
// One home for labels/tags so the log sheet, agenda row and heroes render
// the same names. `sportOf` resolves the optional discriminator (absent =
// volleyball, the Phase-1 mock default) — it stays generic so a caller whose
// own input type is narrower (a schedule slot, still `volleyball|cross|trx`
// — the schedule/event CHECKs are UNCHANGED, out of scope here) gets back
// that same narrower type, not the widened one.
//
// The schedule editor (`SportScheduleSheet.tsx`) and the one-off event sheet
// (`SportEventSheet.tsx`) do NOT use SPORT_KINDS/SportKind — their wire
// constraints (`ck_sport_schedule_slot_sport` / `ck_sport_event_sport`) stay
// at three ids, so each pins its own local literal list instead.
// ============================================================
export type SportKind =
  | 'volleyball' | 'cross' | 'trx' | 'bike' | 'swim' | 'football' | 'basketball' | 'tennis' | 'hike' | 'other'

export const SPORT_KINDS: SportKind[] = [
  'volleyball', 'cross', 'trx', 'bike', 'swim', 'football', 'basketball', 'tennis', 'hike', 'other',
]
/** Selector-chip labels (log sheet). */
export const SPORT_LABELS: Record<SportKind, string> = {
  volleyball: 'Röpi', cross: 'Cross', trx: 'TRX',
  bike: 'Bicikli', swim: 'Úszás', football: 'Foci', basketball: 'Kosár', tennis: 'Tenisz', hike: 'Túra', other: 'Egyéb',
}
/** `.stag`/`.typetag` tag text (weekly rows + heroes). */
export const SPORT_TAGS: Record<SportKind, string> = {
  volleyball: 'RÖPI', cross: 'CROSS', trx: 'TRX',
  bike: 'BICIKLI', swim: 'ÚSZÁS', football: 'FOCI', basketball: 'KOSÁR', tennis: 'TENISZ', hike: 'TÚRA', other: 'EGYÉB',
}
/** Row/hero titles. */
export const SPORT_TITLES: Record<SportKind, string> = {
  volleyball: 'Volleyball', cross: 'Cross', trx: 'TRX',
  bike: 'Kerékpár', swim: 'Úszás', football: 'Foci', basketball: 'Kosárlabda', tennis: 'Tenisz', hike: 'Túra', other: 'Egyéb mozgás',
}
/** LEGACY (Mozaik-era): only weeklyLoad's Futás load tile still renders these. Titanium
 * surfaces use clay art ids from logic/sports.ts — never add a new consumer (mezo-0bxgl). */
export const SPORT_EMOJI: Record<SportKind, string> = {
  volleyball: '🏐', cross: '⚡', trx: '🪢',
  bike: '🚴', swim: '🏊', football: '⚽', basketball: '🏀', tennis: '🎾', hike: '🥾', other: '🏃',
}

export function sportOf<T extends SportKind = SportKind>(s: { sport?: T }): T {
  return (s.sport ?? 'volleyball') as T
}

/** The five modality tones a session card / type tag can carry (mezo-9bbc). */
export type SessionTone = 'gym' | 'sport' | 'cross' | 'trx' | 'run'
/** One home for "which tone does this sport wear" — consumed by cards, tags and rows.
 * Every sport but cross/trx wears the generic `sport` tone. */
export const SPORT_TONE: Record<SportKind, SessionTone> = {
  volleyball: 'sport', cross: 'cross', trx: 'trx',
  bike: 'sport', swim: 'sport', football: 'sport', basketball: 'sport', tennis: 'sport', hike: 'sport', other: 'sport',
}
