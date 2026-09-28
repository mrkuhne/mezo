/**
 * S8 (mezo-d6ivw.12): the FE mirror of the backend `ForgetIntent` (companion/service) — the same
 * narrow Hungarian "ezt ne jegyezd meg" phrase set, on the same folded form (lowercase, accents
 * stripped). The chat uses it for ONE thing: a forget turn whose preceding message learned
 * nothing comes back with an EMPTY forgotten list (owner ruling 2026-09-28), and the turn-memory
 * wire carries no "this was a forget request" flag — so the chip reads the request itself to
 * render the "Nem volt mit elfelejteni" state. Keep in lock-step with ForgetIntent.java; the
 * positive and trap sets below are ForgetIntentTest's.
 */
const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

/** (1) "ne jegyezd meg" anywhere. */
const DONT_REMEMBER = /\bne\s+jegyezd\s+meg\b/
/** (2) "felejtsd el" + an explicit memory object — never after "ne". */
const FORGET_THAT = new RegExp(
  '(?<!\\bne\\s)\\bfelejtsd\\s+el\\s*,?\\s*(?:'
    + '(?:ezt|azt|ezeket)(?=\\s*(?:[.!?,;]|$))'
    + '|amit\\s+(?:mondtam|irtam)'
    + '|az\\s+(?:elozot|elobbit|elobbieket)'
    + '|mindent)',
)
/** (3) the whole message is just the request. */
const FORGET_ALONE = /^(?:kerlek\s*,?\s*)?felejtsd\s+el(?:\s*,?\s*kerlek)?\s*[.!]*$/
/** (4) "ezt ne mentsd / ne tárold", or "ne tárold" anywhere. */
const DONT_STORE = /\b(?:ezt|azt|ezeket)\s+(?:inkabb\s+)?ne\s+(?:mentsd|tarold)\b|\bne\s+tarold\b/

export function isForgetRequest(text: string | null | undefined): boolean {
  if (!text || !text.trim()) return false
  const folded = fold(text).trim().replace(/\s+/g, ' ')
  return DONT_REMEMBER.test(folded) || FORGET_THAT.test(folded) || FORGET_ALONE.test(folded) || DONT_STORE.test(folded)
}
