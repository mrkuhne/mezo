import { describe, expect, test } from 'vitest'
import { mockHabitCatalog } from '@/data/habit/habitMock'
import { CLAY_TO_3D, type ClayIconName } from '@/shared/ui/clay'
import { CURATED_HABIT_KEYS, habitClayIcon, habitContentIcon } from '@/features/today/logic/habitClayIcon'
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

describe('habitContentIcon — a Rutin-sor 3D ikonja (Üveg, mezo-me75u.3)', () => {
  test('a kétértelmű clay-glifák hívóhelyi 3D nevet kapnak', () => {
    const c = chain([])
    expect(habitContentIcon('morning_workout', c, 'MORNING')).toBe('t-run')
    expect(habitContentIcon('protein_breakfast', c, 'MORNING')).toBe('t-protein')
    expect(habitContentIcon('evening_ritual', c, 'EVENING')).toBe('t-moon')
    expect(habitContentIcon('wind_down', c, 'EVENING')).toBe('t-sleep')
  })

  test('a többi a clay-névre esik vissza, lánc nélkül a napszakéra', () => {
    expect(habitContentIcon('morning_weigh_in', chain([]), 'MORNING')).toBe('i-suly')
    expect(habitContentIcon('x', undefined, 'EVENING')).toBe('i-alvas')
  })

  test('minden kurált szokás 3D ikonon ül (nincs clay-tartalék a Rutin-lapon)', () => {
    for (const key of CURATED_HABIT_KEYS) {
      const name = habitContentIcon(key, chain([]), 'MORNING')
      const is3D = name.startsWith('t-') || CLAY_TO_3D[name as ClayIconName] !== undefined
      expect(is3D, key).toBe(true)
    }
  })
})
