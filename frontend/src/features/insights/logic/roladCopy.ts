/**
 * Rólad — a közös kép (U9b, mezo-zpxv7): the page's user-facing sentences and picks, pure and
 * tested (the factCopy / CANDIDATE_COPY idiom). No invented sentence (ADR 0049): the quote is a
 * real character claim or nothing.
 */
import type { components } from '@/data/_client/api.gen'
import type { FactOwner, KnowledgeFact, LifeEventCandidate } from '@/data/types'
import { formatCandidateDate } from '@/data/insights/graph'
import { characterForPersona, TEAM, type TeamCharacter, type TeamCharacterId } from '@/features/insights/logic/team'
import { lastSeenLabel } from '@/features/insights/logic/metricFormat'
import { localDateString } from '@/shared/lib/dates'

type CharacterOverviewResponse = components['schemas']['CharacterOverviewResponse']

export const ROLAD_COPY = {
  keep: 'Bekerült a rólad szóló képbe — a forrásával együtt',
  snooze: 'Most nem került be — kb. két hét múlva újra megkérdezzük',
  reject: 'Nem került be — nem kérdezzük újra',
  quoteEmpty: 'Még gyűjtjük, amit rólad tudni érdemes — az első kimondott benyomás ide kerül.',
  quoteLoading: 'A csapat benyomásának betöltése…',
  quoteError: 'Nem sikerült betölteni a csapat benyomását.',
  lifeEventsError: 'Nem sikerült betölteni az életeseményeket.',
  lifeEventsEmpty: 'Még nincs bejegyzett életesemény — az első javaslatként érkezik majd a Rólad oldalra.',
  lifeEventsLede: 'A nagy fordulatok, amikhez a csapat igazodik — a mércék és a javaslatok ezekhez képest értelmeződnek.',
  lifeEventsFoot: 'Új életesemény javaslatként érkezik a Rólad oldalra — ott döntesz róla.',
  lifeEventCandidatesError: 'Nem sikerült betölteni az életesemény-javaslatokat.',
  retry: 'Újra',
  note: 'Minden, ami itt áll, forrással együtt él — és bármit elhallgattathatsz vagy pontosíthatsz. A csapat csak azt használja, amit itt jóváhagytál.',
  // S6c (mezo-2dfy2): the short-distributor strings — the inbox fold and the kirakat section.
  foldMore: (n: number) => `Még ${n} javaslat`,
  foldMoreSub: 'korábban eldöntöttek és további jelöltek',
  foldLess: 'Mutass kevesebbet',
  foldLessSub: 'vissza a rövid nézethez',
  kirakatTitle: 'Amit a csapat megjegyzett',
  kirakatHint: 'A TUDÁSTÁRBAN',
  factsTile: 'Tények rólad',
} as const

/** S9 (mezo-d6ivw.10): the „Összevonnám” card — copy from the approved prototype (mezo.html S9). */
/** S9 final-review M1: the sentence count in words — a merge folds 2 or 3 facts (the judge's bound). */
const mergeCount = (n: number) => (n === 3
  ? { noun: 'három', adj: 'három', acc: 'hármat' }
  : { noun: 'kettő', adj: 'két', acc: 'kettőt' })

export const MERGE_COPY = {
  tag: 'ÖSSZEVONÁSI JAVASLAT',
  eyebrow: 'EGY MONDATBAN',
  helper: (n: number) =>
    `A heti rendrakásnál feltűnt, hogy ez a ${mergeCount(n).noun} ugyanarról szól. Ha összevonom, a ${mergeCount(n).adj} régi mondat nem vész el: a Tényeknél visszakapcsolhatod.`,
  accept: 'Összevonom',
  refine: 'Átírom',
  refineSave: 'Így vond össze',
  refineCancel: 'Mégse',
  refineAria: 'Az összevont mondat',
  snooze: 'Később',
  reject: 'Maradjon külön',
  keep: (n: number) => `Összevontam — a ${mergeCount(n).adj} régi mondat a Tényeknél visszakapcsolható`,
  snoozed: 'Jövő hétfőn újra megkérdezem',
  rejected: (n: number) => `Külön maradnak — ezt a ${mergeCount(n).acc} nem hozom fel újra`,
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

/** The day half of a candidate's byline — the createdAt read through `lastSeenLabel`'s "ma /
 *  tegnap / N napja" phrasing. Shared by `candidateByline` and `graphCandidateByline` so the two
 *  never drift into different wordings for the same "when". */
function candidateDay(createdAtIso: string): string {
  return lastSeenLabel(localDateString(new Date(createdAtIso))) ?? ''
}

export function candidateByline(owner: FactOwner | 'mezo', createdAtIso: string): string {
  return `${TEAM[owner].name} hozta · ${candidateDay(createdAtIso)}`
}

/**
 * U9b final-review fix (mezo-zpxv7): the L2 graph-candidate card's status-row byline. An
 * életesemény/szezon jelölt mindig Mezótól jön (a gráf-kapcsoló forrása), a „mikor" viszont a
 * jelölt SAJÁT ideje, ha van: `occurredOn` (SEASON → a negyedév, LIFE_EVENT → a nap, amiről szól),
 * és csak ennek hiányában esik vissza a jelölt felfedezésének napjára (`createdAt`).
 *
 * U9b runtime-verification fix (mezo-zpxv7): a LIFE_EVENT `occurredOn` a `lastSeenLabel`
 * emberi alakjában jelenik meg (pl. „Aug 21” / „ma” / „tegnap”), ugyanúgy, mint a tények és a
 * timeline — nem a nyers ISO dátum. A SEASON megtartja a negyedév-alakot.
 */
export function graphCandidateByline(candidate: LifeEventCandidate): string {
  const when = candidate.occurredOn
    ? candidate.kind === 'LIFE_EVENT'
      ? lastSeenLabel(candidate.occurredOn) ?? candidate.occurredOn
      : formatCandidateDate(candidate.kind, candidate.occurredOn)
    : candidateDay(candidate.createdAt)
  return `Mezo hozta · ${when}`
}
