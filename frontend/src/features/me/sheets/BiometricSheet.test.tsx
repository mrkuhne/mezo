import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BiometricSheet } from '@/features/me/sheets/BiometricSheet'
import { biometricProfile as mockProfile } from '@/data/me/goals'
import { biometricProfileApi } from '@/data/me/biometricProfileApi'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  // Exercise the real-mode upsert path so we can assert the PUT body + invalidate.
  vi.stubEnv('VITE_USE_MOCK', 'false')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function renderSheet(profile: typeof mockProfile | null = mockProfile, onClose = () => {}) {
  return render(
    <QueryWrapper>
      <BiometricSheet onClose={onClose} profile={profile} />
    </QueryWrapper>,
  )
}

test('prefills the sheet from the current profile', () => {
  renderSheet()
  expect(screen.getByLabelText('Magasság')).toHaveValue(180)
  expect(screen.getByLabelText('Születési dátum')).toHaveValue('1991-03-01')
  expect(screen.getByLabelText('Testzsír')).toHaveValue(15)
  // Nem segmented: Férfi pressed; activity: Vegyes (MIXED) pressed.
  expect(screen.getByRole('button', { name: 'Férfi' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Vegyes/ })).toHaveAttribute('aria-pressed', 'true')
})

test('edits then Mentés calls biometricProfileApi.upsert with the right body + closes', async () => {
  const upsertSpy = vi
    .spyOn(biometricProfileApi, 'upsert')
    .mockResolvedValue({ sex: 'F', heightCm: 170, birthDate: '1991-03-01', activityLevel: 'PHYSICAL', bodyFatPct: 15, tdeeBootstrap: null })
  const onClose = vi.fn()
  renderSheet(mockProfile, onClose)

  // Switch sex to Nő, change height, bump activity to Fizikai (PHYSICAL).
  await userEvent.click(screen.getByRole('button', { name: 'Nő' }))
  const height = screen.getByLabelText('Magasság')
  await userEvent.clear(height)
  await userEvent.type(height, '170')
  await userEvent.click(screen.getByRole('button', { name: /Fizikai/ }))

  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))

  expect(upsertSpy).toHaveBeenCalledTimes(1)
  expect(upsertSpy).toHaveBeenCalledWith({
    sex: 'F',
    heightCm: 170,
    birthDate: '1991-03-01',
    activityLevel: 'PHYSICAL',
    bodyFatPct: 15,
  })
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('omits bodyFatPct from the body when testzsír is cleared', async () => {
  const upsertSpy = vi
    .spyOn(biometricProfileApi, 'upsert')
    .mockResolvedValue({ sex: 'M', heightCm: 180, birthDate: '1991-03-01', activityLevel: 'MIXED', tdeeBootstrap: null })
  renderSheet()
  await userEvent.clear(screen.getByLabelText('Testzsír'))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(upsertSpy).toHaveBeenCalledTimes(1)
  expect(upsertSpy.mock.calls[0][0]).not.toHaveProperty('bodyFatPct')
})

test('renders the empty-profile prefill defaults when no profile exists', () => {
  renderSheet(null)
  expect(screen.getByLabelText('Magasság')).toHaveValue(180)
  expect(screen.getByRole('button', { name: 'Férfi' })).toHaveAttribute('aria-pressed', 'true')
})

// ── the split-TDEE door (mezo-d20.11) ──
// BiometricCard was the only Én-side entry into the shared EnergyBreakdownSheet and
// it lost its host with AppHero/ProfilePage. The row lives here now; the host decides
// whether it can swap sheets (`onExplainEnergy`).

test('the split-TDEE row renders the persisted bootstrap and opens the breakdown', async () => {
  const onExplain = vi.fn()
  render(
    <QueryWrapper>
      <BiometricSheet onClose={() => {}} profile={mockProfile} onExplainEnergy={onExplain} />
    </QueryWrapper>,
  )
  const row = screen.getByRole('button', { name: 'Energia-bontás magyarázata' })
  expect(row).toHaveTextContent('2579')
  expect(row).toHaveTextContent('+421')
  expect(row).toHaveTextContent('≈3000')
  await userEvent.click(row)
  expect(onExplain).toHaveBeenCalledTimes(1)
})

test('no tdeeBootstrap (engine not run) renders no row — never a fabricated number', () => {
  renderSheet({ ...mockProfile, tdeeBootstrap: null })
  expect(screen.queryByText('Fenntartó energia')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Energia-bontás magyarázata' })).not.toBeInTheDocument()
})
