import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StackMealMatch } from '@/features/fuel/components/StackMealMatch'
import type { MealMatchResult, MealMatchSuggestion, MealMatchVerdict } from '@/features/fuel/logic/matchMealsToStack'

// Component-level coverage for the meal-match section (review finding, mezo-vx9v Task 8): the
// non-empty branch (suggestion Link + metric, verdict rows) and the hidden-when-empty branch,
// driven with explicit fixtures rather than the mock seed (whose real page-level behavior is
// separately smoke-tested in FuelStackPage.test.tsx).

const renderResult = (result: MealMatchResult) =>
  render(<MemoryRouter><StackMealMatch result={result} /></MemoryRouter>)

const suggestion: MealMatchSuggestion = {
  zone: 'lunch',
  zoneLabel: 'Ebéd',
  time: '12:30',
  recipeId: 'rec-lunch-42',
  recipeName: 'Csirke + édesburgonya + spenót',
  metric: '18g zsír / adag',
  reason: 'A D3 + K2 zsíros étkezést kér.',
}
const okVerdict: MealMatchVerdict = {
  zone: 'lunch', dayLabel: 'ma', mealTitle: 'Csirke + édesburgonya + spenót', ok: true, metric: '18g zsír', advice: null,
}
const warnVerdict: MealMatchVerdict = {
  zone: 'dinner', dayLabel: 'tegnap', mealTitle: 'Saláta', ok: false, metric: '6g zsír',
  advice: 'A D3 zsíros étkezést kér — legközelebb tedd zsírosabb fogás mellé, vagy mozgasd vacsorára.',
}

test('hidden entirely when both suggestions and verdicts are empty', () => {
  const { container } = renderResult({ suggestions: [], verdicts: [] })
  expect(container.firstChild).toBeNull()
})

test('renders a suggestion row: recipe Link with the correct href + metric + reason text', () => {
  renderResult({ suggestions: [suggestion], verdicts: [] })
  const link = screen.getByRole('link', { name: suggestion.recipeName })
  expect(link).toHaveAttribute('href', '/fuel/recipes/rec-lunch-42')
  expect(screen.getByText(`${suggestion.metric} · ${suggestion.reason}`)).toBeInTheDocument()
  expect(screen.getByText(suggestion.zoneLabel)).toBeInTheDocument()
})

test('renders an ok (✓) verdict row without advice', () => {
  renderResult({ suggestions: [], verdicts: [okVerdict] })
  expect(screen.getByText('✓')).toBeInTheDocument()
  expect(screen.getByText(okVerdict.mealTitle)).toBeInTheDocument()
  expect(screen.getByText(okVerdict.metric)).toBeInTheDocument()
})

test('renders a not-ok (⚠) verdict row with its advice text', () => {
  renderResult({ suggestions: [], verdicts: [warnVerdict] })
  expect(screen.getByText('⚠')).toBeInTheDocument()
  expect(screen.getByText(warnVerdict.mealTitle)).toBeInTheDocument()
  expect(screen.getByText(warnVerdict.advice!)).toBeInTheDocument()
})

test('renders suggestions and verdicts together (the section is not either/or)', () => {
  renderResult({ suggestions: [suggestion], verdicts: [okVerdict, warnVerdict] })
  expect(screen.getByRole('link', { name: suggestion.recipeName })).toBeInTheDocument()
  expect(screen.getAllByText('✓')).toHaveLength(1)
  expect(screen.getAllByText('⚠')).toHaveLength(1)
})
