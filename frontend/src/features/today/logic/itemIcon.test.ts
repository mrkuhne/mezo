import { describe, expect, test } from 'vitest'
import { mockHabitCatalog } from '@/data/habit/habitMock'
import { habitIcon } from '@/features/today/logic/itemIcon'
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

describe('habitIcon — a háromfokú létra', () => {
  test('1. fok: a kurált habitKey-tábla nyer minden más előtt', () => {
    // A `morning_pushups` (valódi seed-kulcs) a táblában 💪; a def skillKey `recovery` lenne,
    // a napszak 🌅 — egyik sem nyerhet.
    expect(habitIcon('morning_pushups', chain([def('morning_pushups', 'recovery')]))).toBe('💪')
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

  test('regresszió: a valódi katalógus (mockHabitCatalog) egyetlen láncában sincs két azonos ikon', () => {
    // A `HABIT_ICON` tábla driftelhet a katalógustól (pontosan ez történt korábban: 10 a 16
    // kulcsból kitalált volt, nem valódi `habitKey`) — ez a teszt a VALÓDI seedet importálja,
    // nem szintetikus kulcsokat, úgyhogy egy jövőbeli drift itt buknia kell.
    for (const c of mockHabitCatalog.chains) {
      const icons = c.defs.map((d) => habitIcon(d.habitKey, c))
      expect(new Set(icons).size).toBe(icons.length)
    }
  })
})
