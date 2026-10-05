import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeekHeroCard } from './WeekHeroCard'
import { renderUnit } from './hubTestKit'
import { mockMeWeek } from '@/data/me/meWeek'
import { mockWeeklyReview } from '@/data/me/weeklyReviewMock'
import { mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { prevMonday } from '@/features/me/logic/weekNav'
import { firstSentence } from '@/features/me/logic/weekHub'

// The week hero (mezo-lhqw7): the last CLOSED week. The two hooks are stubbed at the boundary
// and fed the mock-mode seeds, so the face is asserted identically in both modes.
const START = prevMonday(mondayIso())
const useMeWeek = vi.hoisted(() => vi.fn())
const useWeeklyReview = vi.hoisted(() => vi.fn())

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useMeWeek, useWeeklyReview }
})

const seedWeek = () => mockMeWeek(START)
const seedReview = () => mockWeeklyReview(START)!
const weekState = (over: object = {}) => ({ week: seedWeek(), mode: 'mock', isPending: false, isError: false, refetch: vi.fn(), ...over })
const reviewState = (over: object = {}) => ({ review: seedReview(), digest: null, isPending: false, isError: false, ...over })

beforeEach(() => {
  useMeWeek.mockReturnValue(weekState())
  useWeeklyReview.mockReturnValue(reviewState())
})

test('asks both hooks for the last closed week', () => {
  renderUnit(<WeekHeroCard />)
  expect(useMeWeek).toHaveBeenCalledWith(START)
  expect(useWeeklyReview).toHaveBeenCalledWith(START)
})

test('the seed week: eyebrow, the score ring, the delta pill and the two labelled lines', () => {
  renderUnit(<WeekHeroCard />)
  const hero = document.querySelector('.enh-wkhero')!
  expect(hero).toHaveClass('uv-halo')
  expect(hero).not.toHaveClass('glass')
  expect(hero.querySelector('.enh-wkeb')).toHaveTextContent(`${deriveWeekTitle(START)} · lezárt hét`)
  const score = seedWeek().weekly.score!
  expect(screen.getByRole('img', { name: `Pontszám: ${score} / 100` })).toBeInTheDocument()
  expect(hero).toHaveTextContent('az előző héthez')
  const well = hero.querySelector('.enh-wkline.is-well')!
  expect(well).toHaveTextContent(`Jól ment: ${seedReview().wentWell}`)
  const watch = hero.querySelector('.enh-wkline.is-watch')!
  expect(watch).toHaveTextContent(`Figyelj rá: ${seedReview().watchOut}`)
  expect(hero.querySelectorAll('.enh-wkline')).toHaveLength(2)
})

test('a review from before the hero lines falls back to its first two sentences, unlabelled', () => {
  const review = { ...seedReview(), wentWell: null, watchOut: null }
  useWeeklyReview.mockReturnValue(reviewState({ review }))
  renderUnit(<WeekHeroCard />)
  const lines = [...document.querySelectorAll('.enh-wkline')]
  expect(lines).toHaveLength(2)
  expect(lines[0]).toHaveTextContent(firstSentence(review.summary))
  expect(lines[0].className).toBe('enh-wkline')
  expect(screen.queryByText(/Jól ment:/)).toBeNull()
  expect(screen.queryByText(/Figyelj rá:/)).toBeNull()
})

test('only wentWell set → exactly one labelled line', () => {
  useWeeklyReview.mockReturnValue(reviewState({ review: { ...seedReview(), watchOut: null } }))
  renderUnit(<WeekHeroCard />)
  const lines = [...document.querySelectorAll('.enh-wkline')]
  expect(lines).toHaveLength(1)
  expect(lines[0]).toHaveClass('is-well')
  expect(screen.queryByText(/Figyelj rá:/)).toBeNull()
})

test('a closed week without a review says so in one honest sentence', () => {
  useWeeklyReview.mockReturnValue(reviewState({ review: null }))
  renderUnit(<WeekHeroCard />)
  const lines = [...document.querySelectorAll('.enh-wkline')]
  expect(lines).toHaveLength(1)
  expect(lines[0]).toHaveTextContent('Ez a hét lezárt, de nem készült elemzés')
})

test('an unresolved or failed review is not reported as „nem készült elemzés"', () => {
  useWeeklyReview.mockReturnValue(reviewState({ review: null, isPending: true }))
  const { unmount } = renderUnit(<WeekHeroCard />)
  expect(document.querySelectorAll('.enh-wkline')).toHaveLength(0)
  unmount()
  useWeeklyReview.mockReturnValue(reviewState({ review: null, isError: true }))
  renderUnit(<WeekHeroCard />)
  expect(document.querySelectorAll('.enh-wkline')).toHaveLength(0)
})

test('the CTA opens the heti hub of that week', async () => {
  renderUnit(<WeekHeroCard />)
  await userEvent.click(screen.getByRole('button', { name: 'A heti elemzés ›' }))
  expect(screen.getByTestId('loc')).toHaveTextContent(`/me/week?start=${START}`)
})

test('a week without a score shows the ring’s own „tanulom" state, never a zero, and no delta', () => {
  const week = seedWeek()
  useMeWeek.mockReturnValue(weekState({ week: { ...week, weekly: { ...week.weekly, score: null } } }))
  renderUnit(<WeekHeroCard />)
  expect(screen.getByRole('img', { name: 'Pontszám: tanulom' })).toBeInTheDocument()
  expect(screen.queryByText('az előző héthez')).toBeNull()
})

test('while the week loads: the ring skeleton and no lines', () => {
  useMeWeek.mockReturnValue(weekState({ week: null, isPending: true }))
  renderUnit(<WeekHeroCard />)
  expect(document.querySelector('.wkh-skel.ring')).not.toBeNull()
  expect(screen.queryByRole('img')).toBeNull()
  expect(document.querySelectorAll('.enh-wkline')).toHaveLength(0)
})

test('a failed load is an error with a retry, not an empty week', async () => {
  const refetch = vi.fn()
  useMeWeek.mockReturnValue(weekState({ week: null, isError: true, refetch }))
  renderUnit(<WeekHeroCard />)
  expect(screen.getByText('Nem sikerült betölteni a hetet.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Újra' }))
  expect(refetch).toHaveBeenCalled()
  expect(screen.queryByRole('img')).toBeNull()
})
