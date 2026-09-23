/**
 * A csapat-üzenőfal karakter-regisztrye (mezo-a9bo7.7, spec 2026-09-23 §2.2 + §4).
 *
 * Öt posztoló boop karakter + a csak beszélgetésben megszólaló Szkeptikus. A munkanevek
 * (owner-döntésre cserélhetők) KIZÁRÓLAG itt élnek. Minden metrika-doménnek és minden
 * backend-personának pontosan egy gazdája van; ismeretlen kulcs → Mezo (biztonságos default).
 */
import type { MetricDomain } from '@/data/types'
import type { BoopDomain } from '@/shared/ui/clay'

export type TeamCharacterId = 'szunya' | 'mocor' | 'falat' | 'deru' | 'mezo' | 'szkeptikus'

export interface TeamCharacter {
  id: TeamCharacterId
  /** Munkanév — owner-döntésre cserélhető, KIZÁRÓLAG itt él. */
  name: string
  area: string
  /** A legközelebbi meglévő clay-figura; az arany/pala variánsok a T7-ben érkeznek. */
  boop: BoopDomain
  accent: 'lav' | 'sky' | 'sage' | 'rose' | 'gold' | 'slate'
  /** A Szkeptikus sosem posztol és nincs story-köre (spec §2.2). */
  postable: boolean
}

export const TEAM: Record<TeamCharacterId, TeamCharacter> = {
  szunya: { id: 'szunya', name: 'Szunya', area: 'alvás', boop: 'mezo', accent: 'lav', postable: true },
  mocor: { id: 'mocor', name: 'Mocor', area: 'mozgás', boop: 'train', accent: 'sky', postable: true },
  falat: { id: 'falat', name: 'Falat', area: 'étkezés', boop: 'fuel', accent: 'sage', postable: true },
  deru: { id: 'deru', name: 'Derű', area: 'közérzet', boop: 'me', accent: 'rose', postable: true },
  mezo: { id: 'mezo', name: 'Mezo', area: 'a csapat', boop: 'nap', accent: 'gold', postable: true },
  szkeptikus: { id: 'szkeptikus', name: 'Szkeptikus', area: '', boop: 'mezo', accent: 'slate', postable: false },
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
