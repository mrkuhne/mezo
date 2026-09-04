import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GoalSuggestionDiffGrid } from '@/features/me/components/GoalSuggestionDiffGrid'
import type { DiffRow } from '@/features/me/logic/goalSuggestionDiff'

test('renders the same five aligned cells for every change row', () => {
  const rows: DiffRow[] = [
    { field: 'weekAverageKcal', label: 'Heti napi átlag', current: '2 780 kcal', proposed: '2 660 kcal', delta: '−120 kcal', status: 'changed' },
    { field: 'protein', label: 'Fehérje', current: '188 g', proposed: '188 g', delta: 'Nem változik', status: 'unchanged' },
  ]
  const { container } = render(<GoalSuggestionDiffGrid rows={rows} />)
  const articles = [...container.querySelectorAll('.gdiff-row')]
  expect(articles).toHaveLength(2)
  for (const article of articles) {
    expect(article.querySelectorAll(':scope > *')).toHaveLength(5)
    expect(article.querySelector('.gdiff-label')).toBeTruthy()
    expect(article.querySelector('.gdiff-current')).toBeTruthy()
    expect(article.querySelector('.gdiff-arrow')).toBeTruthy()
    expect(article.querySelector('.gdiff-proposed')).toBeTruthy()
    expect(article.querySelector('.gdiff-delta')).toBeTruthy()
  }
})
