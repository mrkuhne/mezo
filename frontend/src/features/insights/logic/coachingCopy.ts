// ============================================================
// Mezo · Proaktív coaching — the observer's screen vocabulary (mezo-6269.3).
// Spec 2026-09-05 §6. The ONLY frontend-side interpretation of the trace:
// four state words, one domain → wash/icon map with a safe fallback, and a
// handful of counts. There is deliberately NO per-flagKey map here — the
// server sends `label`, `domain`, `reasonText` and `facts` precisely so a
// round-2 rule appears without a frontend change (spec §5).
// ============================================================
import { huMonthDay } from '@/shared/lib/dates'
import type { ClayIconName } from '@/shared/ui/clay'
import type { MozaikWash } from '@/shared/ui/mozaik'
import type { CoachingRule, CoachingTraceDay } from '@/data/types'

/** The four things a rule can BE on screen. `suppressed` is not a wire outcome: it is
 *  `raised` + `suppressed_by_cooldown`, i.e. "true, but it spoke recently" — the answer to
 *  „miért nem látom", and the one state round 1 threw away entirely. */
export type CoachingState = 'raised' | 'suppressed' | 'clear' | 'unavailable'

export function stateOf(rule: CoachingRule): CoachingState {
  if (rule.outcome !== 'raised') return rule.outcome
  return rule.disposition === 'suppressed_by_cooldown' ? 'suppressed' : 'raised'
}

/** Screen copy, verbatim from the spec's state vocabulary (§6). */
export const STATE_LABEL: Record<CoachingState, string> = {
  raised: 'Jelzett',
  suppressed: 'Pihenőn',
  clear: 'Rendben',
  unavailable: 'Nem mérhető',
}

export const WINNER_LABEL = 'Nyertes'

/** `mzp-stch` modifiers — the Diagnózis chip recipe, reused rather than re-invented. */
export const STATE_CHIP: Record<CoachingState, string> = {
  raised: 'act',
  suppressed: 'pend',
  clear: 'ok',
  unavailable: 'mut',
}

/** domain → the tile's colour wash and clay icon. The server owns the DOMAIN; this owns how a
 *  domain LOOKS. Fallback is not defensive dressing: it is the mechanism that lets a round-2 rule
 *  ship backend-only (`FlagCatalog.DOMAIN_FALLBACK` is literally `general`). */
const DOMAIN_VISUAL: Record<string, { wash: MozaikWash; icon: ClayIconName }> = {
  sleep: { wash: 'lav', icon: 'i-alvas' },
  training: { wash: 'coral', icon: 'i-edzes' },
  nutrition: { wash: 'sage', icon: 'i-fuel' },
  recovery: { wash: 'sky', icon: 'i-hold' },
  habits: { wash: 'gold', icon: 'i-lang' },
  logging: { wash: 'white', icon: 'i-naplo' },
  body: { wash: 'rose', icon: 'i-suly' },
}

const FALLBACK_VISUAL: { wash: MozaikWash; icon: ClayIconName } = { wash: 'white', icon: 'i-mezo' }

export function visualOf(domain: string): { wash: MozaikWash; icon: ClayIconName } {
  return DOMAIN_VISUAL[domain] ?? FALLBACK_VISUAL
}

/** Spec §6.3: flagged = domain colour, fine = calm, unmeasurable = muted. The domain colour is
 *  spent on the rules that have something to say. */
export function washOf(rule: CoachingRule): MozaikWash {
  const state = stateOf(rule)
  if (state === 'raised' || state === 'suppressed') return visualOf(rule.domain).wash
  return state === 'clear' ? 'sage' : 'white'
}

export interface CoachingSplit {
  raised: number
  suppressed: number
  clear: number
  unavailable: number
  total: number
}

export function splitOf(day: CoachingTraceDay): CoachingSplit {
  const split: CoachingSplit = { raised: 0, suppressed: 0, clear: 0, unavailable: 0, total: 0 }
  for (const rule of day.rules) {
    split[stateOf(rule)] += 1
    split.total += 1
  }
  return split
}

/** The day's card, resolved to its rule. From `day.winner` ONLY — `cardOutcome` describes a rule's
 *  state at the decision instant and is null once that rule has changed since, so inferring the
 *  winner from it renders „Nyertes" on nothing at all some days (bd mezo-y43v). */
export function winnerRuleOf(day: CoachingTraceDay): CoachingRule | undefined {
  const key = day.winner?.flagKey
  return key == null ? undefined : day.rules.find((r) => r.flagKey === key)
}

/** „Miért ez nyert" — the raises that were on the table and lost, most severe first. The array is
 *  already in severity order, so this only filters. */
export function losersOf(day: CoachingTraceDay): CoachingRule[] {
  return day.rules.filter((r) => r.cardOutcome === 'lost')
}

/** The local wall clock of an instant — the house idiom (`humanGeneratedAt`, `buildDayPlan`). */
export function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function dayLabel(date: string, today: string): string {
  if (date === today) return 'ma'
  const yesterday = new Date(`${today}T12:00:00`)
  yesterday.setDate(yesterday.getDate() - 1)
  const iso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  return date === iso ? 'tegnap' : huMonthDay(date).toLowerCase()
}
