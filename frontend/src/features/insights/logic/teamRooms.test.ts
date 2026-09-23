import type { CharacterDimensionSummary } from '@/data/character/characterApi'
import type { FeedDay, FeedPost } from './teamFeed'
import {
  archivedPatternCount, caseStatus, dimensionsFor, growthPoints, isRoomId, roomCases, roomClaims,
  roomMaturity, weeklyGrowth,
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

test('a tudás-görbe halmozott heti bejegyzés-szám, 8 hét, a régebbi az alapszint', () => {
  const days: FeedDay[] = [
    { key: TODAY, label: 'Ma', posts: [post('a'), post('b')] },
    { key: '2026-09-10', label: '', posts: [post('c')] },
    { key: '2026-06-01', label: '', posts: [post('old')] }, // 8 hétnél régebbi
    { key: 'Máj 22', label: 'Máj 22', posts: [post('mock')] }, // kijelző-szöveg: kimarad
  ]
  const s = weeklyGrowth(days, 'szunya', TODAY)
  expect(s).toHaveLength(8)
  expect(s[0]).toBe(1)
  expect(s[6]).toBe(2)
  expect(s[7]).toBe(4)
  const pts = growthPoints(s)
  expect(pts[0]).toEqual([14, 46]) // minimum = a sáv alja
  expect(pts[7][1]).toBeCloseTo(16) // maximum = a sáv teteje
})
