import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

async function fill() {
  await userEvent.type(screen.getByLabelText('Meghívó kód'), 'MEZO-7KQ2-XN4P')
  await userEvent.type(screen.getByLabelText('Név'), 'Béla')
  await userEvent.type(screen.getByLabelText('E-mail'), 'bela@test.local')
  await userEvent.type(screen.getByLabelText('Jelszó (min. 8 karakter)'), 'titkos-jelszo-1')
}

test('registers and calls onSuccess', async () => {
  const onSuccess = vi.fn()
  render(<QueryWrapper><RegisterPage onSuccess={onSuccess} onBack={() => {}} /></QueryWrapper>)
  await fill()
  await userEvent.click(screen.getByRole('button', { name: 'Fiók létrehozása' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
})

test('shows the invite error inline on 409', async () => {
  server.use(http.post(`${API_BASE}/api/auth/register`, () =>
    HttpResponse.json([{ code: 'AUTH_INVITE_INVALID', message: 'x' }], { status: 409 })))
  render(<QueryWrapper><RegisterPage onSuccess={() => {}} onBack={() => {}} /></QueryWrapper>)
  await fill()
  await userEvent.click(screen.getByRole('button', { name: 'Fiók létrehozása' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ez a meghívó kód nem érvényes.')
})

test('back link returns to login', async () => {
  const onBack = vi.fn()
  render(<QueryWrapper><RegisterPage onSuccess={() => {}} onBack={onBack} /></QueryWrapper>)
  await userEvent.click(screen.getByRole('button', { name: 'Vissza a belépéshez' }))
  expect(onBack).toHaveBeenCalled()
})
