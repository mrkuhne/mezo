// ============================================================
// Mezo · warmupProtocol — the fixed, session-level warm-up protocol (3 blocks).
//
// The type and its rows used to live on `pages/prep/PrepBemelegitesPage.tsx`; that
// page died with the prep mosaic (mezo-e1ii9 — the workout now opens straight in the
// Titanium card list, where the per-exercise warm-up is the amber B-rows). The data
// outlives the page it was drawn on, so it lives in logic/ now rather than keeping a
// screen alive for a type.
// ============================================================
export interface WarmupRow { label: string; time: string; minutes: number }

export const WARMUP_ROWS: readonly WarmupRow[] = [
  { label: 'Dinamikus stretching', time: '3 perc', minutes: 3 },
  { label: 'Cardio-lite · evezőpad', time: '3 perc', minutes: 3 },
  { label: 'Aktiváció · band pull-apart × 20', time: '2 perc', minutes: 2 },
] as const
