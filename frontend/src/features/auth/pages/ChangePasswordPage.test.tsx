import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage'

beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

test('forced mode explains why and submits', async () => {
  const onSuccess = vi.fn()
  render(<QueryWrapper><ChangePasswordPage forced onSuccess={onSuccess} /></QueryWrapper>)
  expect(screen.getByText('Ideiglenes jelszóval léptél be — válassz egy sajátot.')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Jelenlegi jelszó'), 'temp-12345')
  await userEvent.type(screen.getByLabelText('Új jelszó (min. 8 karakter)'), 'uj-jelszo-2026')
  await userEvent.type(screen.getByLabelText('Új jelszó még egyszer'), 'uj-jelszo-2026')
  await userEvent.click(screen.getByRole('button', { name: 'Jelszó mentése' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
})

test('mismatched confirmation is caught client-side', async () => {
  render(<QueryWrapper><ChangePasswordPage onSuccess={() => {}} onCancel={() => {}} /></QueryWrapper>)
  await userEvent.type(screen.getByLabelText('Jelenlegi jelszó'), 'temp-12345')
  await userEvent.type(screen.getByLabelText('Új jelszó (min. 8 karakter)'), 'uj-jelszo-2026')
  await userEvent.type(screen.getByLabelText('Új jelszó még egyszer'), 'mas')
  await userEvent.click(screen.getByRole('button', { name: 'Jelszó mentése' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('A két új jelszó nem egyezik.')
})

test('wrong current password shows the server error', async () => {
  server.use(http.post(`${API_BASE}/api/auth/change-password`, () =>
    HttpResponse.json([{ code: 'AUTH_LOGIN_INVALID_CREDENTIALS', message: 'x' }], { status: 401 })))
  render(<QueryWrapper><ChangePasswordPage forced onSuccess={() => {}} /></QueryWrapper>)
  await userEvent.type(screen.getByLabelText('Jelenlegi jelszó'), 'rossz')
  await userEvent.type(screen.getByLabelText('Új jelszó (min. 8 karakter)'), 'uj-jelszo-2026')
  await userEvent.type(screen.getByLabelText('Új jelszó még egyszer'), 'uj-jelszo-2026')
  await userEvent.click(screen.getByRole('button', { name: 'Jelszó mentése' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Hibás e-mail vagy jelszó.')
})
