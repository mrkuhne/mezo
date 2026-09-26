import type { CharacterDimensionSummary, CharacterMaturityHistory } from '@/data/character/characterApi'
import type { FeedDay, FeedPost } from './teamFeed'
import {
  archivedPatternCount, caseStatus, dimensionsFor, growthPoints, isRoomId, roomCases, roomClaims,
  maturityDropNote, roomMaturity, roomMaturitySeries,
} from './teamRooms'
import { lateMealPattern, pairs } from './teamFeed.fixtures'

const TODAY = '2026-09-23'

function post(id: string, over: Partial<FeedPost> = {}): FeedPost {
  return { id, kind: 'megfigyeles', author: 'szunya', occurredAt: `${TODAY}T08:00:00Z`, body: id, sourceRoute: '/x', waiting: false, ...over }
}

function dim(key: string, expertKey: string | null, maturity: number, claimIds: string[] = []): CharacterDimensionSummary {
  return {
    key, title: key, kind: 'CORE', expertKey, maturity, portrait: '',
    topClaims: claimIds.map(id => ({ id, text: id, confidence: 0.6, sensitive: false, evidence: [] })),
  }
}

test('csak az öt posztoló karakternek van szobája — a Szkeptikusnak nincs', () => {
  expect(isRoomId('szunya')).toBe(true)
  expect(isRoomId('mezo')).toBe(true)
  expect(isRoomId('szkeptikus')).toBe(false)
  expect(isRoomId('ismeretlen')).toBe(false)
  expect(isRoomId(undefined)).toBe(false)
})

test('a dimenziók a persona-beolvadás szerint kerülnek a karakterhez, az érettség az átlaguk', () => {
  const dims = [dim('physical', 'doki', 58, ['a']), dim('mental', 'pszichologus', 39, ['a', 'b']), dim('recovery', 'szomnologus', 66)]
  const deru = dimensionsFor('deru', dims)
  expect(deru.map(d => d.key)).toEqual(['physical', 'mental'])
  expect(roomMaturity(deru)).toBe(49)
  expect(roomMaturity([])).toBe(0)
  expect(roomClaims(deru).map(c => c.id)).toEqual(['a', 'b']) // ismétlés nélkül
})

test('a szoba ügyei: saját és vendég-posztok, ami rád vár elöl', () => {
  const days: FeedDay[] = [
    { key: TODAY, label: 'Ma', poster: post('p1', { author: 'falat', guest: 'szunya', waiting: true }), posts: [post('p2'), post('p3', { author: 'mocor' })] },
    { key: '2026-09-22', label: 'Tegnap', posts: [post('p4', { occurredAt: '2026-09-22T09:00:00Z' })] },
  ]
  expect(roomCases(days, 'szunya').map(p => p.id)).toEqual(['p1', 'p2', 'p4'])
  expect(roomCases(days, 'deru')).toEqual([])
})

test('állapot-címkék zéró szaknyelvvel', () => {
  expect(caseStatus(post('a', { waiting: true })).label).toBe('Rád vár')
  expect(caseStatus(post('b', { kind: 'sejtes', honesty: { n: 3, minN: 8, label: '' } })).label).toBe('Gyűlik')
  expect(caseStatus(post('c', { kind: 'kiserlet' })).label).toBe('Kísérlet')
  expect(caseStatus(post('d')).label).toBe('Észrevétel')
})

test('lezárt ügyek: az elengedett minták a gazdájuknál számolódnak', () => {
  const rejected = { ...lateMealPattern, id: 'r', status: 'rejected' as const }
  expect(archivedPatternCount('falat', [lateMealPattern, rejected], pairs)).toBe(1)
  expect(archivedPatternCount('szunya', [rejected], pairs)).toBe(0) // vendég nem gazda
})

type Dim = [key: string, expertKey: string | null, maturity: number, claimCount: number]
const TITLES: Record<string, string> = { athletic: 'Sport', discipline: 'Fegyelem', recovery: 'Pihenés' }
const wk = (weekStart: string, dims: Dim[], live = false) => ({
  weekStart, live,
  dimensions: dims.map(([key, expertKey, maturity, claimCount]) => ({ key, title: TITLES[key] ?? key, expertKey, maturity, claimCount })),
})

test('roomMaturitySeries: 8 naptári hét, hiányzó hét null, a szoba a dimenziói átlaga', () => {
  const h: CharacterMaturityHistory = { weeks: [
    wk('2026-08-31', [['athletic', 'edzo', 40, 2], ['discipline', 'drill', 20, 1]]),
    wk('2026-09-14', [['athletic', 'edzo', 60, 3], ['discipline', 'drill', 40, 2], ['recovery', 'szomnologus', 90, 4]]),
    wk('2026-09-21', [['athletic', 'edzo', 70, 3], ['discipline', 'drill', 40, 2]], true),
  ] }
  expect(roomMaturitySeries(h, 'mocor')).toEqual([null, null, null, null, 30, null, 50, 55])
  expect(roomMaturitySeries(h, 'szunya')).toEqual([null, null, null, null, null, null, 90, null])
  expect(roomMaturitySeries(h, 'falat')).toEqual(new Array(8).fill(null))
  expect(roomMaturitySeries({ weeks: [] }, 'mocor')).toEqual(new Array(8).fill(null))
})

test('roomMaturitySeries: a fejezet-dimenzió (nincs szakértője) Mezóhoz tartozik', () => {
  const h: CharacterMaturityHistory = { weeks: [wk('2026-09-21', [['life', 'antropologus', 20, 1], ['uj-fejezet', null, 60, 2]], true)] }
  expect(roomMaturitySeries(h, 'mezo')[7]).toBe(40)
})

test('maturityDropNote: állítás-szám esés → "kikerült", egyébként bizonyosság; emelkedésnél null', () => {
  const drop: CharacterMaturityHistory = { weeks: [
    wk('2026-09-14', [['athletic', 'edzo', 60, 3], ['discipline', 'drill', 40, 2]]),
    wk('2026-09-21', [['athletic', 'edzo', 40, 2], ['discipline', 'drill', 40, 2]], true),
  ] }
  expect(maturityDropNote(drop, 'mocor')).toBe('Sport: 1 állítás kikerült a képből, ezért halványult.')
  const conf: CharacterMaturityHistory = { weeks: [wk('2026-09-14', [['athletic', 'edzo', 60, 3]]), wk('2026-09-21', [['athletic', 'edzo', 52, 3]], true)] }
  expect(maturityDropNote(conf, 'mocor')).toBe('Sport: a meglévő állítások bizonyossága csökkent.')
  const up: CharacterMaturityHistory = { weeks: [wk('2026-09-14', [['athletic', 'edzo', 40, 2]]), wk('2026-09-21', [['athletic', 'edzo', 60, 3]], true)] }
  expect(maturityDropNote(up, 'mocor')).toBeNull()
  expect(maturityDropNote({ weeks: [wk('2026-09-21', [['athletic', 'edzo', 60, 3]], true)] }, 'mocor')).toBeNull()
})

test('growthPoints: a null pont null marad, a skála a meglévő értékekből jön', () => {
  const pts = growthPoints([null, 10, 30])
  expect(pts[0]).toBeNull()
  expect(pts[1]).toEqual([14 + 38.6, 46]) // minimum = a sáv alja
  expect(pts[2]![1]).toBeCloseTo(16) // maximum = a sáv teteje
})
