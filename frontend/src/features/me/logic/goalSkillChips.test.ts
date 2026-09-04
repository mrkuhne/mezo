import { expect, test } from 'vitest'
import { goalSkillChips } from '@/features/me/logic/goalSkillChips'
import { MOCK_LIFE_GOALS } from '@/data/lifegoal/lifegoalMock'

test('minden aktív cél minden pillére ad chipet a saját skilljére', () => {
  const chips = goalSkillChips(MOCK_LIFE_GOALS)
  const active = MOCK_LIFE_GOALS.filter((g) => g.status === 'active')
  for (const g of active) {
    for (const p of g.pillars) {
      expect(chips.get(p.skillKey)).toBeDefined()
    }
  }
})

test('parkolt és lezárt cél NEM ad chipet', () => {
  const parked = MOCK_LIFE_GOALS.find((g) => g.status === 'parked')!
  const chips = goalSkillChips([parked])
  expect(chips.size).toBe(0)
})

test('inaktív pillér nem ad chipet', () => {
  const g = MOCK_LIFE_GOALS.find((x) => x.status === 'active')!
  const chips = goalSkillChips([{ ...g, pillars: g.pillars.map((p) => ({ ...p, active: false })) }])
  expect(chips.size).toBe(0)
})
