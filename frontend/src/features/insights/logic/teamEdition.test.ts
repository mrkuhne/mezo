import type { TeamEdition, TeamEditionPost } from '@/data/character/characterApi'
import { huMonthDayDow } from '@/shared/lib/dates'
import { editionPost, mergeWall } from './teamEdition'
import { buildTeamFeed, type TeamFeed } from './teamFeed'
import { TODAY, YESTERDAY, freshObservation, input, lateMealPattern } from './teamFeed.fixtures'

const feed = () => buildTeamFeed(input)
const dayOf = (f: TeamFeed, key: string) => f.days.find(d => d.key === key)!
const postsOf = (f: TeamFeed, key: string) => {
  const d = dayOf(f, key)
  return [...(d.poster ? [d.poster] : []), ...d.posts]
}

function post(rank: number, over: Partial<TeamEditionPost> = {}): TeamEditionPost {
  return {
    rank,
    characterKey: 'mocor',
    genre: 'megfigyeles',
    sourceKind: 'pattern',
    sourceId: `s${rank}`,
    sourceRoute: `/mezo/patterns/route-${rank}`,
    body: `A ${rank}. bejegyzés szövege.`,
    voiced: false,
    guests: [],
    ...over,
  }
}

function edition(day: string, posts: TeamEditionPost[], status: TeamEdition['status'] = 'PUBLISHED'): TeamEdition {
  return { day, status, posts }
}

test('editionPost: stabil id, a kiadás napja, a poszt műfaja és gazdája', () => {
  const e = edition(TODAY, [post(2, { characterKey: 'falat', genre: 'kiserlet', title: 'Cím' })])
  const p = editionPost(e, e.posts[0])
  expect(p.id).toBe(`edition:${TODAY}:2`)
  expect(p.kind).toBe('kiserlet')
  expect(p.author).toBe('falat')
  expect(p.occurredAt).toBe(TODAY)
  expect(p.title).toBe('Cím')
  expect(p.body).toBe('A 2. bejegyzés szövege.')
  expect(p.sourceRoute).toBe('/mezo/patterns/route-2')
  expect(p.waiting).toBe(false)
  expect(p.decision).toBeUndefined()
})

test('editionPost: minta-kérdés → döntés-horgony a hármashoz', () => {
  const e = edition(TODAY, [post(1, { genre: 'kerdes', sourceKind: 'pattern', sourceId: 'p2' })])
  expect(editionPost(e, e.posts[0]).decision).toEqual({ patternId: 'p2' })
  expect(editionPost(e, post(1, { genre: 'kerdes', sourceKind: 'prediction', sourceId: 'pr2' })).decision).toBeUndefined()
})

test('kiadás-nap: a nap posztjai a kiadás posztjai rang-sorrendben, a poszter a rang 1', () => {
  const e = edition(YESTERDAY, [post(3), post(1, { characterKey: 'szunya' }), post(2)])
  const wall = mergeWall(feed(), [e], TODAY)
  const day = dayOf(wall, YESTERDAY)
  expect(day.poster!.id).toBe(`edition:${YESTERDAY}:1`)
  expect(day.poster!.author).toBe('szunya')
  expect(day.posts.map(p => p.id)).toEqual([`edition:${YESTERDAY}:2`, `edition:${YESTERDAY}:3`])
  // az I. felvonás tegnapi posztjai már nem a falon vannak (a szobákban maradnak)
  expect(day.posts.some(p => p.id.startsWith('pattern:'))).toBe(false)
})

test('a mai kopogtatás megmarad a kiadás mellett, a nap elején — és nem duplikálódik', () => {
  const e = edition(TODAY, [post(1), post(2)])
  const wall = mergeWall(feed(), [e], TODAY)
  const day = dayOf(wall, TODAY)
  expect(postsOf(wall, TODAY).filter(p => p.id === `pattern:${lateMealPattern.id}`)).toHaveLength(1)
  expect(day.posts.slice(0, 2).map(p => p.id))
    .toEqual([`observation:${freshObservation.id}`, `pattern:${lateMealPattern.id}`])
  expect(day.posts.at(-1)!.id).toBe(`edition:${TODAY}:2`)
  expect(day.poster!.id).toBe(`edition:${TODAY}:1`)
  expect(day.posts.find(p => p.id === `pattern:${lateMealPattern.id}`)!.waiting).toBe(true)
})

test('ugyanaz a forrás a kiadásban: a kopogtatás nem kerül külön a falra, a kiadás-poszt vár rád', () => {
  const route = `/mezo/patterns/${lateMealPattern.pairKey}`
  const e = edition(TODAY, [post(1, { genre: 'kerdes', sourceId: lateMealPattern.id, sourceRoute: route })])
  const wall = mergeWall(feed(), [e], TODAY)
  expect(postsOf(wall, TODAY).filter(p => p.sourceRoute === route)).toHaveLength(1)
  expect(wall.days.flatMap(d => d.posts).some(p => p.id === `pattern:${lateMealPattern.id}`)).toBe(false)
  expect(dayOf(wall, TODAY).poster!.waiting).toBe(true)
})

test('lezárt ügyről szóló kiadás-kérdés már nem vár rád', () => {
  const e = edition(TODAY, [post(1, { genre: 'kerdes', sourceRoute: '/mezo/patterns/mar-lezart' })])
  const wall = mergeWall(feed(), [e], TODAY)
  expect(dayOf(wall, TODAY).poster!.waiting).toBe(false)
})

test('csendes nap: quiet jelzés, nincs kiadás-poszt', () => {
  const wall = mergeWall(feed(), [edition(YESTERDAY, [], 'QUIET')], TODAY)
  const day = dayOf(wall, YESTERDAY)
  expect(day.quiet).toBe(true)
  expect(day.posts).toEqual([])
  expect(day.poster).toBeUndefined()
})

test('kiadás nélküli nap változatlan marad (I. felvonás fallback)', () => {
  const before = feed()
  const wall = mergeWall(before, [edition(YESTERDAY, [post(1)])], TODAY)
  expect(dayOf(wall, TODAY)).toEqual(dayOf(before, TODAY))
  expect(mergeWall(before, [], TODAY)).toEqual(before)
})

test('kiadás olyan napra, amelyen a fal üres volt: új nap kerül a helyére', () => {
  const day = '2026-09-20'
  const wall = mergeWall(feed(), [edition(day, [post(1)])], TODAY)
  expect(wall.days.map(d => d.key)).toEqual([TODAY, YESTERDAY, day])
  expect(dayOf(wall, day).poster!.id).toBe(`edition:${day}:1`)
  expect(dayOf(wall, day).label).toBe(huMonthDayDow(day))
})

test('a rád várók száma és a friss karakterek az összefésült falból számolódnak', () => {
  const wall = mergeWall(feed(), [edition(TODAY, [post(1, { characterKey: 'deru' })])], TODAY)
  expect(wall.waitingCount).toBe(postsOf(wall, TODAY).filter(p => p.waiting).length)
  expect(wall.freshByCharacter.deru).toBe(true) // a mai kiadás posztja
  expect(wall.freshByCharacter.mezo).toBe(true) // a mai észrevétel-kopogtatás gazdája
  expect(wall.freshByCharacter.szunya).toBe(false) // csak tegnapi posztja volt
})

// H4 (mezo-a9bo7.15): két karakter beszélget a poszt alatt — a vendég-sorok a kiadás saját
// szövegei (ADR 0049), a leképezés csak átnevez; üres listánál a kulcs el sem jön.
test('editionPost: a vendég-sorok átjönnek (a Szkeptikus is), üresen a kulcs hiányzik', () => {
  const e = edition(TODAY, [
    post(1, {
      guests: [
        { characterKey: 'falat', body: 'Nálam a vacsora-oldal ugyanezt mutatja.', voiced: true },
        { characterKey: 'szkeptikus', body: 'A hétvége önmagában is magyarázhatja.', voiced: true },
      ],
    }),
    post(2),
  ])
  expect(editionPost(e, e.posts[0]).guests).toEqual([
    { author: 'falat', body: 'Nálam a vacsora-oldal ugyanezt mutatja.' },
    { author: 'szkeptikus', body: 'A hétvége önmagában is magyarázhatja.' },
  ])
  expect('guests' in editionPost(e, e.posts[1])).toBe(false)
  // a régi, egyetlen „bevonta X” mező érintetlen marad
  expect(editionPost(e, e.posts[0]).guest).toBeUndefined()
})

// H5 (mezo-a9bo7.16): Falat napi értékelése és Derű adatkérése — a két új forrás-fajta ugyanúgy
// a kiadás saját útvonalát viszi; egyik sem kérdés, így egyik sem „vár rád”, és döntés-horgonyt
// sem kap (az csak a minta-kérdésé).
test('editionPost: Falat értékelése (fuel_day) → napi értékelés, a Fuel-napra mutat', () => {
  const e = edition(TODAY, [post(2, { characterKey: 'falat', genre: 'ertekeles', sourceKind: 'fuel_day', sourceId: TODAY, sourceRoute: '/fuel' })])
  const p = editionPost(e, e.posts[0])
  expect(p.kind).toBe('ertekeles')
  expect(p.author).toBe('falat')
  expect(p.sourceRoute).toBe('/fuel')
  expect(p.waiting).toBe(false)
  expect(p.decision).toBeUndefined()
})

test('editionPost: Derű kérése (checkin_coverage) → kérés, a bejelentkezésre mutat', () => {
  const e = edition(TODAY, [post(3, { characterKey: 'deru', genre: 'keres', sourceKind: 'checkin_coverage', sourceId: TODAY, sourceRoute: '/nap/checkin' })])
  const p = editionPost(e, e.posts[0])
  expect(p.kind).toBe('keres')
  expect(p.author).toBe('deru')
  expect(p.sourceRoute).toBe('/nap/checkin')
  expect(p.waiting).toBe(false)
  expect(p.decision).toBeUndefined()
})
