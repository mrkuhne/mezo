/**
 * Az esti kiadás a falon (mezo-a9bo7.13, spec 2026-09-24 §2 + §3.7).
 *
 * A backend 21:00-kor kiad egy napi válogatást (3–6 poszt); ez a modul azt fésüli a meglévő
 * I. felvonásos folyamba. A szabály egyszerű: **amelyik napra van kiadás, azon a nap a kiadás**
 * (a be nem került rekordok a karakterek szobáiban maradnak, spec §2), a kiadás nélküli napok
 * pedig változatlanul a `buildTeamFeed` napjai — így a bevezetés ugrás nélkül történik.
 *
 * A mai nap kivétel: a rád váró **kopogtatások** (nyitott kérdések) a kiadás fölött is látszanak,
 * mert azok élőben várnak rád — de csak egyszer: ha ugyanarról az ügyről a kiadás is hozott
 * posztot (egyezés: `sourceRoute`), a kiadás posztja viszi a „rád vár” jelzést.
 *
 * A modul SOSEM fogalmaz (ADR 0049): a poszt szövege a kiadás saját szövege.
 */
import type { TeamEdition, TeamEditionPost } from '@/data/character/characterApi'
import { TEAM, type TeamCharacterId } from './team'
import { byDayDesc, dayLabel, type FeedDay, type FeedPost, type TeamFeed } from './teamFeed'

/** Egy kiadás-poszt a fal egységes poszt-alakjában — a kártyák (`FeedPosterCard`/`FeedPostCard`)
 *  így változatlanok maradnak. A `waiting` itt csak a műfajból következik; hogy az ügy MA is
 *  nyitott-e, a {@link mergeWall} tudja (az a fal nyitott ügyeit látja). */
export function editionPost(e: TeamEdition, p: TeamEditionPost): FeedPost {
  return {
    id: `edition:${e.day}:${p.rank}`,
    kind: p.genre,
    author: p.characterKey,
    occurredAt: e.day,
    ...(p.title ? { title: p.title } : {}),
    body: p.body,
    sourceRoute: p.sourceRoute,
    waiting: p.genre === 'kerdes',
    ...(p.sourceKind === 'pattern' && p.genre === 'kerdes' ? { decision: { patternId: p.sourceId } } : {}),
  }
}

const postsOfDay = (d: FeedDay): FeedPost[] => [...(d.poster ? [d.poster] : []), ...d.posts]

function editionDay(e: TeamEdition, label: string, openRoutes: ReadonlySet<string>): FeedDay {
  // Csendes nap: a kiadás megszületett, de nem volt mit kitenni — ez UI-mondat lesz, nem poszt.
  if (e.status === 'QUIET' || e.posts.length === 0) return { key: e.day, label, posts: [], quiet: true }
  const [poster, ...rest] = [...e.posts]
    .sort((a, b) => a.rank - b.rank)
    .map(p => editionPost(e, p))
    .map(p => (p.waiting && !openRoutes.has(p.sourceRoute) ? { ...p, waiting: false } : p))
  return { key: e.day, label, posts: rest, poster }
}

/**
 * A fal = a kiadás-napok + a kiadás nélküli napok érintetlenül + a mai kopogtatások.
 * A `waitingCount` és a friss story-gyűrűk az összefésült falból számolódnak újra, különben a
 * gyűrűk olyan posztokra mutatnának, amelyek már nem látszanak.
 */
export function mergeWall(feed: TeamFeed, editions: TeamEdition[], today: string): TeamFeed {
  if (editions.length === 0) return feed
  const byDay = new Map(editions.map(e => [e.day, e]))
  const openRoutes = new Set(feed.days.flatMap(postsOfDay).filter(p => p.waiting).map(p => p.sourceRoute))

  const days: FeedDay[] = feed.days.map(d => {
    const e = byDay.get(d.key)
    return e ? editionDay(e, d.label, openRoutes) : d
  })
  const known = new Set(feed.days.map(d => d.key))
  for (const e of editions) {
    if (!known.has(e.day)) days.push(editionDay(e, dayLabel(e.day, today), openRoutes))
  }
  days.sort((a, b) => byDayDesc(a.key, b.key))

  // Ami a kiadás miatt lekerült a faliról, de még rád vár, a MAI nap élére jön vissza.
  const shownIds = new Set(days.flatMap(postsOfDay).map(p => p.id))
  const shownRoutes = new Set(days.flatMap(postsOfDay).map(p => p.sourceRoute))
  const knocks = feed.days.flatMap(postsOfDay)
    .filter(p => p.waiting && !shownIds.has(p.id) && !shownRoutes.has(p.sourceRoute))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  if (knocks.length > 0) {
    const i = days.findIndex(d => d.key === today)
    if (i >= 0) days[i] = { ...days[i], posts: [...knocks, ...days[i].posts] }
    else days.unshift({ key: today, label: dayLabel(today, today), posts: knocks })
  }

  const merged = days.filter(d => d.quiet || d.poster || d.posts.length > 0)
  const freshByCharacter = Object.fromEntries(Object.keys(TEAM).map(id => [id, false])) as Record<TeamCharacterId, boolean>
  for (const post of merged.filter(d => d.key === today).flatMap(postsOfDay)) freshByCharacter[post.author] = true

  return {
    days: merged,
    waitingCount: merged.flatMap(postsOfDay).filter(p => p.waiting).length,
    freshByCharacter,
  }
}
