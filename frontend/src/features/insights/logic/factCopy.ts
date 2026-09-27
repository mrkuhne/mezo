import type { FactSource, KnowledgeFact } from '@/data/types'

const VOWELS = 'aáeéiíoóöőuúüű'
/** Magyar betűnév-kiejtés: ezek a nagybetűk "e"-re/magánhangzóra végződő hangzású névvel
 *  kezdődnek (á, é, eff, gé…), ezért "az" jár eléjük, nem az írott alak dönt. */
const AZ_LETTER_NAMES = new Set(['A', 'E', 'I', 'O', 'U', 'Á', 'É', 'Í', 'Ó', 'Ö', 'Ő', 'Ú', 'Ü', 'Ű', 'F', 'L', 'M', 'N', 'R', 'S', 'X', 'Y'])

/** Rövidítésnek számít, ha a szó ELSŐ KÉT karaktere is nagybetű — a régi szabály (a teljes szó
 *  csupa nagybetű) hamisan bukott meg a toldalékolt "HRV-alapú"-n. */
function isAbbreviation(word: string): boolean {
  const [c1, c2] = word
  if (!c1 || !c2) return false
  return c1 === c1.toUpperCase() && c1 !== c1.toLowerCase() && c2 === c2.toUpperCase() && c2 !== c2.toLowerCase()
}

/** Magyar határozott névelő. Rövidítésnél a betűnév kiejtése dönt (pl. "RPE" → "er-pé-e" → az),
 *  egyébként az írott kezdőhang. */
function article(word: string, abbreviation: boolean): string {
  if (abbreviation) return AZ_LETTER_NAMES.has(word.charAt(0).toUpperCase()) ? 'az' : 'a'
  return VOWELS.includes(word.charAt(0).toLowerCase()) ? 'az' : 'a'
}

/** Kisbetűsíti a kezdőbetűt — kivéve a rövidítéseket (HRV, RPE, PR, HRV-alapú…). */
function lowerFirst(text: string, abbreviation: boolean): string {
  if (abbreviation) return text
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** Levágja a záró mondatvégi írásjelet (és a körülötte lévő szóközt) — enélkül egy
 *  írásjelre végződő oldal duplázott pontot adna a sablon lezáró pontjával. */
function stripTrailingPunctuation(text: string): string {
  return text.replace(/[.!?]+\s*$/, '').trimEnd()
}

/**
 * A minta-promóció a minta CÍMÉT másolja a tény szövegébe (`PatternService.promote()`),
 * ezért az „A ↔ B" alakú tények technikai párcímként jelennek meg. Itt lesz belőlük mondat.
 * Bármi más (chat-kivonat, kézi tény) változatlanul megy tovább.
 */
export function humanizeFactText(text: string): string {
  const parts = text.split('↔')
  if (parts.length !== 2) return text
  const aRaw = stripTrailingPunctuation(parts[0].trim())
  const bRaw = stripTrailingPunctuation(parts[1].trim())
  if (!aRaw || !bRaw) return text
  const aFirstWord = aRaw.split(/\s+/)[0] ?? ''
  const bFirstWord = bRaw.split(/\s+/)[0] ?? ''
  const aAbbrev = isAbbreviation(aFirstWord)
  const bAbbrev = isAbbreviation(bFirstWord)
  const a = lowerFirst(aRaw, aAbbrev)
  const b = lowerFirst(bRaw, bAbbrev)
  const lead = article(a, aAbbrev)
  return `${lead.charAt(0).toUpperCase()}${lead.slice(1)} ${a} és ${article(b, bAbbrev)} ${b} együtt mozognak.`
}

const ORIGIN_CHIP: Record<FactSource, string> = {
  pattern: 'mintából',
  chat: 'beszélgetésből',
  manual: 'kézzel',
  weekly_review: 'heti áttekintésből',
  question: 'kérdésre válaszoltál',
  team_chat: 'csapatfalról',
}

export function originChipLabel(source: FactSource): string {
  return ORIGIN_CHIP[source]
}

/** A backend prompt-rangsora: reinforced DESC, createdAt DESC. */
export function sortFacts(facts: KnowledgeFact[]): KnowledgeFact[] {
  return [...facts].sort((a, b) => b.reinforced - a.reinforced || b.createdAt.localeCompare(a.createdAt))
}

/**
 * Két vödör (facts-always, mezo-d6ivw.8): MINDEN bekapcsolt tény megy a chatbe és minden
 * generált üzenetbe — a kapcsoló az egyetlen szűrő. A backend 200-as prompt-plafonja
 * biztonsági fék, nem munkalimit; a UI szándékosan nem tükrözi.
 */
export function bucketFacts(facts: KnowledgeFact[]) {
  return {
    inPrompt: sortFacts(facts.filter((f) => f.active)),
    off: sortFacts(facts.filter((f) => !f.active)),
  }
}
