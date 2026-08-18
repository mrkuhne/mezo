import type { FactSource, KnowledgeFact } from '@/data/types'
import { PROMPT_TOP_N, factCategoryLabel } from '@/data/insights/knowledge'
import { huMonthDay } from '@/shared/lib/dates'

/** A tény prompt-státusza — ez a három vödör adja a lista három szakaszát is. */
export type FactBucket = 'in-prompt' | 'waiting' | 'off'

const VOWELS = 'aáeéiíoóöőuúüű'

/** Magyar határozott névelő a szó kezdőhangja szerint. */
function article(word: string): string {
  return VOWELS.includes(word.charAt(0).toLowerCase()) ? 'az' : 'a'
}

/** Kisbetűsíti a kezdőbetűt — kivéve a csupa nagybetűs rövidítéseket (HRV, RPE, PR). */
function lowerFirst(text: string): string {
  const first = text.split(/\s+/)[0] ?? ''
  if (first.length > 1 && first === first.toUpperCase() && first !== first.toLowerCase()) return text
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/**
 * A minta-promóció a minta CÍMÉT másolja a tény szövegébe (`PatternService.promote()`),
 * ezért az „A ↔ B" alakú tények technikai párcímként jelennek meg. Itt lesz belőlük mondat.
 * Bármi más (chat-kivonat, kézi tény) változatlanul megy tovább.
 */
export function humanizeFactText(text: string): string {
  const parts = text.split('↔')
  if (parts.length !== 2) return text
  const a = lowerFirst(parts[0].trim())
  const b = lowerFirst(parts[1].trim())
  if (!a || !b) return text
  const lead = article(a)
  return `${lead.charAt(0).toUpperCase()}${lead.slice(1)} ${a} és ${article(b)} ${b} együtt mozognak.`
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

/** A három prompt-státusz vödör — a lista szakaszai. */
export function bucketFacts(facts: KnowledgeFact[], topN: number = PROMPT_TOP_N) {
  const active = sortFacts(facts.filter((f) => f.active))
  return {
    inPrompt: active.slice(0, topN),
    waiting: active.slice(topN),
    off: sortFacts(facts.filter((f) => !f.active)),
  }
}

/** A keresés arra illeszkedik, amit a felhasználó LÁT: a humanizált szövegre + a kategória-címkére. */
export function matchesQuery(fact: KnowledgeFact, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${humanizeFactText(fact.text)} ${factCategoryLabel(fact.category)}`.toLowerCase().includes(q)
}
