import { describe, expect, test } from 'vitest'
import { DEFAULT_TITLE_KEY, TITLE_CATALOG } from '@/data/gamification/titleCatalog'
import { GHOST_GAMIFICATION, gamificationProfileMock } from '@/data/gamification/gamificationMock'
import { levelFromTotalXp } from '@/data/gamification/levelCurve'

describe('titleCatalog', () => {
  test('catalog: 9 ladder titles ascending, 7 priced shop titles, unique keys', () => {
    const ladder = TITLE_CATALOG.filter((t) => t.kind === 'LADDER')
    const shop = TITLE_CATALOG.filter((t) => t.kind === 'SHOP')
    expect(ladder).toHaveLength(9)
    expect(shop).toHaveLength(7)
    expect(new Set(TITLE_CATALOG.map((t) => t.key)).size).toBe(16)
    const levels = ladder.map((t) => t.unlockLevel!)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
    expect(shop.every((t) => (t.priceCoins ?? 0) > 0)).toBe(true)
    expect(TITLE_CATALOG.some((t) => t.key === DEFAULT_TITLE_KEY && t.unlockLevel === 1)).toBe(true)
  })

  test('mock seed is internally consistent with the level curve', () => {
    const { level, xpInLevel, xpForNext } = levelFromTotalXp(gamificationProfileMock.totalXp)
    expect(gamificationProfileMock.level).toBe(level)
    expect(gamificationProfileMock.xpInLevel).toBe(xpInLevel)
    expect(gamificationProfileMock.xpForNext).toBe(xpForNext)
    expect(GHOST_GAMIFICATION.level).toBe(1)
    expect(GHOST_GAMIFICATION.coins).toBe(0)
    expect(GHOST_GAMIFICATION.activeTitleKey).toBe(DEFAULT_TITLE_KEY)
  })
})
