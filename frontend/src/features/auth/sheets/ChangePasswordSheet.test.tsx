import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setToken } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { ChangePasswordSheet } from '@/features/auth/sheets/ChangePasswordSheet'

beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

test('renders the form in a dialog and closes on success', async () => {
  const onClose = vi.fn()
  render(<QueryWrapper><ChangePasswordSheet onClose={onClose} /></QueryWrapper>)
  expect(screen.getByRole('dialog', { name: 'Új jelszó' })).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Jelenlegi jelszó'), 'regi-jelszo-1')
  await userEvent.type(screen.getByLabelText('Új jelszó (min. 8 karakter)'), 'uj-jelszo-2026')
  await userEvent.type(screen.getByLabelText('Új jelszó még egyszer'), 'uj-jelszo-2026')
  await userEvent.click(screen.getByRole('button', { name: 'Jelszó mentése' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('the X chip closes without saving', async () => {
  const onClose = vi.fn()
  render(<QueryWrapper><ChangePasswordSheet onClose={onClose} /></QueryWrapper>)
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
