import { buildTeamFeed, ownerForPattern, withSessionAfterlife } from './teamFeed'
import {
  TODAY, YESTERDAY, activeExperiment, characterItems, freshObservation, input, lateMealPattern, missedPrediction,
  monitoringPattern, pairs,
} from './teamFeed.fixtures'
import { mapEvidence } from '@/shared/ui/evidence/observationEvidence'

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
  expect(o.body).toContain(freshObservation.text)
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

test('észrevétel-poszt: a chip-válasz horgonya a minta-azonosító', () => {
  const o = allPosts().find(p => p.id === `observation:${freshObservation.id}`)!
  expect(o.observation).toEqual({ patternId: freshObservation.patternId })
  expect(o.afterlife).toBeUndefined()
})

test('megválaszolt észrevétel: a rekord hozza az utóéletet, és már nem vár rád', () => {
  const replied = buildTeamFeed({ ...input, observations: [{ ...freshObservation, repliedChoice: 'watch' }] })
  const o = replied.days.flatMap(d => [...(d.poster ? [d.poster] : []), ...d.posts]).find(p => p.id === `observation:${freshObservation.id}`)!
  expect(o.waiting).toBe(false)
  expect(o.afterlife).toMatch(/figyeljük tovább/i)
})

test('karakter-poszt: a válasz-szál forrása a feed-elem saját forrása', () => {
  const [edzo] = characterItems
  const c = allPosts().find(p => p.body === edzo.text)!
  expect(c.thread).toEqual({ sourceType: 'OBSERVATION', sourceId: edzo.sourceId, sourceIndex: 0 })
})

test('withSessionAfterlife: az eltűnt, most eldöntött poszt a saját napján marad, utóélettel', () => {
  const q = allPosts().find(p => p.id === `pattern:${lateMealPattern.id}`)!
  const after = buildTeamFeed({ ...input, patterns: input.patterns.filter(p => p.id !== lateMealPattern.id) })
  const days = withSessionAfterlife(after.days, { [q.id]: { label: 'Elvetetted', snapshot: q } }, TODAY)
  const back = days.find(d => d.key === TODAY)!.posts.find(p => p.id === q.id)!
  expect(back.afterlife).toBe('Elvetetted')
  expect(back.waiting).toBe(false)
  expect(back.decision).toBeUndefined()
})

test('withSessionAfterlife: a még élő poszt utóéletet kap, nem duplikálódik', () => {
  const q = allPosts().find(p => p.id === `pattern:${lateMealPattern.id}`)!
  const days = withSessionAfterlife(buildTeamFeed(input).days, { [q.id]: { label: 'Megerősítetted', snapshot: q } }, TODAY)
  const hits = days.flatMap(d => [...(d.poster ? [d.poster] : []), ...d.posts]).filter(p => p.id === q.id)
  expect(hits).toHaveLength(1)
  expect(hits[0].afterlife).toBe('Megerősítetted')
})

test('withSessionAfterlife: üres bejegyzés-térkép → változatlan napok', () => {
  const days = buildTeamFeed(input).days
  expect(withSessionAfterlife(days, {}, TODAY)).toBe(days)
})


test('nem-ISO dátum (mock kijelző-szöveg) → a címke maga a szöveg, a datált napok után', () => {
  const feed = buildTeamFeed({ ...input, predictions: [{ ...missedPrediction, date: 'Máj 22' }] })
  const last = feed.days[feed.days.length - 1]
  expect(last.label).toBe('Máj 22')
  expect(feed.days.every(d => !/undefined/i.test(d.label))).toBe(true)
})

test('ritmus: egy csendes nap magányos posztja nem lesz üveg-poszter', () => {
  const feed = buildTeamFeed({ ...input, predictions: [missedPrediction], experiments: [], patterns: [], observations: [], characterItems: [] })
  expect(feed.days).toHaveLength(1)
  expect(feed.days[0].poster).toBeUndefined()
  expect(feed.days[0].posts).toHaveLength(1)
})


test('persistent return questions keep their source date and replace duplicate pattern posts', () => {
  const observation = { ...freshObservation, card: 'return' as const, patternId: lateMealPattern.id,
    occurredAt: '2026-08-30T08:00:00Z',
    evidence: [mapEvidence({ type: 'tag', text: '2026-08-29 · Napló: munkahelyi feszültség' })] }
  const posts = buildTeamFeed({ ...input, observations: [observation] }).days
    .flatMap(d => [...(d.poster ? [d.poster] : []), ...d.posts])
  expect(posts.filter(p => p.id === `pattern:${lateMealPattern.id}`)).toHaveLength(0)
  const post = posts.find(p => p.id === `observation:${observation.id}`)!
  expect(post.waiting).toBe(true)
  expect(post.occurredAt).toBe(observation.occurredAt)
  expect(post.body).toContain(observation.question)
  expect(post.body).toContain('2026-08-29 · Napló: munkahelyi feszültség')
})

test('answered observation snapshot does not duplicate its monitoring pattern after refresh', () => {
  const observation = { ...freshObservation, patternId: monitoringPattern.id }
  const before = buildTeamFeed({ ...input, observations: [observation] }).days
    .flatMap(d => [...(d.poster ? [d.poster] : []), ...d.posts])
  const post = before.find(p => p.id === `observation:${observation.id}`)!
  const after = buildTeamFeed({ ...input, observations: [] })
  const visible = withSessionAfterlife(after.days, { [post.id]: { label: 'Jellemző rád', snapshot: post } }, TODAY)
    .flatMap(d => [...(d.poster ? [d.poster] : []), ...d.posts])
  expect(visible.filter(p => p.id === post.id || p.id === `pattern:${monitoringPattern.id}`)).toHaveLength(1)
  expect(visible.find(p => p.id === post.id)?.afterlife).toBe('Jellemző rád')
})
