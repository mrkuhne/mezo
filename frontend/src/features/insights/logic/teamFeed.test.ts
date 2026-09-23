import { buildTeamFeed, ownerForPattern } from './teamFeed'
import {
  TODAY, YESTERDAY, activeExperiment, freshObservation, input, lateMealPattern, missedPrediction,
  monitoringPattern, pairs,
} from './teamFeed.fixtures'

const allPosts = () => buildTeamFeed(input).days.flatMap(d => [...(d.poster ? [d.poster] : []), ...d.posts])

test('minden posztnak pontosan egy gazdája van; cross-domain → author+guest', () => {
  const { author, guest } = ownerForPattern(lateMealPattern, pairs) // fuel→sleep pár
  expect(author).toBe('falat')
  expect(guest).toBe('szunya') // metricA gazdája posztol, B a vendég
})

test('egy-domén pár → nincs vendég; ismeretlen pár → Mezo', () => {
  expect(ownerForPattern(monitoringPattern, pairs)).toEqual({ author: 'szunya' })
  expect(ownerForPattern({ ...lateMealPattern, pairKey: 'nincs-ilyen' }, pairs)).toEqual({ author: 'mezo' })
})

test('proposed pattern → kerdes + waiting=true + decision horgony', () => {
  const q = allPosts().find(p => p.id === `pattern:${lateMealPattern.id}`)!
  expect(q.kind).toBe('kerdes')
  expect(q.waiting).toBe(true)
  expect(q.decision).toEqual({ patternId: lateMealPattern.id })
  expect(q.sourceRoute).toBe(`/mezo/patterns/${lateMealPattern.pairKey}`)
  expect(q.author).toBe('falat')
  expect(q.guest).toBe('szunya')
})

test('monitoring n<minN → sejtes, őszinteség-sávval', () => {
  const s = allPosts().find(p => p.kind === 'sejtes')!
  expect(s.id).toBe(`pattern:${monitoringPattern.id}`)
  expect(s.honesty).toEqual({ n: 5, minN: 8, label: 'még kevés adat' })
  expect(s.waiting).toBe(false)
})

test('elutasított minta, javasolt kísérlet, függő előrejelzés és watching-sor NEM poszt', () => {
  const ids = allPosts().map(p => p.id)
  expect(ids).not.toContain('pattern:p9')
  expect(ids).not.toContain('experiment:e2')
  expect(ids).not.toContain('prediction:pr1')
  expect(ids).not.toContain('observation:p5')
})

test('aktív kísérlet → kiserlet ma; lezárt előrejelzés → elorejelzes a saját napján', () => {
  const posts = allPosts()
  const e = posts.find(p => p.id === `experiment:${activeExperiment.id}`)!
  expect(e.kind).toBe('kiserlet')
  expect(e.occurredAt.slice(0, 10)).toBe(TODAY)
  expect(e.sourceRoute).toBe('/mezo/experiments/e1')
  const pr = posts.find(p => p.id === `prediction:${missedPrediction.id}`)!
  expect(pr.kind).toBe('elorejelzes')
  expect(pr.occurredAt.slice(0, 10)).toBe(YESTERDAY)
  expect(pr.sourceRoute).toBe('/mezo/predictions/pr2')
})

test('fresh észrevétel → kérdés-poszt, válaszig Rád vár', () => {
  const o = allPosts().find(p => p.id === `observation:${freshObservation.id}`)!
  expect(o.kind).toBe('kerdes')
  expect(o.waiting).toBe(true)
  expect(o.body).toBe(freshObservation.text)
  expect(o.honesty).toEqual({ n: 4, minN: 8, label: 'még kevés adat' })
  const answered = buildTeamFeed({ ...input, observations: [{ ...freshObservation, repliedChoice: 'watch' }] })
    .days.flatMap(d => [...(d.poster ? [d.poster] : []), ...d.posts])
    .find(p => p.id === `observation:${freshObservation.id}`)!
  expect(answered.waiting).toBe(false)
})

test('karakter-feed: persona-routing, konzílium Mezo-é', () => {
  const posts = allPosts()
  expect(posts.find(p => p.id === 'character:OBSERVATION:00000000-0000-0000-0000-000000000004:0')!.author).toBe('mocor')
  const k = posts.find(p => p.kind === 'konzilium')!
  expect(k.author).toBe('mezo')
  expect(k.sourceRoute).toBe('/mezo/karakter/konzilium')
})

test('napi csoportosítás: naponta LEGFELJEBB egy poszter, a waiting előnyt kap', () => {
  const { days } = buildTeamFeed(input)
  expect(days.map(d => d.key)).toEqual([TODAY, YESTERDAY])
  expect(days.map(d => d.label)).toEqual(['Ma', 'Tegnap'])
  for (const day of days) {
    if (day.poster) expect(day.posts).not.toContain(day.poster)
    expect([day.poster].filter(Boolean).length).toBeLessThanOrEqual(1)
  }
  expect(days[0].poster!.waiting).toBe(true)
  expect(days[1].poster!.kind).toBe('konzilium') // tegnap nincs waiting és kiserlet
})

test('a builder sosem fogalmaz: body a rekord saját szövege', () => {
  const q = allPosts().find(p => p.id === `pattern:${lateMealPattern.id}`)!
  expect(q.body).toBe(lateMealPattern.mechanism)
  expect(allPosts().find(p => p.id === `experiment:${activeExperiment.id}`)!.body).toBe(activeExperiment.hypothesis)
})

test('a Szkeptikus sosem author', () => {
  for (const p of allPosts()) expect(p.author).not.toBe('szkeptikus')
})

test('waitingCount = a Rád vár posztok száma', () => {
  expect(buildTeamFeed(input).waitingCount).toBe(2)
})

test('freshByCharacter: csak a MAI posztok gazdái igazak', () => {
  // fixture: a proposed pattern MA (falat), a monitoring minta tegnapi (szunya), az edző-észrevétel tegnapi (mocor)
  const { freshByCharacter } = buildTeamFeed(input)
  expect(freshByCharacter.falat).toBe(true)
  expect(freshByCharacter.mezo).toBe(true)
  expect(freshByCharacter.szunya).toBe(false)
  expect(freshByCharacter.mocor).toBe(false)
  expect(freshByCharacter.szkeptikus).toBe(false)
})

test('üres bemenet → üres fal', () => {
  const empty = buildTeamFeed({
    patterns: [], monitorPairs: [], predictions: [], experiments: [], observations: [], characterItems: [], today: TODAY,
  })
  expect(empty.days).toEqual([])
  expect(empty.waitingCount).toBe(0)
})
