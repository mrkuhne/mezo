import { expect, test } from 'vitest'
import { deriveGymSchedule } from '@/data/trainHooks'
import type { Mesocycle } from '@/data/types'

const meso = (days: { day: string; exerciseCount: number; type: string }[]) =>
  ({ days } as unknown as Mesocycle)

test('deriveGymSchedule fills a gym day time from the matching weekday slot', () => {
  // Kedd (index 1) has a gym day + a 18:30 slot
  const sched = deriveGymSchedule(
    meso([{ day: 'Kedd', exerciseCount: 4, type: 'Plyo Power' }]),
    [{ dayOfWeek: 1, time: '18:30' }],
  )
  const kedd = sched!.weeklyTimes.find((w) => w.day === 'Kedd')!
  expect(kedd.active).toBe(true)
  expect(kedd.time).toBe('18:30')
})

test('deriveGymSchedule leaves time null when no slot matches the gym day', () => {
  const sched = deriveGymSchedule(meso([{ day: 'Kedd', exerciseCount: 4, type: 'Plyo Power' }]), [])
  expect(sched!.weeklyTimes.find((w) => w.day === 'Kedd')!.time).toBeNull()
})

test('deriveGymSchedule ignores a slot whose weekday has no gym day', () => {
  // Kedd is the only gym day; the orphan Sze slot has no matching gym day.
  const sched = deriveGymSchedule(meso([{ day: 'Kedd', exerciseCount: 4, type: 'Plyo Power' }]),
    [{ dayOfWeek: 2, time: '07:00' }]) // Sze slot, no Sze gym day
  expect(sched!.weeklyTimes.find((w) => w.day === 'Sze')!.active).toBe(false)
  // The orphan Sze slot must not leak its time onto the real Kedd gym day.
  expect(sched!.weeklyTimes.find((w) => w.day === 'Kedd')!.time).toBeNull()
})
