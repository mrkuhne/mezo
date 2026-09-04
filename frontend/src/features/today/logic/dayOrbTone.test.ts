import { provisionalDayScore } from '@/features/today/logic/dayOrbTone'
import type { NormalizedDayDimension } from '@/data/hooks'

function dim(over: Partial<NormalizedDayDimension>): NormalizedDayDimension {
  return {
    id: 'nutrition', label: 'Táplálkozás', weight: 0, score: null, status: 'NO_DATA',
    facts: [], note: null,
    ...over,
  }
}

test('lezárt nap: a válasz saját score-ja nyer, a dimenziók figyelmen kívül maradnak', () => {
  const dims = [dim({ status: 'DONE', weight: 1, score: 10 })]
  expect(provisionalDayScore(dims, 78)).toBe(78)
})

test('2+ KÉSZ dimenzió: menet közbeni pont a súlyozott összegből', () => {
  const dims = [
    dim({ id: 'training', status: 'DONE', weight: 0.6, score: 90 }),
    dim({ id: 'sleep', status: 'DONE', weight: 0.4, score: 70 }),
  ]
  // 0.6*90 + 0.4*70 = 54 + 28 = 82
  expect(provisionalDayScore(dims, null)).toBe(82)
})

test('1 KÉSZ dimenzió alatt (tanulom-kapu): null', () => {
  const dims = [dim({ id: 'training', status: 'DONE', weight: 1, score: 90 })]
  expect(provisionalDayScore(dims, null)).toBeNull()
})

test('nem KÉSZ dimenziók (0 súly / null pont) nem számítanak bele', () => {
  const dims = [
    dim({ id: 'training', status: 'DONE', weight: 0.5, score: 80 }),
    dim({ id: 'sleep', status: 'DONE', weight: 0.5, score: 60 }),
    dim({ id: 'nutrition', status: 'NO_DATA', weight: 0, score: null }),
    dim({ id: 'logging', status: 'IN_PROGRESS', weight: 0, score: null }),
  ]
  // 0.5*80 + 0.5*60 = 70
  expect(provisionalDayScore(dims, null)).toBe(70)
})

test('üres dimenzió-tömb: null', () => {
  expect(provisionalDayScore([], null)).toBeNull()
})

test('kerekítés: a súlyozott összeg egész pontra kerekedik', () => {
  const dims = [
    dim({ id: 'training', status: 'DONE', weight: 0.5, score: 81 }),
    dim({ id: 'sleep', status: 'DONE', weight: 0.5, score: 82 }),
  ]
  // 0.5*81 + 0.5*82 = 81.5 -> 82 (Math.round)
  expect(provisionalDayScore(dims, null)).toBe(82)
})

// A `rhythm` extrinsic — más napok base-score-jainak átlaga, semmit nem mond ERRŐL a napról
// (`DayEvaluationEngine.java:100-102`). A kapu ezért csak a `rhythm`-en KÍVÜLI KÉSZ
// dimenziókat számolja: `logging` + `rhythm` (a tipikus páros egy egyébként érintetlen
// napon) nem nyithatja ki a kaput.
test('rhythm + pontosan egy másik KÉSZ dimenzió a kapu alatt marad (rhythm nem intrinsic): null', () => {
  const dims = [
    dim({ id: 'logging', status: 'DONE', weight: 0.5, score: 0 }),
    dim({ id: 'rhythm', status: 'DONE', weight: 0.5, score: 65 }),
  ]
  expect(provisionalDayScore(dims, null)).toBeNull()
})

// Ha a kapu már nyitva van (2+ intrinsic KÉSZ dimenzió), a `rhythm` MÉGIS beleszámít a
// súlyozott összegbe — az engine csak a KAPUBÓL zárja ki, az összegből nem
// (`DayEvaluationEngine.java:107-110`, nincs rhythm-szűrés a `weighted` streamben).
test('nyitott kapu esetén a rhythm beleszámít a súlyozott összegbe', () => {
  const dims = [
    dim({ id: 'training', status: 'DONE', weight: 0.4, score: 90 }),
    dim({ id: 'sleep', status: 'DONE', weight: 0.4, score: 70 }),
    dim({ id: 'rhythm', status: 'DONE', weight: 0.2, score: 50 }),
  ]
  // 0.4*90 + 0.4*70 + 0.2*50 = 36 + 28 + 10 = 74
  expect(provisionalDayScore(dims, null)).toBe(74)
})
