import { expect, test } from 'vitest'
import type { GoalSuggestionPreviewResponse } from '@/data/me/goalApi'
import { toSuggestionDiffRows } from '@/features/me/logic/goalSuggestionDiff'

const preview: GoalSuggestionPreviewResponse = {
  status: 'proposed',
  reasonCode: 'weekly_correction',
  affectedFromWeek: 3,
  affectedToWeek: 8,
  current: {
    trajectory: 'cut', targetWeightKg: 78, targetDate: '2026-10-24', targetRateKgPerWeek: -0.18,
    weekAverageKcal: 2780, trainingDayKcal: 2940, restDayKcal: 2580,
    proteinG: 188, carbsG: null, fatG: 82,
    segmentFromWeek: 3, segmentToWeek: 5, segmentLabel: 'MAV',
    guardStatus: null,
  },
  proposed: {
    trajectory: 'cut', targetWeightKg: 78, targetDate: '2026-10-24', targetRateKgPerWeek: -0.2,
    weekAverageKcal: 2660, trainingDayKcal: 2820, restDayKcal: 2460,
    proteinG: 188, carbsG: null, fatG: 78,
    segmentFromWeek: 3, segmentToWeek: 5, segmentLabel: 'MAV',
    guardStatus: null,
  },
  changedFields: ['targetRateKgPerWeek', 'weekAverageKcal', 'trainingDayKcal', 'restDayKcal', 'fatG'],
  unchangedFields: ['trajectory', 'targetWeightKg', 'targetDate', 'proteinG', 'carbsG', 'segment', 'guards'],
  warnings: [], blockers: [], canApply: true, previewFingerprint: 'a'.repeat(64),
}

test('returns every field in the fixed visual order and keeps unchanged rows explicit', () => {
  const rows = toSuggestionDiffRows(preview)
  expect(rows.map(row => row.field)).toEqual([
    'trajectory', 'targetWeightKg', 'targetDate', 'targetRate', 'weekAverageKcal',
    'trainingDayKcal', 'restDayKcal', 'protein', 'carbs', 'fat', 'segment', 'guards',
  ])
  expect(rows.find(row => row.field === 'trajectory')).toMatchObject({ status: 'unchanged', delta: 'Nem változik' })
  expect(rows.find(row => row.field === 'weekAverageKcal')).toMatchObject({ current: '2 780 kcal', proposed: '2 660 kcal', delta: '−120 kcal' })
  expect(rows.find(row => row.field === 'targetRate')).toMatchObject({ current: '−0,18 kg/hét', proposed: '−0,20 kg/hét' })
})

test('formats nullable numbers as an em dash and never as NaN', () => {
  const rows = toSuggestionDiffRows(preview)
  const carbs = rows.find(row => row.field === 'carbs')
  expect(carbs).toMatchObject({ current: '—', proposed: '—', status: 'unchanged' })
  expect(JSON.stringify(rows)).not.toContain('NaN')
})
