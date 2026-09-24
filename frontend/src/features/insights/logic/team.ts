/**
 * A csapat-üzenőfal karakter-regisztrye (mezo-a9bo7.7, spec 2026-09-23 §2.2 + §4).
 *
 * Öt posztoló boop karakter + a csak beszélgetésben megszólaló Szkeptikus. Minden metrika-doménnek
 * és minden backend-personának pontosan egy gazdája van; ismeretlen kulcs → Mezo (biztonságos
 * default).
 *
 * A nevek H3 (mezo-a9bo7.14) óta KÉT helyen élnek, más okból: itt a MEGJELENÍTÉSÉRT (ez a tábla
 * dönti el, mi van a kártyán), a backend `TeamCharacter` enumjában pedig a HANGÉRT (a generátor
 * prompt karakter-blokkja). A két táblát ugyanaz az eset-lista rögzíti mindkét oldalon
 * (`team.test.ts` ↔ `TeamCharacterTest`) — névcserénél MINDKETTŐT át kell írni.
 */
import type { MetricDomain } from '@/data/types'
import type { BoopVariant } from '@/shared/ui/clay'

export type TeamCharacterId = 'szunya' | 'mocor' | 'falat' | 'deru' | 'mezo' | 'szkeptikus'

export interface TeamCharacter {
  id: TeamCharacterId
  /** Munkanév — owner-döntésre cserélhető, KIZÁRÓLAG itt él. */
  name: string
  /** Tárgyeset a poszt-fejléchez („bevonta Szunyát”) — a munkanévvel együtt cserélendő. */
  nameAcc: string
  /** Eszközhatározó („közös ügy Falattal”) — a munkanévvel együtt cserélendő. */
  nameIns: string
  area: string
  /** A karakter clay-figurája (Mezo arany, Szkeptikus palaszürke — mezo-a9bo7.9). */
  boop: BoopVariant
  accent: 'lav' | 'sky' | 'sage' | 'rose' | 'gold' | 'slate'
  /** A Szkeptikus sosem posztol és nincs story-köre (spec §2.2). */
  postable: boolean
}

export const TEAM: Record<TeamCharacterId, TeamCharacter> = {
  szunya: { id: 'szunya', name: 'Szunya', nameAcc: 'Szunyát', nameIns: 'Szunyával', area: 'alvás', boop: 'mezo', accent: 'lav', postable: true },
  mocor: { id: 'mocor', name: 'Mocor', nameAcc: 'Mocort', nameIns: 'Mocorral', area: 'mozgás', boop: 'train', accent: 'sky', postable: true },
  falat: { id: 'falat', name: 'Falat', nameAcc: 'Falatot', nameIns: 'Falattal', area: 'étkezés', boop: 'fuel', accent: 'sage', postable: true },
  deru: { id: 'deru', name: 'Derű', nameAcc: 'Derűt', nameIns: 'Derűvel', area: 'közérzet', boop: 'me', accent: 'rose', postable: true },
  mezo: { id: 'mezo', name: 'Mezo', nameAcc: 'Mezót', nameIns: 'Mezóval', area: 'a csapat', boop: 'gold', accent: 'gold', postable: true },
  szkeptikus: { id: 'szkeptikus', name: 'Szkeptikus', nameAcc: 'a Szkeptikust', nameIns: 'a Szkeptikussal', area: '', boop: 'slate', accent: 'slate', postable: false },
}

const DOMAIN_OWNER: Record<MetricDomain, TeamCharacterId> = {
  sleep: 'szunya',
  train: 'mocor',
  fuel: 'falat',
  mind: 'deru',
  body: 'deru',
  other: 'mezo',
}

export function characterForMetricDomain(d: MetricDomain): TeamCharacterId {
  return DOMAIN_OWNER[d] ?? 'mezo'
}

const PERSONA_OWNER: Record<string, TeamCharacterId> = {
  szomnologus: 'szunya',
  edzo: 'mocor',
  drill: 'mocor',
  taplalkozo: 'falat',
  pszichologus: 'deru',
  doki: 'deru',
  antropologus: 'mezo',
  mezo: 'mezo',
  szkeptikus: 'szkeptikus',
}

export function characterForPersona(personaKey: string): TeamCharacterId {
  return PERSONA_OWNER[personaKey] ?? 'mezo'
}
