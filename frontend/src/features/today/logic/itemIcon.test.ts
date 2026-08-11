import { describe, expect, test } from 'vitest'
import { habitIcon } from '@/features/today/logic/itemIcon'
import type { HabitChainInfo, HabitDefInfo } from '@/data/types'

const def = (habitKey: string, skillKey: string): HabitDefInfo => ({
  id: `def-${habitKey}`, habitKey, chainKey: 'MORNING', position: 0, title: habitKey,
  why: null, anchorCopy: null, mode: 'MANUAL', metric: '', skillKey, xp: 5,
  linkUrl: null, isActive: true,
})

const chain = (defs: HabitDefInfo[], daypart: HabitChainInfo['daypart'] = 'MORNING'): HabitChainInfo => ({
  id: 'c1', chainKey: 'MORNING', title: 'Reggeli rutin', daypart, position: 0, isActive: true, defs,
})

describe('habitIcon — a háromfokú létra', () => {
  test('1. fok: a kurált habitKey-tábla nyer minden más előtt', () => {
    // A `pushups` a táblában 💪; a skillKey `recovery` lenne, a napszak 🌅 — egyik sem nyerhet.
    expect(habitIcon('pushups', chain([def('pushups', 'recovery')]))).toBe('💪')
  })

  test('2. fok: ismeretlen habitKey a lánc def-jéből vett skillKey emojiját kapja', () => {
    expect(habitIcon('sajat_szokas', chain([def('sajat_szokas', 'mindfulness')]))).toBe('🧘')
  })

  test('2. fok: mind a nyolc life-skill ad emojit', () => {
    const skills = ['mindfulness', 'mindset', 'cooking', 'financial',
                    'productivity', 'learning', 'connection', 'recovery']
    const icons = skills.map((s) => habitIcon('x', chain([def('x', s)])))
    expect(icons.every((i) => i.length > 0)).toBe(true)
    expect(new Set(icons).size).toBe(skills.length) // mind a nyolc KÜLÖNBÖZŐ
  })

  test('3. fok: ha se kurált kulcs, se ismert skillKey, a napszak emojija jön', () => {
    expect(habitIcon('sajat_szokas', chain([def('sajat_szokas', 'ismeretlen')], 'EVENING'))).toBe('🌙')
    expect(habitIcon('sajat_szokas', chain([def('sajat_szokas', 'ismeretlen')], 'DAY'))).toBe('☀️')
  })

  test('3. fok: hiányzó def sem dob — a napszakra esik vissza', () => {
    expect(habitIcon('nincs_ilyen', chain([], 'MORNING'))).toBe('🌅')
  })
})
