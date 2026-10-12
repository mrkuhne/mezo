import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StackMealMatch } from '@/features/fuel/components/StackMealMatch'
import type { MealMatchResult, MealMatchSuggestion, MealMatchVerdict } from '@/features/fuel/logic/matchMealsToStack'

// Folyadék F5 (mezo-n4wf5.5): the rows are kit rows — a suggestion is ONE link to the recipe (zone + time, the recipe,
// the metric and why), a verdict wears the tick or the info glyph and a „rendben" / „kevés" pill.
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
  metric: '18 g zsír / adag',
  reason: 'A D3 + K2 zsíros étkezést kér.',
}
const okVerdict: MealMatchVerdict = {
  zone: 'lunch', day: 'today', dayLabel: 'ma', mealTitle: 'Csirke + édesburgonya + spenót', ok: true, metric: '18 g zsír', advice: null,
}
const warnVerdict: MealMatchVerdict = {
  zone: 'dinner', day: 'yesterday', dayLabel: 'tegnap', mealTitle: 'Saláta', ok: false, metric: '6 g zsír',
  advice: 'A D3 zsíros étkezést kér. Legközelebb tedd zsírosabb fogás mellé, vagy mozgasd vacsorára.',
}

test('hidden entirely when both suggestions and verdicts are empty', () => {
  const { container } = renderResult({ suggestions: [], verdicts: [] })
  expect(container.firstChild).toBeNull()
})

test('renders a suggestion row: recipe Link with the correct href + metric + reason text', () => {
  renderResult({ suggestions: [suggestion], verdicts: [] })
  const link = screen.getByRole('link', { name: /Csirke \+ édesburgonya \+ spenót/ })
  expect(link).toHaveAttribute('href', '/fuel/recipes/rec-lunch-42')
  expect(link).toHaveTextContent(`${suggestion.metric} · ${suggestion.reason}`)
  expect(screen.getByText('Ebéd · 12:30')).toBeInTheDocument()
  expect(screen.getByText('Étkezés-egyeztetés · makró és mikro')).toBeInTheDocument()
})

// An ok verdict wears the tick glyph and the „rendben" pill, a short one the info glyph and „kevés".
const okMarks = (c: HTMLElement) => c.querySelectorAll('.fo-st.ok')
const warnMarks = (c: HTMLElement) => c.querySelectorAll('.fo-st.warn')

test('renders an ok (lit tick) verdict row without advice', () => {
  const { container } = renderResult({ suggestions: [], verdicts: [okVerdict] })
  expect(okMarks(container)).toHaveLength(1)
  expect(warnMarks(container)).toHaveLength(0)
  expect(container.querySelector('use[href="#t-tick"]')).not.toBeNull()
  expect(screen.getByText('rendben')).toBeInTheDocument()
  expect(screen.getByText('Csirke + édesburgonya + spenót · ma')).toBeInTheDocument()
  expect(screen.getByText(okVerdict.metric)).toBeInTheDocument()
})

test('renders a not-ok (warning marker) verdict row with its advice text', () => {
  const { container } = renderResult({ suggestions: [], verdicts: [warnVerdict] })
  expect(warnMarks(container)).toHaveLength(1)
  expect(okMarks(container)).toHaveLength(0)
  expect(container.querySelector('use[href="#t-info"]')).not.toBeNull()
  expect(screen.getByText('kevés')).toBeInTheDocument()
  expect(screen.getByText('Saláta · tegnap')).toBeInTheDocument()
  expect(screen.getByText(new RegExp(warnVerdict.advice!))).toBeInTheDocument()
})

test('renders suggestions and verdicts together (the section is not either/or)', () => {
  const { container } = renderResult({ suggestions: [suggestion], verdicts: [okVerdict, warnVerdict] })
  expect(screen.getByRole('link', { name: /Csirke \+ édesburgonya \+ spenót/ })).toBeInTheDocument()
  expect(okMarks(container)).toHaveLength(1)
  expect(warnMarks(container)).toHaveLength(1)
})
