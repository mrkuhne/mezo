import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BiometricCard } from '@/features/me/components/BiometricCard'
import { biometricProfile as mockProfile } from '@/data/me/goals'

test('renders the profile values + the derived base-TDEE line', () => {
  render(<BiometricCard profile={mockProfile} onEdit={() => {}} />)
  expect(screen.getByText('Férfi')).toBeInTheDocument()
  expect(screen.getByText('180')).toBeInTheDocument() // height
  // Activity short label + PAL multiplier (HU decimal comma).
  expect(screen.getByText(/Mérsékelt/)).toBeInTheDocument()
  expect(screen.getByText(/×1,55/)).toBeInTheDocument()
  // Derived base-TDEE line from tdeeBootstrap (rounded, ≈ prefix).
  expect(screen.getByText(/≈2960/)).toBeInTheDocument()
  expect(screen.getByText(/Katch/)).toBeInTheDocument()
})

test('omits the base-TDEE line when tdeeBootstrap is null', () => {
  render(<BiometricCard profile={{ ...mockProfile, tdeeBootstrap: null }} onEdit={() => {}} />)
  expect(screen.queryByText(/Alap-TDEE/)).not.toBeInTheDocument()
})

test('szerkesztés › opens the sheet (calls onEdit)', async () => {
  const onEdit = vi.fn()
  render(<BiometricCard profile={mockProfile} onEdit={onEdit} />)
  await userEvent.click(screen.getByRole('button', { name: /szerkesztés/i }))
  expect(onEdit).toHaveBeenCalledTimes(1)
})

test('empty state prompts to set up biometrics and opens the sheet', async () => {
  const onEdit = vi.fn()
  render(<BiometricCard profile={null} onEdit={onEdit} />)
  expect(screen.getByText(/Állítsd be a biometriád/)).toBeInTheDocument()
  await userEvent.click(screen.getByText(/Állítsd be a biometriád/))
  expect(onEdit).toHaveBeenCalledTimes(1)
})

test('renders the Napiv .biocard grid + tdee row', () => {
  const { container } = render(<BiometricCard profile={mockProfile} onEdit={() => {}} />)
  expect(container.querySelector('.biocard')).toBeInTheDocument()
  expect(container.querySelector('.biogrid')).toBeInTheDocument()
  expect(container.querySelector('.tdee')).toBeInTheDocument()
})
