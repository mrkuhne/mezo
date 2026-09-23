/**
 * A csapat-üzenőfal poszt-folyam buildere (mezo-a9bo7.7, spec 2026-09-23 §2.3–§2.8, §4).
 *
 * Tiszta függvények: a meglévő hookok rekordjait (minták, kísérletek, előrejelzések,
 * észrevételek, karakter-feed) fésüli össze karakterposztokká. A builder SOSEM fogalmaz
 * (ADR 0049): a `body` mindig a rekord saját szövege; a karakter csak a gazda-hozzárendelés.
 *
 * Mi NEM poszt (zaj, spec §2.3): függő előrejelzés, javasolt/lezárt kísérlet (nincs dátumuk),
 * a felhasználó vagy a motor által lezárt minta (rejected/refuted/dormant), az észrevétel-feed
 * SOR-kártyái (watching/confirmed — azok a mintát ismétlik) és a return-események (Act II).
 */
import type { CharacterFeedItem } from '@/data/character/characterApi'
import type { Experiment, Observation, Pattern, PatternMonitorPair, Prediction } from '@/data/types'
import { addDays, huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { TEAM, characterForMetricDomain, characterForPersona, type TeamCharacterId } from './team'

export type FeedPostKind =
  | 'kerdes'
  | 'megfigyeles'
  | 'sejtes'
  | 'kiserlet'
  | 'ertekeles'
  | 'elorejelzes'
  | 'konzilium'
  | 'keres'
  | 'bemutatkozas'

export interface FeedHonesty {
  n: number
  minN: number
  label: string
}

export interface FeedPost {
  /** Stabil: `<forrás>:<rekordId>` — kulcs + seen-állapot horgony. */
  id: string
  kind: FeedPostKind
  author: TeamCharacterId
  /** Két-területes ügynél a bevont fél (spec §4/1). */
  guest?: TeamCharacterId
  /** ISO — a nap-csoportosítás kulcsa. */
  occurredAt: string
  title?: string
  /** A REKORD saját szövege — a builder nem fogalmaz (ADR 0049). */
  body: string
  /** Sejtés/gyűlik sáv: n / minN, a bizonytalanság kimondva. */
  honesty?: FeedHonesty
  /** A hármas = pattern-döntés ezen a poszton. */
  decision?: { patternId: string }
  /** „Miből látszik?” / címzett mélyoldal. */
  sourceRoute: string
  /** Rád vár (story-pötty + szűrő forrása). */
  waiting: boolean
}

export interface FeedDay {
  /** YYYY-MM-DD, helyi idő szerint. */
  key: string
  label: string
  /** A nap csendes posztjai — a poszter NINCS köztük. */
  posts: FeedPost[]
  /** A nap egyetlen üveg-posztere (rangsor, restored bible §3.4). */
  poster?: FeedPost
}

export interface TeamFeedInput {
  patterns: Pattern[]
  monitorPairs: PatternMonitorPair[]
  predictions: Prediction[]
  experiments: Experiment[]
  observations: Observation[]
  characterItems: CharacterFeedItem[]
  /** YYYY-MM-DD — a „Ma” és a friss story-gyűrűk horgonya. */
  today: string
}

export interface TeamFeed {
  days: FeedDay[]
  waitingCount: number
  freshByCharacter: Record<TeamCharacterId, boolean>
}

/** Az őszinteség-sáv címkéje: minN alatt kimondjuk, hogy kevés az adat (spec §2.7). */
export function honestyFor(n: number, minN: number): FeedHonesty {
  return { n, minN, label: n < minN ? 'még kevés adat' : 'kezd úgy tűnni' }
}

/** Minden mintának pontosan egy gazdája van: a pár A-metrikájának doménje posztol, a B vendég. */
export function ownerForPattern(
  p: Pattern,
  pairs: PatternMonitorPair[],
): { author: TeamCharacterId; guest?: TeamCharacterId } {
  const pair = pairs.find(x => x.key === p.pairKey)
  if (!pair) return { author: 'mezo' }
  const a = characterForMetricDomain(pair.metricADomain)
  const b = characterForMetricDomain(pair.metricBDomain)
  return a === b ? { author: a } : { author: a, guest: b }
}

/** A Szkeptikus sosem posztol (spec §2.2) — ha egy rekord az övé, a csapat (Mezo) hozza. */
function postableAuthor(id: TeamCharacterId): TeamCharacterId {
  return TEAM[id].postable ? id : 'mezo'
}

function dayKeyOf(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : localDateString(d)
}

function dayLabel(key: string, today: string): string {
  if (key === today) return 'Ma'
  if (key === addDays(today, -1)) return 'Tegnap'
  return huMonthDayDow(key)
}

function patternPost(p: Pattern, pairs: PatternMonitorPair[], today: string): FeedPost | null {
  const owner = ownerForPattern(p, pairs)
  const base = {
    id: `pattern:${p.id}`,
    ...owner,
    title: p.title,
    body: p.mechanism,
    sourceRoute: `/mezo/patterns/${p.pairKey}`,
  }
  const n = p.evidenceHits + p.evidenceMisses
  switch (p.status) {
    case 'proposed':
      // Rád vár: a kérdés ma is nyitott, ha a motor nem adott dátumot.
      return { ...base, kind: 'kerdes', occurredAt: p.lastDetectedAt ?? today, waiting: true, decision: { patternId: p.id } }
    case 'monitoring':
      return {
        ...base,
        kind: 'sejtes',
        occurredAt: p.lastDetectedAt ?? today,
        waiting: false,
        ...(p.testPlan ? { honesty: honestyFor(n, p.testPlan.minN) } : {}),
      }
    case 'confirmed':
      // Csak friss megerősítés poszt — dátum nélkül nem tudjuk, mikor történt.
      return p.lastDetectedAt ? { ...base, kind: 'megfigyeles', occurredAt: p.lastDetectedAt, waiting: false } : null
    default:
      return null
  }
}

function observationPost(o: Observation, patterns: Pattern[], pairs: PatternMonitorPair[]): FeedPost | null {
  if (o.card !== 'fresh') return null
  const pattern = patterns.find(p => p.id === o.patternId)
  const owner = pattern ? ownerForPattern(pattern, pairs) : { author: 'mezo' as const }
  const n = o.evidenceHits + o.evidenceMisses
  return {
    id: `observation:${o.id}`,
    kind: o.question ? 'kerdes' : 'megfigyeles',
    ...owner,
    occurredAt: o.occurredAt,
    title: o.title,
    body: o.text,
    ...(o.minN != null ? { honesty: honestyFor(n, o.minN) } : {}),
    sourceRoute: pattern ? `/mezo/patterns/${pattern.pairKey}` : '/mezo/patterns',
    waiting: Boolean(o.question) && !o.repliedChoice,
  }
}

function experimentPost(e: Experiment, today: string): FeedPost | null {
  if (e.status !== 'active') return null
  return {
    id: `experiment:${e.id}`,
    kind: 'kiserlet',
    author: 'mezo',
    // A futó kísérlet ma is fut — nincs saját dátuma, a mai napon él.
    occurredAt: today,
    title: e.title,
    body: e.hypothesis,
    sourceRoute: `/mezo/experiments/${e.id}`,
    waiting: false,
  }
}

function predictionPost(p: Prediction): FeedPost | null {
  if (p.status === 'pending') return null
  return {
    id: `prediction:${p.id}`,
    kind: 'elorejelzes',
    author: 'mezo',
    occurredAt: p.date,
    title: p.title,
    body: p.actual ?? p.basis ?? p.title,
    sourceRoute: `/mezo/predictions/${p.id}`,
    waiting: false,
  }
}

function characterPost(item: CharacterFeedItem): FeedPost {
  const conference = item.kind !== 'OBSERVATION'
  return {
    id: `character:${item.sourceType ?? item.kind}:${item.sourceId ?? item.at}:${item.sourceIndex ?? 0}`,
    kind: conference ? 'konzilium' : 'megfigyeles',
    author: conference ? 'mezo' : postableAuthor(characterForPersona(item.expertKey ?? '')),
    occurredAt: item.at,
    body: item.text,
    sourceRoute: conference ? '/mezo/karakter/konzilium' : '/mezo/karakter/feed',
    waiting: false,
  }
}

const POSTER_RANK: Partial<Record<FeedPostKind, number>> = { kiserlet: 1, konzilium: 2 }

/** A nap posztere: waiting > kiserlet > konzilium > a nap első (legfrissebb) posztja. */
function pickPoster(posts: FeedPost[]): FeedPost | undefined {
  const rank = (p: FeedPost) => (p.waiting ? 0 : (POSTER_RANK[p.kind] ?? 3))
  return posts.reduce<FeedPost | undefined>((best, p) => (!best || rank(p) < rank(best) ? p : best), undefined)
}

export function buildTeamFeed(input: TeamFeedInput): TeamFeed {
  const { patterns, monitorPairs, today } = input
  const posts = [
    ...patterns.map(p => patternPost(p, monitorPairs, today)),
    ...input.observations.map(o => observationPost(o, patterns, monitorPairs)),
    ...input.experiments.map(e => experimentPost(e, today)),
    ...input.predictions.map(predictionPost),
    ...input.characterItems.map(characterPost),
  ].filter((p): p is FeedPost => p !== null)

  const byDay = new Map<string, FeedPost[]>()
  for (const post of posts) {
    const key = dayKeyOf(post.occurredAt)
    byDay.set(key, [...(byDay.get(key) ?? []), post])
  }

  const days: FeedDay[] = [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, dayPosts]) => {
      const sorted = [...dayPosts].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      const poster = pickPoster(sorted)
      return { key, label: dayLabel(key, today), posts: sorted.filter(p => p !== poster), ...(poster ? { poster } : {}) }
    })

  const freshByCharacter = Object.fromEntries(Object.keys(TEAM).map(id => [id, false])) as Record<TeamCharacterId, boolean>
  for (const post of byDay.get(today) ?? []) freshByCharacter[post.author] = true

  return { days, waitingCount: posts.filter(p => p.waiting).length, freshByCharacter }
}
