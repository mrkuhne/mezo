import { APP_NOTIFICATION_KIND_META } from '@/data/types'
import { NOTIFICATION_CATEGORIES, notificationCategory } from '@/features/notification/logic/category'

test('MINDEN ismert wire-kind pontosan egy kategóriába esik', () => {
  const kinds = Object.keys(APP_NOTIFICATION_KIND_META)
  // A chip-sor különben csendben elnyelne egy fajtát: a `Mind`-ben látszana, de egyetlen
  // kategória-szűrő sem hozná elő.
  expect(kinds.filter((k) => notificationCategory(k) === null)).toEqual([])
  const mapped = NOTIFICATION_CATEGORIES.flatMap((c) => c.kinds)
  expect(new Set(mapped).size).toBe(mapped.length)
  expect([...mapped].sort()).toEqual([...kinds].sort())
})

test('ismeretlen fajta kategória nélkül marad, nem esik rossz kategóriába', () => {
  expect(notificationCategory('valami_uj_2027')).toBeNull()
})
