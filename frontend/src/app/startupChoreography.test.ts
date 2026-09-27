import { expect, test } from 'vitest'
import { ORBIT_ICONS, ORBIT_RADIUS_PX, splashFrame } from '@/app/startupChoreography'

// The owner-approved timing (mezo-1dxhp, prototype indito-animacio.html „D").

test('the fill starts at once and comes to rest at ~70% as the fade begins', () => {
  expect(splashFrame(0).level).toBe(150)
  expect(splashFrame(1350).level).toBeGreaterThan(48)
  expect(splashFrame(1350).level).toBeLessThan(150)
  expect(splashFrame(2700).level).toBeCloseTo(48)
  expect(splashFrame(3000).level).toBeCloseTo(48)
})

test('icons spawn one by one, 0.1 s behind the fill and 0.24 s apart', () => {
  expect(splashFrame(100).icons.every((i) => i.opacity === 0)).toBe(true)
  const at = splashFrame(400).icons.map((i) => i.opacity)
  expect(at[0]).toBeGreaterThan(0)
  expect(at[1]).toBeGreaterThan(0)
  expect(at[2]).toBe(0)
  expect(splashFrame(1560).icons.every((i) => i.opacity === 1)).toBe(true)
})

test('the orbit is a flat circle around the orb', () => {
  for (const t of [0, 900, 2400]) {
    for (const i of splashFrame(t).icons) expect(Math.hypot(i.x, i.y)).toBeCloseTo(ORBIT_RADIUS_PX)
  }
  expect(ORBIT_ICONS.map((i) => i.id)).toEqual(['t-sun', 't-dumbbell', 't-bowl', 't-water', 't-moon'])
})

test('the resting frame does not move with time', () => {
  expect(splashFrame(0, true)).toEqual(splashFrame(2000, true))
  const still = splashFrame(0, true)
  expect(still.level).toBe(48)
  expect(still.icons.every((i) => i.opacity === 1 && i.scale === 1 && i.flash === 0)).toBe(true)
  expect(still.bubbles.every((b) => b.opacity === 0)).toBe(true)
  expect(still.sheenOn).toBe(false)
})
