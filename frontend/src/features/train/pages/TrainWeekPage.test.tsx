import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { TrainWeekPage } from '@/features/train/pages/TrainWeekPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  mockNavigate.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

const renderPage = () => render(<QueryWrapper><MemoryRouter><LevelUpProvider><TrainWeekPage /></LevelUpProvider></MemoryRouter></QueryWrapper>)

test('renders the week head, the load tiles and one card per weekday', () => {
  const { container } = renderPage()
  expect(screen.getByRole('heading', { name: 'Heti terv' })).toBeInTheDocument()
  expect(container.querySelectorAll('.loadtile')).toHaveLength(3)
  expect(container.querySelectorAll('.dayrow')).toHaveLength(7)
})

test('tapping a non-gym session drills into Mai with that day selected', () => {
  const { container } = renderPage()
  // the mock week has volleyball on Monday (index 0) — its session block navigates to Mai
  const monday = container.querySelectorAll('.dayrow')[0]
  const sportBlock = monday.querySelectorAll('.s')
  fireEvent.click(sportBlock[sportBlock.length - 1])
  expect(mockNavigate).toHaveBeenCalledWith('/train?day=0')
})

test('keeps the provenance note and the Saját edzés footer', () => {
  renderPage()
  expect(screen.getByText(/A gym a mesociklus szerint/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Saját edzés/ })).toBeInTheDocument()
})
