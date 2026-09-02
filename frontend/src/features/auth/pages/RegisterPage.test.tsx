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

test('rejects a password under 72 characters but over 72 bytes, without ever hitting the server', async () => {
  let requested = false
  server.use(http.post(`${API_BASE}/api/auth/register`, () => {
    requested = true
    return HttpResponse.json({ token: 'test-token' })
  }))
  render(<QueryWrapper><RegisterPage onSuccess={() => {}} onBack={() => {}} /></QueryWrapper>)
  await userEvent.type(screen.getByLabelText('Meghívó kód'), 'MEZO-7KQ2-XN4P')
  await userEvent.type(screen.getByLabelText('Név'), 'Béla')
  await userEvent.type(screen.getByLabelText('E-mail'), 'bela@test.local')
  // 'á' repeated 40x = 40 characters, 80 UTF-8 bytes — the same fixture the backend ITs use.
  await userEvent.type(screen.getByLabelText('Jelszó (min. 8 karakter)'), 'á'.repeat(40))
  await userEvent.click(screen.getByRole('button', { name: 'Fiók létrehozása' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('A jelszó túl hosszú (max. 72 bájt — az ékezetes betűk többet számítanak).')
  expect(requested).toBe(false)
})

test('accepts a password at exactly 72 bytes', async () => {
  let requested = false
  server.use(http.post(`${API_BASE}/api/auth/register`, () => {
    requested = true
    return HttpResponse.json({ token: 'test-token' })
  }))
  const onSuccess = vi.fn()
  render(<QueryWrapper><RegisterPage onSuccess={onSuccess} onBack={() => {}} /></QueryWrapper>)
  await userEvent.type(screen.getByLabelText('Meghívó kód'), 'MEZO-7KQ2-XN4P')
  await userEvent.type(screen.getByLabelText('Név'), 'Béla')
  await userEvent.type(screen.getByLabelText('E-mail'), 'bela@test.local')
  await userEvent.type(screen.getByLabelText('Jelszó (min. 8 karakter)'), 'a'.repeat(72))
  await userEvent.click(screen.getByRole('button', { name: 'Fiók létrehozása' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  expect(requested).toBe(true)
})
