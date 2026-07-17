import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { GymDaySheet } from '@/features/train/sheets/GymDaySheet'
import type { MesoDay } from '@/data/types'

// Spy on useNavigate so we can assert the exact session target (?day= pinning).
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// The past/future split reads the real clock — pin a Friday (2026-07-17) so
// Csü is a this-week PAST day and Szo a FUTURE one, deterministically.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-17T10:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
  mockNavigate.mockReset()
})

const day = (over: Partial<MesoDay>): MesoDay => ({
  id: 'tpl-1',
  day: 'Csü',
  type: 'Pull Day',
  muscle: 'hát',
  exerciseCount: 1,
  exercises: [{
    id: 'ex-1', name: 'Row', muscle: 'hát', warmupSets: 1, workingSets: 3,
    repMin: 6, repMax: 10, targetRIR: 2, type: 'compound',
  }],
  ...over,
})

test("today's day starts plain (Indítsuk · most → /train/session)", () => {
  render(<GymDaySheet day={day({ day: 'Pén', current: true })} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /Indítsuk · most/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/session')
})

test('a missed past day shows the Elmaradt chip and pins the template via ?day=', () => {
  render(<GymDaySheet day={day({ day: 'Csü' })} onClose={() => {}} />)
  expect(screen.getByText('Elmaradt')).toBeInTheDocument()
  expect(screen.getByText('Csütörtök terv → ma indul')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Indítsuk · ma/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/session?day=tpl-1')
})

test('a future day pulls forward with the same CTA but no Elmaradt chip', () => {
  render(<GymDaySheet day={day({ day: 'Szo' })} onClose={() => {}} />)
  expect(screen.queryByText('Elmaradt')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Indítsuk · ma/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/session?day=tpl-1')
})

test('a day completed this week reviews instead of restarting (D5)', () => {
  render(
    <GymDaySheet
      day={day({ day: 'Szo' })}
      completedThisWeek={{ id: 'w-9', date: '2026-07-17' }}
      onClose={() => {}}
    />,
  )
  expect(screen.getByText('✓ Lenyomva · Pén')).toBeInTheDocument()
  expect(screen.queryByText(/Indítsuk/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Megnézem/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/review/w-9')
})

test("another day's open workout blocks the start (D6) and names the running day", () => {
  render(
    <GymDaySheet
      day={day({ day: 'Szo' })}
      openTemplateSessionId="tpl-other"
      openWorkoutTitle="Pull Day"
      onClose={() => {}}
    />,
  )
  expect(screen.getByText(/Folyamatban: Pull Day/)).toBeInTheDocument()
  expect(screen.queryByText(/Indítsuk/)).toBeNull()
})

test("the open workout's own day resumes (Folytassuk →)", () => {
  render(
    <GymDaySheet
      day={day({ day: 'Csü' })}
      openTemplateSessionId="tpl-1"
      onClose={() => {}}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /Folytassuk/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/session?day=tpl-1')
})

test('a rest day (no exercises) offers no start at all', () => {
  render(<GymDaySheet day={day({ day: 'Vas', exercises: [], exerciseCount: 0, type: 'Rest' })} onClose={() => {}} />)
  expect(screen.getByText('Pihenőnap')).toBeInTheDocument()
  expect(screen.queryByText(/Indítsuk/)).toBeNull()
})
