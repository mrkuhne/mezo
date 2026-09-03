// ============================================================
// Mezo · kalauz hang-lint primitívek (mezo-gb1s.4).
// Két adathalmaz linteli magát velük: a KALAUZ_REGISTRY kártyái (registry.test.ts)
// és a WELCOME lépései (welcome.test.ts). A szabály EGY helyen él, hogy a welcome
// ne csússzon ki alóla.
// ============================================================

/** Stems, not whole words — no trailing \b — so inflections ("kellene", "hibázik",
 *  "elbuktad", "rosszul") are caught too, not just the dictionary form. */
export const FORBIDDEN = /\b(kell|muszáj|hib[aá]|elbuk|rossz)/i

/**
 * A lookahead szándékosan tág: a mondat kezdődhet **félkövéren** (`*`), számjeggyel, vagy
 * kisbetűvel is (idézet, márkanév) — a szűk „csak nagybetű" változat mellett egy 3 mondatos
 * kártya átcsúszott volna. Unicode-flag, hogy az ékezetes kisbetűk is beleessenek.
 */
export function countSentences(voice: string): number {
  return voice.split(/[.!?…]\s+(?=[\p{L}\d*„])/u).length
}
