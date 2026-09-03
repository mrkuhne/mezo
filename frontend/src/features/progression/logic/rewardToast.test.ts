import { expect, test } from 'vitest'
import type { LevelUpResult } from '@/data/train/trainApi'
import { buildHabitRewardToast, buildQuestRewardToast } from '@/features/progression/logic/rewardToast'

// NOTE: the brief's fixture used skillKey 'mental' expecting the label 'Mentális'. LIFE_META
// (features/progression/logic/levelUpMeta.ts) has no 'mental' key, so skillDisplay would fall
// back to the raw key instead of a Hungarian label. Swapped to a real LIFE_META key —
// 'mindfulness' → 'Tudatosság' — per the task brief's disambiguation note (do not touch
// levelUpMeta.ts / skillDisplay to make the fixture fit).
const habitLevelUp: LevelUpResult = {
  source: 'HABIT', workoutLabel: 'Napi szándék', totalXp: 15,
  gains: [{ skillKey: 'mindfulness', kind: 'LIFE', name: 'mindfulness', xpGained: 15,
    levelBefore: 3, levelAfter: 4, progressFromPct: 90, progressToPct: 12 }],
  levelUps: ['mindfulness'], perks: [], robustness: { xpGained: 0, streakWeeks: 0 },
}

const habitNoLevelUp: LevelUpResult = {
  ...habitLevelUp,
  gains: [{ ...habitLevelUp.gains[0], levelBefore: 3, levelAfter: 3, xpGained: 10 }],
  levelUps: [],
}

test('real mód: a meter a gain megjelenítendő skill-nevét és XP-jét hozza', () => {
  const t = buildHabitRewardToast({
    title: 'Napi szándék', chainDone: 1, chainTotal: 3, xp: 15, levelUp: habitNoLevelUp,
  })
  expect(t.kind).toBe('reward')
  expect(t.eyebrow).toBe('Szokás · 2 / 3')       // optimista done + 1
  expect(t.title).toBe('Napi szándék')
  expect(t.meter).toEqual({ label: 'Tudatosság', delta: 10 })
  expect(t.levelUp).toBeUndefined()
})

test('szintlépéskor a levelUp mező kitöltődik', () => {
  const t = buildHabitRewardToast({
    title: 'Napi szándék', chainDone: 1, chainTotal: 3, xp: 15, levelUp: habitLevelUp,
  })
  expect(t.levelUp).toEqual({ label: 'Tudatosság', from: 3, to: 4 })
})

test('mock mód (nincs LevelUpResult): a meter címkéje XP, deltája a habit xp-je', () => {
  const t = buildHabitRewardToast({ title: 'Reggeli súlymérés', chainDone: 0, chainTotal: 3, xp: 10 })
  expect(t.eyebrow).toBe('Szokás · 1 / 3')
  expect(t.meter).toEqual({ label: 'XP', delta: 10 })
  expect(t.levelUp).toBeUndefined()
})

test('üres gains: a toast meter nélkül jön, sosem +undefined', () => {
  const t = buildHabitRewardToast({
    title: 'Reggeli súlymérés', chainDone: 0, chainTotal: 3, xp: 0,
    levelUp: { ...habitLevelUp, gains: [], levelUps: [] },
  })
  expect(t.meter).toBeUndefined()
  expect(t.title).toBe('Reggeli súlymérés')
})

test('lánc-kontextus nélkül (chainTotal 0) az eyebrow számláló nélküli', () => {
  const t = buildHabitRewardToast({ title: 'Wind-down', chainDone: 0, chainTotal: 0, xp: 5 })
  expect(t.eyebrow).toBe('Szokás')
})

test('quest builder: saját eyebrow + meta, a meter a gainből', () => {
  const t = buildQuestRewardToast({
    title: 'Vízivás', meta: '2000 ml', levelUp: habitNoLevelUp,
  })
  expect(t.eyebrow).toBe('Küldetés')
  expect(t.title).toBe('Vízivás')
  expect(t.meta).toBe('2000 ml')
  expect(t.meter).toEqual({ label: 'Tudatosság', delta: 10 })
})

test('quest builder: az eyebrow felülírható (activity-napló)', () => {
  const t = buildQuestRewardToast({ title: 'Favágás', eyebrow: 'Naplózva' })
  expect(t.eyebrow).toBe('Naplózva')
  expect(t.meter).toBeUndefined()
})

test('az ünneplés saját mezőként utazik a toastban', () => {
  const t = buildHabitRewardToast({
    title: '50 fekvőtámasz', chainDone: 2, chainTotal: 8, xp: 10,
    celebration: 'ökölbe szorított kéz + „ez az"',
  })
  expect(t.celebration).toBe('ökölbe szorított kéz + „ez az"')
  // a meta a mennyiségi addendum helye marad — az ünneplés nem foglalja el
  expect(t.meta).toBeUndefined()
})

test('ünneplés nélkül a mező ki sem kerül a payloadba', () => {
  const withNull = buildHabitRewardToast({
    title: 'Reggeli napfény', chainDone: 0, chainTotal: 8, xp: 5, celebration: null,
  })
  expect('celebration' in withNull).toBe(false)

  const omitted = buildHabitRewardToast({
    title: 'Reggeli napfény', chainDone: 0, chainTotal: 8, xp: 5,
  })
  expect('celebration' in omitted).toBe(false)
})
