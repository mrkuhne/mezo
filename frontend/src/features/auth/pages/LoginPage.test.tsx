import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { LoginPage } from '@/features/auth/pages/LoginPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

test('submits email + password and calls onSuccess', async () => {
  const onSuccess = vi.fn()
  render(<QueryWrapper><LoginPage onSuccess={onSuccess} onRegister={() => {}} /></QueryWrapper>)
  await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.c')
  await userEvent.type(screen.getByLabelText('Jelszó'), 'titkos-1')
  await userEvent.click(screen.getByRole('button', { name: 'Belépés' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
})

test('shows the credential error inline on 401', async () => {
  server.use(http.post(`${API_BASE}/api/auth/login`, () =>
    HttpResponse.json([{ code: 'AUTH_LOGIN_INVALID_CREDENTIALS', message: 'x' }], { status: 401 })))
  render(<QueryWrapper><LoginPage onSuccess={() => {}} onRegister={() => {}} /></QueryWrapper>)
  await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.c')
  await userEvent.type(screen.getByLabelText('Jelszó'), 'rossz')
  await userEvent.click(screen.getByRole('button', { name: 'Belépés' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Hibás e-mail vagy jelszó.')
})

test('renders the notice and the register link', async () => {
  const onRegister = vi.fn()
  render(<QueryWrapper><LoginPage notice="A munkameneted lejárt, jelentkezz be újra." onSuccess={() => {}} onRegister={onRegister} /></QueryWrapper>)
  expect(screen.getByText('A munkameneted lejárt, jelentkezz be újra.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Van meghívó kódod?' }))
  expect(onRegister).toHaveBeenCalled()
})
