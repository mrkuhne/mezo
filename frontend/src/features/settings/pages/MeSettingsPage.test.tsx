import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { MeSettingsPage } from '@/features/settings/pages/MeSettingsPage'
vi.mock('@/data/hooks', () => ({
  useBiometricProfile: () => ({ profile: { sex: 'M', heightCm: 180, birthDate: '1990-01-01', activityLevel: 'DESK', tdeeBootstrap: { bmr: 1700, neat: 300, neatBaselineKcal: 2000, weeklyEatKcalPerDay: 200, tdee: 2200, formula: 'MSJ' } }, isLoading: false, isError: false, refetch: vi.fn() }),
  useSleepGoal: () => ({ goal: { isSet: false }, isPending: false, isError: false, refetch: vi.fn() }),
  useBiometricActions: () => ({ upsert: vi.fn(), pending: false }),
}))
test('canonical biometrics retain the energy explanation previously opened from Én', async () => {
  render(<MemoryRouter><MeSettingsPage editor="biometrics" /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Energia-bontás magyarázata' }))
  expect(screen.getByRole('dialog', { name: 'Honnan jön a 2200 kcal?' })).toBeInTheDocument()
})
