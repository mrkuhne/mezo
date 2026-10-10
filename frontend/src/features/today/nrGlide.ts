/** How long a routine row's strength level glides to its new width after a tick, and how long its
 *  number counts there, so the two are one movement (mezo-apwd). The CSS rule
 *  (`styles/folyadek-nap-rutin.css`, `.nr2-page .fo-row .fo-level i`) carries the same figure;
 *  `nrStrTransitionGuard.test.ts` holds the two together. */
export const NR_GLIDE_MS = 380
