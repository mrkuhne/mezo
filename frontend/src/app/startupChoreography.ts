// ============================================================
// Mezo · Indító-képernyő időzítése (Folyadék F1, mezo-n4wf5.1).
//
// A nyitány (owner, 2026-10-19, mezo-rn5q7: „csak a cím, és kiesnek a kis menü-buborékok")
// tisztán CSS-idővonal. Ami itt él, az az EGYETLEN számtábla:
// a komponens ezekből ír CSS custom property-ket a gyökérre, a stíluslap pedig csak azokra
// hivatkozik — a JS és a CSS tehát nem csúszhat el egymástól.
// ============================================================

/** The whole intro: after this the splash unmounts and the app is there. */
export const SPLASH_DURATION_MS = 1600
/** The splash starts fading out here (the fade itself runs to SPLASH_DURATION_MS). */
export const FADE_AT_MS = 1150
/** The first drop falls out of the wordmark. */
export const DROP_START_MS = 280
/** Each next drop leaves this much later (left to right). */
export const DROP_STAGGER_MS = 70
/** One drop's emerge + fall + squash + settle. */
export const DROP_FALL_MS = 480
/** How many drops (= domains) the intro has. */
export const DROP_COUNT = 5
