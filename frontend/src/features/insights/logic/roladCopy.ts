/**
 * Rólad — a közös kép (U9b, mezo-zpxv7): the page's user-facing sentences and picks, pure and
 * tested (the factCopy / CANDIDATE_COPY idiom). No invented sentence (ADR 0049): the quote is a
 * real character claim or nothing.
 */
import type { components } from '@/data/_client/api.gen'
import type { FactOwner, KnowledgeFact } from '@/data/types'
import { characterForPersona, TEAM, type TeamCharacter, type TeamCharacterId } from '@/features/insights/logic/team'
import { lastSeenLabel } from '@/features/insights/logic/metricFormat'
import { localDateString } from '@/shared/lib/dates'

type CharacterOverviewResponse = components['schemas']['CharacterOverviewResponse']

export const ROLAD_COPY = {
  keep: 'Bekerült a rólad szóló képbe — a forrásával együtt',
  snooze: 'Most nem került be — kb. két hét múlva újra megkérdezzük',
  reject: 'Nem került be — nem kérdezzük újra',
  quoteEmpty: 'Még gyűjtjük, amit rólad tudni érdemes — az első kimondott benyomás ide kerül.',
  note: 'Minden, ami itt áll, forrással együtt él — és bármit elhallgattathatsz vagy pontosíthatsz. A csapat csak azt használja, amit itt jóváhagytál.',
} as const

export interface RoladQuoteClaim { id: string; text: string; character: TeamCharacterId }

export function pickQuoteClaim(overview: CharacterOverviewResponse | null): RoladQuoteClaim | null {
  if (!overview) return null
  let best: { id: string; text: string; confidence: number; proposedBy?: string } | null = null
  for (const d of overview.dimensions) {
    for (const c of d.topClaims) {
      if (c.sensitive) continue
      if (!best || c.confidence > best.confidence) best = c
    }
  }
  return best ? { id: best.id, text: best.text, character: characterForPersona(best.proposedBy ?? 'mezo') } : null
}

export interface OwnerTag { label: string; accent: TeamCharacter['accent'] }

const USER_AUTHORED = new Set(['manual', 'question'])

export function factOwnerTag(fact: Pick<KnowledgeFact, 'owner' | 'source'>): OwnerTag {
  if (USER_AUTHORED.has(fact.source)) return { label: 'TŐLED', accent: 'gold' }
  const ch = TEAM[fact.owner]
  return { label: ch.name.toLocaleUpperCase('hu-HU'), accent: ch.accent }
}

export function candidateByline(owner: FactOwner | 'mezo', createdAtIso: string): string {
  const day = lastSeenLabel(localDateString(new Date(createdAtIso))) ?? ''
  return `${TEAM[owner].name} hozta · ${day}`
}

export function topRoladFacts(facts: KnowledgeFact[], n = 4): KnowledgeFact[] {
  const key = (f: KnowledgeFact) => f.lastReinforcedAt ?? f.createdAt
  return facts.filter((f) => f.active).sort((a, b) => key(b).localeCompare(key(a))).slice(0, n)
}
