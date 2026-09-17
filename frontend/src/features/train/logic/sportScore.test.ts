import { describe, expect, test } from 'vitest'
import { sportStars } from './sportScore'

describe('sportStars', () => {
  test.each([
    // minutes, target, rpe → ratio, stars
    [60, 60, 10, 1, 5],
    [30, 60, 5, 0.5, 2.5],
    [0, 60, 0, 0, 0],
    // over target and over-max rpe both clamp at 1 before the weighting.
    [120, 60, 20, 1, 5],
    // negative inputs clamp at 0, not a negative share.
    [-10, 60, -5, 0, 0],
    // a zero/negative target contributes no time share — never divide by zero.
    [10, 0, 5, 0.15, 1],
    [10, -5, 5, 0.15, 1],
    // only effort, no time at all.
    [0, 60, 10, 0.3, 1.5],
    // only time, no effort at all.
    [60, 60, 0, 0.7, 3.5],
  ])('minutes=%p target=%p rpe=%p → ratio=%p stars=%p', (minutes, target, rpe, ratio, stars) => {
    const score = sportStars(minutes, target, rpe)
    expect(score.ratio).toBeCloseTo(ratio, 10)
    expect(score.stars).toBe(stars)
  })
})
