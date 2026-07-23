import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelSettingsSheet } from '@/features/fuel/sheets/FuelSettingsSheet'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderSheet = (onClose = vi.fn()) => {
  render(<QueryWrapper><FuelSettingsSheet onClose={onClose} /></QueryWrapper>)
  return onClose
}

describe('FuelSettingsSheet', () => {
  test('opens prefilled from the ghost settings', () => {
    renderSheet()
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('4')
    expect(screen.getByLabelText('Koffein-cutoff')).toHaveValue('14:00')
  })

  test('stepper clamps between 3 and 6', async () => {
    renderSheet()
    const minus = screen.getByRole('button', { name: 'Étkezés csökkentése' })
    await userEvent.click(minus)
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('3')
    expect(minus).toBeDisabled()
  })

  test('saving persists the edited values and closes', async () => {
    const onClose = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Étkezés növelése' }))
    fireEvent.change(screen.getByLabelText('Koffein-cutoff'), { target: { value: '13:00' } })
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
