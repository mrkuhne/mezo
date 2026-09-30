import { expect, test } from 'vitest'
import { dayStripItems } from '@/features/train/logic/dayStripItems'
import type { WeeklyAgendaDay } from '@/features/train/logic/agenda'

const day = (over: Partial<WeeklyAgendaDay>): WeeklyAgendaDay => ({
  day: 'Kedd', date: '2026-05-19', gym: null, sport: [], running: [], isToday: false, ...over,
})

const gymSlot = { day: 'Kedd', active: true, time: '07:30', duration: 75, type: 'Legs' } as never
const trxSlot = { day: 'Kedd', time: '12:00', duration: 60, court: '', intensity: '', role: 'edzés', sport: 'trx' } as never
const run = { key: 'tue-sprint', timeOfDay: '18:00', label: 'Sprint', kind: 'sprint', rpeTarget: { min: 9, max: 10 } } as never

test('dots follow each session tone in time order', () => {
  const items = dayStripItems([day({ gym: gymSlot, sport: [trxSlot], running: [run] })], () => false)
  expect(items[0].dots).toEqual(['gym', 'trx', 'run'])
  expect(items[0].sessionCount).toBe(3)
  expect(items[0].doneCount).toBe(0)
})

test('doneCount counts the sessions the predicate marks done', () => {
  const items = dayStripItems([day({ gym: gymSlot, running: [run] })], (_d, item) => item.kind === 'gym')
  expect(items[0].doneCount).toBe(1)
  expect(items[0].sessionCount).toBe(2)
})

// A day whose only session was a completed saját workout must not read as a rest
// chip — it carries a gym-tone dot and counts as done (mezo-9bbc final review, I6).
test('a completed custom instance adds a gym-tone dot and counts as done', () => {
  const items = dayStripItems(
    [day({ custom: [{ id: 'w9', title: 'Pihenőnapi felső' }] })],
    (_d, item) => item.kind === 'custom',
  )
  expect(items[0]).toMatchObject({ dots: ['gym'], sessionCount: 1, doneCount: 1 })
})

test('an empty day yields no dots and keeps its day number', () => {
  const items = dayStripItems([day({ day: 'Vas', date: '2026-05-24' })], () => false)
  expect(items[0]).toMatchObject({ day: 'Vas', dayNumber: 24, dots: [], sessionCount: 0 })
})

test('a day with no date falls back to dayNumber 0', () => {
  const items = dayStripItems([day({ date: undefined })], () => false)
  expect(items[0].dayNumber).toBe(0)
})

// Kihagyás S1 (mezo-q4xt2.1): a skipped (not done) session is counted so the chip can carry the
// t-skip mark (prototype elo/edzes.html `dstrip()`); without the predicate nothing is skipped.
test('skipCount counts the not-done sessions the skip predicate marks', () => {
  const items = dayStripItems(
    [day({ gym: gymSlot, running: [run] })],
    (_d, item) => item.kind === 'running',
    (_d, item) => item.kind === 'gym',
  )
  expect(items[0]).toMatchObject({ doneCount: 1, skipCount: 1, sessionCount: 2 })
  expect(dayStripItems([day({ gym: gymSlot })], () => false)[0].skipCount).toBe(0)
})

test('a done session is never counted as skipped (a trained day wins)', () => {
  const items = dayStripItems([day({ gym: gymSlot })], () => true, () => true)
  expect(items[0]).toMatchObject({ doneCount: 1, skipCount: 0 })
})

// Kímélő mód S2 (mezo-q4xt2.2): a protected day with an open session carries one t-kimelo mark
// instead of skip marks (prototype `dstrip()` `km`); a fully done day stays a done day.
test('a protected day: protectedDay set, skip marks folded into it; done sessions still count', () => {
  const items = dayStripItems([day({ gym: gymSlot, running: [run], protected: true })],
    (_d, item) => item.kind === 'running', () => true)
  expect(items[0]).toMatchObject({ protectedDay: true, skipCount: 0, doneCount: 1, sessionCount: 2 })
  const done = dayStripItems([day({ gym: gymSlot, protected: true })], () => true)
  expect(done[0].protectedDay).toBeUndefined()
  expect(dayStripItems([day({ protected: true })], () => false)[0].protectedDay).toBeUndefined()
})
