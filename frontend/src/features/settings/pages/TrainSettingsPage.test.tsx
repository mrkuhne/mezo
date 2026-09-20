import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { TrainSettingsPage } from '@/features/settings/pages/TrainSettingsPage'
const state = vi.hoisted(() => ({ schedulePending: true, scheduleError: false }))
vi.mock('@/data/hooks', () => ({ useTrain: () => ({ ...state, gymSlots: [], sport: { schedule: null }, saveGymScheduleAsync: vi.fn(), saveSportScheduleAsync: vi.fn() }) }))
beforeEach(() => { state.schedulePending = true; state.scheduleError = false })
test('does not open an empty replacement editor before its schedule arrives', () => {
  const { rerender } = render(<MemoryRouter><TrainSettingsPage editor="gym" /></MemoryRouter>)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Időpontok szerkesztése' })).toBeDisabled()
  state.schedulePending = false
  rerender(<MemoryRouter><TrainSettingsPage editor="gym" /></MemoryRouter>)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
test('failed schedule reads cannot be overwritten with an empty schedule', () => {
  state.schedulePending = false
  state.scheduleError = true
  render(<MemoryRouter><TrainSettingsPage editor="sport" /></MemoryRouter>)
  expect(screen.getByRole('alert')).toHaveTextContent('Nem sikerült betölteni')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Időpontok szerkesztése' })).toBeDisabled()
})
