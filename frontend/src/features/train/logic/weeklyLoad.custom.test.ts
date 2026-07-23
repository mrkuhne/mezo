import { expect, test } from 'vitest'
import { weeklyLoad } from '@/features/train/logic/weeklyLoad'

test('completed custom sessions add to the Gym tile count (mezo-ws2x)', () => {
  const tiles = weeklyLoad([
    { gym: { day: 'Hét', active: true, time: '18:00', duration: null, type: 'Push' } as never, sport: [], running: [], custom: [] },
    { gym: null, sport: [], running: [], custom: [{ id: 'w1', title: 'Pihenőnapi felső' }] },
  ])
  expect(tiles.find((t) => t.kind === 'gym')?.value).toBe('2×')
})
