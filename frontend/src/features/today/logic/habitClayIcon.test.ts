import { describe, expect, test } from 'vitest'
import { mockHabitCatalog } from '@/data/habit/habitMock'
import { CURATED_HABIT_KEYS, habitClayIcon } from '@/features/today/logic/habitClayIcon'
import type { HabitChainInfo, HabitDefInfo } from '@/data/types'

const def = (habitKey: string, skillKey: string): HabitDefInfo => ({
  id: `def-${habitKey}`, habitKey, chainKey: 'MORNING', position: 0, title: habitKey,
  why: null, anchorCopy: null, mode: 'MANUAL', metric: '', skillKey, xp: 5,
  linkUrl: null, isActive: true,
  framework: null, anchorHabitKey: null, cue: null, craving: null, reward: null, celebration: null, identity: null,
})

const chain = (defs: HabitDefInfo[], daypart: HabitChainInfo['daypart'] = 'MORNING'): HabitChainInfo => ({
  id: 'c1', chainKey: 'MORNING', title: 'Reggeli rutin', daypart, position: 0, isActive: true, defs,
})

describe('habitClayIcon — a prototípus per-szokás `data-habicon`-ja', () => {
  test('1. fok: a kurált habitKey-tábla nyer minden más előtt', () => {
    expect(habitClayIcon('morning_weigh_in', chain([def('morning_weigh_in', 'recovery')]))).toBe('i-suly')
    expect(habitClayIcon('morning_video', chain([def('morning_video', 'recovery')]))).toBe('i-video')
  })

  test('2. fok: ismeretlen habitKey a lánc def-jéből vett skillKey ikonját kapja', () => {
    expect(habitClayIcon('sajat_szokas', chain([def('sajat_szokas', 'connection')]))).toBe('i-emberek')
  })

  test('3. fok: se kurált kulcs, se ismert skillKey → a napszak ikonja', () => {
    expect(habitClayIcon('x', chain([def('x', 'ismeretlen')], 'EVENING'))).toBe('i-alvas')
    expect(habitClayIcon('x', chain([def('x', 'ismeretlen')], 'DAY'))).toBe('i-nap')
    expect(habitClayIcon('nincs_ilyen', chain([], 'MORNING'))).toBe('i-hajnal')
  })

  test('a VALÓDI katalógus minden szokása kurált (1. fok) ikont kap — nincs drift', () => {
    // A tábla driftelhet a seedtől; ez a teszt a valódi `mockHabitCatalog`-ot járja végig.
    const missing = mockHabitCatalog.chains
      .flatMap((c) => c.defs.map((d) => d.habitKey))
      .filter((k) => !CURATED_HABIT_KEYS.includes(k))
    expect(missing).toEqual([])
  })
})
