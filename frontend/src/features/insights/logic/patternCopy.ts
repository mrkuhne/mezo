import type { PatternMonitorPair } from '@/data/types'
import { findingSentence } from './findings'
import { humanizeFactText } from './factCopy'

/**
 * A minták felhasználói cím- és alcím-szövege EGY helyen (mezo-0469 szabálya: a felület a
 * kérdést mondja ki, nem a belső párcímet).
 *
 * A katalógus `title`-je („Esti lezárás ↔ rákövetkező alvásminőség”) a motor belső neve, a
 * tárolt statisztikai `mechanism` („Közepes erősségű negatív együttjárás a(z) … között …”) pedig
 * a Pearson-futás gépi leírása — egyik sem kerülhet a felhasználó elé. Minden párnak van kézzel
 * írt kérdése (`questionHu`), miértje (`mechanismHu`) és irányonkénti olvasata; ezekből beszélünk.
 */

/** A tárolt statisztikai mechanizmus-mondat (`PatternDetectionService.mechanism`) felismerője. */
const STATISTICAL_MECHANISM = /együttjárás a\(z\)/

export function isStatisticalMechanism(text: string | null | undefined): boolean {
  return text != null && STATISTICAL_MECHANISM.test(text)
}

/**
 * A minta címe a felhasználónak: a pár kérdése („Jobban alszol, ha este lezárod a napot?”).
 * Pár nélkül a nyilas párcímből mondat lesz; minden más cím változatlan.
 */
export function patternHeadline(title: string, pair?: PatternMonitorPair | null): string {
  const question = pair?.questionHu?.trim()
  if (question) return question
  if (!title.includes('↔')) return title
  const sentence = humanizeFactText(title)
  return sentence === title ? title.replace(/\s*↔\s*/, ' és ') : sentence.replace(/\.$/, '?')
}

/** A lelet emberi mondata: „Eddig ebbe az irányba mutatnak a napjaid: …” — null, ha nincs r. */
export function findingLine(pair: PatternMonitorPair): string | null {
  const f = findingSentence(pair)
  if (!f) return null
  return `${f.prefix} ${f.before}${f.strength}${f.after}`.replace(/\s+/g, ' ').trim().replace(/[.]?$/, '.')
}

/**
 * A minta alcíme. A tárolt szöveg megy tovább, ha emberi (a reflexiós / LLM-es minták
 * mechanizmusa eleve az; a szintetikus párjuk irány-olvasata viszont csak általános sablon).
 * A gépi statisztikai mondat helyett: a lelet, ha már van mért irány, különben a pár miértje.
 */
export function patternPlainLine(mechanism: string, pair?: PatternMonitorPair | null): string {
  if (mechanism.trim() && !isStatisticalMechanism(mechanism)) return mechanism
  const finding = pair ? findingLine(pair) : null
  if (finding) return finding
  return pair?.mechanismHu?.trim() || 'Még gyűjtöm hozzá a napokat.'
}
