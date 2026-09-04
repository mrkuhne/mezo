import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { OnboardingPage } from '@/features/auth/pages/OnboardingPage'
import { localDateString } from '@/shared/lib/dates'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function captureCalls() {
  const calls: { url: string; body: unknown }[] = []
  server.use(
    http.put(`${API_BASE}/api/biometrics/profile`, async ({ request }) => {
      calls.push({ url: 'profile', body: await request.json() })
      return HttpResponse.json({ sex: 'M', heightCm: 181, birthDate: '1993-05-14', activityLevel: 'MIXED', tdeeBootstrap: null })
    }),
    http.post(`${API_BASE}/api/biometrics/weight`, async ({ request }) => {
      calls.push({ url: 'weight', body: await request.json() })
      return HttpResponse.json({ id: 'w9', date: localDateString(), value: 84.5, note: null }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/auth/onboarding-complete`, () => {
      calls.push({ url: 'complete', body: null })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

const renderPage = (onSuccess = vi.fn()) => {
  render(<QueryWrapper><OnboardingPage name="Béla" onSuccess={onSuccess} /></QueryWrapper>)
  return onSuccess
}

async function walkToSummary() {
  // step 1: sex + birth date
  await userEvent.click(screen.getByRole('button', { name: 'Férfi' }))
  await userEvent.type(screen.getByLabelText('Születési dátum'), '1993-05-14')
  await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
  // step 2: height 175→181 (+6), weight 75→84.5 (type)
  for (let i = 0; i < 6; i++) await userEvent.click(screen.getByRole('button', { name: 'Magasság növelése' }))
  const weight = screen.getByLabelText('Súly')
  await userEvent.clear(weight)
  await userEvent.type(weight, '84,5')
  await userEvent.tab()
  await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
}

test('real mode: the three steps commit profile → weight → onboarding-complete and call onSuccess', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const calls = captureCalls()
  const onSuccess = renderPage()
  expect(screen.getByRole('heading', { name: 'Első lépések' })).toBeInTheDocument()
  expect(screen.getByText('Szia, Béla!')).toBeInTheDocument()
  await walkToSummary()
  expect(screen.getByText('Magasság: 181 cm')).toBeInTheDocument()
  expect(screen.getByText('Súly: 84,5 kg')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Kezdjük' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  expect(calls.map((c) => c.url)).toEqual(['profile', 'weight', 'complete'])
  expect(calls[0].body).toEqual({ sex: 'M', heightCm: 181, birthDate: '1993-05-14', activityLevel: 'MIXED' })
  expect(calls[1].body).toEqual({ date: localDateString(), weightKg: 84.5 })
})

test('Tovább stays disabled until a valid birth date is picked', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderPage()
  expect(screen.getByRole('button', { name: 'Tovább' })).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Születési dátum'), '1993-05-14')
  expect(screen.getByRole('button', { name: 'Tovább' })).toBeEnabled()
})

test('typed values clamp to the contract bounds on blur', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderPage()
  await userEvent.type(screen.getByLabelText('Születési dátum'), '1993-05-14')
  await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
  const height = screen.getByLabelText('Magasság')
  await userEvent.clear(height)
  await userEvent.type(height, '999')
  await userEvent.tab()
  await waitFor(() => expect(height).toHaveValue('260'))
  const weight = screen.getByLabelText('Súly')
  await userEvent.clear(weight)
  await userEvent.type(weight, '0')
  await userEvent.tab()
  await waitFor(() => expect(weight).toHaveValue('1'))
})

test('a server error on commit stays inline and keeps the summary', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  captureCalls()
  server.use(http.put(`${API_BASE}/api/biometrics/profile`, () => HttpResponse.error()))
  const onSuccess = renderPage()
  await walkToSummary()
  await userEvent.click(screen.getByRole('button', { name: 'Kezdjük' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült kapcsolódni. Próbáld újra.')
  expect(onSuccess).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Kezdjük' })).toBeEnabled()
})

test('mock mode: the wizard completes without the network', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const calls = captureCalls()
  const onSuccess = renderPage()
  await walkToSummary()
  await userEvent.click(screen.getByRole('button', { name: 'Kezdjük' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  expect(calls).toEqual([])
})
