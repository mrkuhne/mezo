import { describe, expect, test } from 'vitest'
import { questAction } from '@/features/today/logic/questAction'
import type { DailyQuest } from '@/data/types'

const quest = (overrides: Partial<DailyQuest>): DailyQuest => ({
  id: 'q1',
  questDate: '2026-07-19',
  slot: 'FUELBIO',
  skillKey: 'recovery',
  title: 'Teszt küldetés',
  why: 'Teszt.',
  targetLabel: '',
  metric: 'water_target',
  xp: 15,
  status: 'offered',
  completionMode: 'DERIVED',
  ...overrides,
})

describe('questAction', () => {
  test('ACTIVITY mode wins over any metric — Naplózz', () => {
    expect(questAction(quest({ completionMode: 'ACTIVITY', metric: 'activity_match' })))
      .toEqual({ kind: 'activity', label: 'Naplózz' })
    // defensive: an ACTIVITY quest with a weird metric still routes to the sheet
    expect(questAction(quest({ completionMode: 'ACTIVITY', metric: 'water_target' })))
      .toEqual({ kind: 'activity', label: 'Naplózz' })
  })

  test.each([
    ['water_target', { kind: 'water', label: '+250 ml', amountMl: 250 }],
    ['checkin_full', { kind: 'checkin', label: 'Check-in' }],
    ['weight_logged', { kind: 'nav', label: 'Mérés', to: '/me/weight' }],
    ['sleep_target', { kind: 'nav', label: 'Alvás', to: '/me/sleep' }],
    ['protein_target', { kind: 'nav', label: 'Fuel', to: '/fuel' }],
    ['own_recipe_meal', { kind: 'nav', label: 'Főzés', to: '/fuel/recipes' }],
    ['gym_session_done', { kind: 'nav', label: 'Edzés', to: '/train' }],
  ] as const)('derived %s → %o', (metric, expected) => {
    expect(questAction(quest({ metric }))).toEqual(expected)
  })

  test('unknown or missing metric → null (state-only row, future-metric safe)', () => {
    expect(questAction(quest({ metric: 'brand_new_metric' }))).toBeNull()
    expect(questAction(quest({ metric: '' }))).toBeNull()
  })
})
