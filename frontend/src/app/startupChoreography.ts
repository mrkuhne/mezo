// ============================================================
// Mezo · Indító-képernyő időzítése (Folyadék F1, mezo-n4wf5.1).
//
// A jóváhagyott „egy edény, öt csepp" nyitány (docs/design_2.0/prototypes/vilagos/keret.js,
// `splash()` + `runSplash()`) tisztán CSS-idővonal. Ami itt él, az az EGYETLEN számtábla:
// a komponens ezekből ír CSS custom property-ket a gyökérre, a stíluslap pedig csak azokra
// hivatkozik — a JS és a CSS tehát nem csúszhat el egymástól.
// ============================================================

/** The whole intro: after this the splash unmounts and the app is there. */
export const SPLASH_DURATION_MS = 3000
/** The splash starts fading out here (the fade itself runs to SPLASH_DURATION_MS). */
export const FADE_AT_MS = 2400
/** The stack starts draining and the first drop leaves the vessel. */
export const DROP_START_MS = 1080
/** Each next drop leaves this much later (left to right). */
export const DROP_STAGGER_MS = 170
/** One drop's fall + squash + settle. */
export const DROP_FALL_MS = 560
/** How many drops (= domains) the intro has. */
export const DROP_COUNT = 5
