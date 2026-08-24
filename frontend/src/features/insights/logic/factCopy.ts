import type { FactSource, KnowledgeFact } from '@/data/types'
import { PATTERN_ACK_DAYS, PROMPT_TOP_N, factCategoryLabel } from '@/data/insights/knowledge'
import { huMonthDay } from '@/shared/lib/dates'

/** A tény prompt-státusza — ez a három vödör adja a lista három szakaszát is. */
export type FactBucket = 'in-prompt' | 'waiting' | 'off'

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

const ORIGIN_SENTENCE: Record<FactSource, string> = {
  pattern: 'Megerősített mintából tanultam — amikor az egyik változik, a másik jellemzően követi.',
  chat: 'A beszélgetéseitekből szűrtem ki.',
  manual: 'Te vetted fel kézzel.',
}

const ORIGIN_CHIP: Record<FactSource, string> = {
  pattern: 'mintából',
  chat: 'beszélgetésből',
  manual: 'kézzel',
}

/**
 * Honnan tudja a társ ezt a tényt. A minta-címet CSAK akkor fűzzük hozzá, ha eltér a tény
 * szövegétől — a régi `minta: {title}` chip azért volt értelmetlen, mert a promóció miatt
 * jellemzően szó szerint megismételte a kártya címét.
 */
export function originSentence(fact: KnowledgeFact): string {
  const base = ORIGIN_SENTENCE[fact.source]
  if (fact.source === 'pattern' && fact.patternTitle && fact.patternTitle.trim() !== fact.text.trim()) {
    return `${base} (A minta: „${fact.patternTitle}".)`
  }
  return base
}

export function originChipLabel(source: FactSource): string {
  return ORIGIN_CHIP[source]
}

/** ×N reinforced emberi nyelven: hányszor jött vissza magától, és mikor utoljára. */
export function reinforcementSentence(reinforced: number, lastReinforcedAt: string | null): string {
  if (reinforced <= 0) return 'Még nem jött vissza megerősítés.'
  const base = `${reinforced}× visszaigazolva`
  return lastReinforcedAt ? `${base} · utoljára ${huMonthDay(lastReinforcedAt.slice(0, 10))}` : base
}

const STATUS_LABEL: Record<FactBucket, string> = {
  'in-prompt': 'Most benne van a chatben',
  waiting: 'Bekapcsolva, de most kimarad',
  off: 'Kikapcsolva — a társ nem látja',
}

export function promptStatusLabel(bucket: FactBucket): string {
  return STATUS_LABEL[bucket]
}

/** A backend prompt-rangsora: reinforced DESC, createdAt DESC. */
export function sortFacts(facts: KnowledgeFact[]): KnowledgeFact[] {
  return [...facts].sort((a, b) => b.reinforced - a.reinforced || b.createdAt.localeCompare(a.createdAt))
}

/**
 * A három prompt-státusz vödör — a lista szakaszai.
 *
 * Két injektálási csatornát tükröz (`KnowledgeFactService`-ben): a top-N rangsoros blokkot
 * (`renderPromptBlock()`) ÉS a `renderNewPatternFactsBlock()`-ot, ami a rangsortól FÜGGETLENÜL
 * minden bekapcsolt, `PATTERN_ACK_DAYS` napon belül létrejött `source: 'pattern'` tényt bevisz —
 * egy frissen megerősített minta `reinforced: 0`-val a topN alá sorolódna, miközben a társ
 * ténylegesen kapja és említi. `now` a teszteléshez opcionális (alapból a valós idő).
 */
export function bucketFacts(facts: KnowledgeFact[], topN: number = PROMPT_TOP_N, now: Date = new Date()) {
  const active = sortFacts(facts.filter((f) => f.active))
  const ackCutoff = now.getTime() - PATTERN_ACK_DAYS * 24 * 60 * 60 * 1000
  const isFreshPattern = (f: KnowledgeFact) => f.source === 'pattern' && new Date(f.createdAt).getTime() >= ackCutoff
  return {
    inPrompt: active.filter((f, i) => i < topN || isFreshPattern(f)),
    waiting: active.filter((f, i) => i >= topN && !isFreshPattern(f)),
    off: sortFacts(facts.filter((f) => !f.active)),
  }
}

/** A keresés arra illeszkedik, amit a felhasználó LÁT: a humanizált szövegre, a kategória-
 *  címkére, ÉS az eredet-mondatba fűzött minta-címre (l. `originSentence`) — az utóbbi nélkül
 *  egy csak a minta-eredetben megjelenő szó (pl. "aznapi") nem lenne kereshető. */
export function matchesQuery(fact: KnowledgeFact, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${humanizeFactText(fact.text)} ${factCategoryLabel(fact.category)} ${fact.patternTitle ?? ''}`
    .toLowerCase()
    .includes(q)
}
