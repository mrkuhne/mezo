import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { KimeloCard, KimeloEntry, KimeloSlot } from '@/features/today/components/KimeloCard'
import { RECOVERY_QUERY_KEY } from '@/data/train/recoveryHooks'
import { mockCheckIn, mockOpen, recoveryEmpty } from '@/data/train/recoveryMock'
import type { RecoveryPeriod, RecoveryState } from '@/data/train/recoveryApi'
import { addDays, localDateString } from '@/shared/lib/dates'

const today = () => localDateString()
/** The card's sub-line as one normalized string (the estimate sits in its own nowrap span). */
const subLine = () => document.querySelector('.nm-km .fo-hero-sub')?.textContent?.replace(/\s+/g, ' ')

function openState(category: RecoveryPeriod['category'], estimate: 'TODAY' | 'FEW_DAYS' | 'WEEK' | 'UNKNOWN', daysBack: number): RecoveryState {
  return mockOpen(recoveryEmpty, { category, estimate, startDate: addDays(today(), -daysBack) })
}

function renderSlot(state: RecoveryState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData([...RECOVERY_QUERY_KEY, today()], state)
  const r = render(
    <QueryClientProvider client={client}>
      <ToastProvider><KimeloSlot /><KimeloEntry /></ToastProvider>
    </QueryClientProvider>,
  )
  const cache = () => client.getQueryData<RecoveryState>([...RECOVERY_QUERY_KEY, today()])
  return { ...r, client, cache }
}

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

describe('KimeloSlot — no open period', () => {
  it('shows the quiet „Nem vagyok jól" row that opens „Mi történt?"', async () => {
    renderSlot(recoveryEmpty)
    expect(screen.queryByText('Hogy vagy?')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nem vagyok jól' }))
    expect(await screen.findByRole('heading', { name: 'Mi történt?' })).toBeInTheDocument()
  })
})

describe('KimeloCard — the open period (mock mode)', () => {
  it('fresh: category icon + eyebrow, Hogy vagy?, the day and the estimate, Még nem / Jobban / Tévedés volt', () => {
    const { container } = renderSlot(openState('ILLNESS', 'FEW_DAYS', 1))
    const card = container.querySelector('.nm-km') as HTMLElement
    // the one hero of the state: a warn vessel, the category's glyph in its chip, no glass
    expect(card).toHaveClass('fo-hero', 'warn')
    expect(card.querySelector('.glass')).toBeNull()
    expect(card.querySelector('.fo-hero-left .fo-bub use')?.getAttribute('href')).toBe('#t-ill')
    expect(within(card).getByText('Kímélő mód · Beteg vagyok')).toBeInTheDocument()
    expect(within(card).getByText('Hogy vagy?')).toBeInTheDocument()
    expect(subLine()).toBe('2. nap · becslés: 2–3 nap')
    expect(card.querySelector('.nm-nw')?.textContent).toBe('2–3\u00a0nap')
    expect(within(card).getByRole('button', { name: 'Még nem' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Jobban' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Tévedés volt' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nem vagyok jól' })).not.toBeInTheDocument()
  })

  it('expired estimate: the question replaces the day line', () => {
    const { container } = renderSlot(openState('STOMACH', 'FEW_DAYS', 3))
    const card = container.querySelector('.nm-km') as HTMLElement
    expect(within(card).getByText('Kímélő mód · Gyomorrontás')).toBeInTheDocument()
    expect(within(card).getByText('A becsült idő letelt — hogy vagy?')).toBeInTheDocument()
    expect(subLine()).toBe('A becsült idő letelt — hogy vagy?')
  })

  it('an unknown estimate reads „becslés: nincs"', () => {
    renderSlot(openState('TRAVEL', 'UNKNOWN', 0))
    expect(subLine()).toBe('1. nap · becslés: nincs')
  })

  it('Még nem → toast, and the card becomes the slim row with Befejezem', async () => {
    const { container, cache } = renderSlot(openState('ILLNESS', 'FEW_DAYS', 1))
    fireEvent.click(screen.getByRole('button', { name: 'Még nem' }))
    expect(await screen.findByText('Rendben, holnap reggel újra rákérdezek')).toBeInTheDocument()
    const slim = await waitFor(() => container.querySelector('.nm-kmslim') as HTMLElement)
    expect(slim).toBeTruthy()
    expect(within(slim).getByText('Kímélő mód · 2. nap')).toBeInTheDocument()
    expect(within(slim).getByText('Holnap reggel újra rákérdezek, hogy vagy.')).toBeInTheDocument()
    expect(container.querySelector('.nm-km')).toBeNull()
    expect(cache()?.period?.checkedInToday).toBe(true)
  })

  it('checked in today: the slim line straight away', () => {
    const state = mockCheckIn(openState('INJURY', 'WEEK', 2), 'NOT_YET')
    const { container } = renderSlot(state)
    expect(within(container.querySelector('.nm-kmslim') as HTMLElement).getByText('Kímélő mód · 3. nap')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Befejezem' })).toBeInTheDocument()
  })

  it('Tévedés volt → the in-card confirm; Mégse goes back, Törlöm discards with a toast', async () => {
    const { cache } = renderSlot(openState('ILLNESS', 'FEW_DAYS', 1))
    fireEvent.click(screen.getByRole('button', { name: 'Tévedés volt' }))
    const ask = screen.getByRole('group', { name: 'Töröljem a kímélő módot?' })
    expect(within(ask).getByText('A kihagyott edzések visszaállnak, mintha be se kapcsoltad volna.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Jobban' })).not.toBeInTheDocument()
    fireEvent.click(within(ask).getByRole('button', { name: 'Mégse' }))
    expect(screen.getByRole('button', { name: 'Jobban' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tévedés volt' }))
    fireEvent.click(screen.getByRole('button', { name: 'Törlöm' }))
    expect(await screen.findByText('Kímélő mód törölve · az edzéseid visszaálltak')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nem vagyok jól' })).toBeInTheDocument())
    expect(cache()?.period).toBeNull()
  })

  it('Jobban on day 1 discards (no same-day return): „Kímélő mód befejezve", no Üdv újra!', async () => {
    const { cache } = renderSlot(openState('ILLNESS', 'TODAY', 0))
    fireEvent.click(screen.getByRole('button', { name: 'Jobban' }))
    expect(await screen.findByText('Kímélő mód befejezve')).toBeInTheDocument()
    expect(screen.queryByText('Üdv újra!')).not.toBeInTheDocument()
    expect(cache()?.period).toBeNull()
  })

  it('Jobban later → BETTER → Üdv újra! (no run line) → Rendben toasts „Jó, hogy jobban vagy"', async () => {
    const { cache } = renderSlot(openState('ILLNESS', 'FEW_DAYS', 2))
    fireEvent.click(screen.getByRole('button', { name: 'Jobban' }))
    expect(await screen.findByRole('heading', { name: 'Üdv újra!' })).toBeInTheDocument()
    expect(cache()?.period?.endedOn).toBe(today())
    expect(document.querySelectorAll('.trm-udvl .trm-whynote')).toHaveLength(2)
    expect(document.querySelector('.trm-udvl .trm-whynote')?.textContent).toBe('2 nap kiesés · a program megy tovább a naptár szerint.')
    // the card is gone behind the sheet; the entry pill is back
    expect(screen.getByRole('button', { name: 'Nem vagyok jól' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Rendben/ }))
    expect(await screen.findByText('Jó, hogy jobban vagy')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Üdv újra!')).not.toBeInTheDocument())
  })

  it('Üdv újra! → Mégsem vagyok jól reopens the period (already answered today → the slim line, like the server)', async () => {
    const { cache } = renderSlot(openState('STOMACH', 'WEEK', 3))
    fireEvent.click(screen.getByRole('button', { name: 'Jobban' }))
    const sheet = (await screen.findByRole('heading', { name: 'Üdv újra!' })).closest('.sheet') as HTMLElement
    fireEvent.click(within(sheet).getByRole('button', { name: 'Mégsem vagyok jól' }))
    expect(await screen.findByText('Rendben, a kímélő mód folytatódik')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Üdv újra!')).not.toBeInTheDocument())
    expect(cache()?.period?.endedOn).toBeNull()
    expect(screen.getByText('Kímélő mód · 4. nap')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Befejezem' })).toBeInTheDocument()
  })

  it('Befejezem › on the slim line is Jobban', async () => {
    renderSlot(mockCheckIn(openState('ILLNESS', 'FEW_DAYS', 2), 'NOT_YET'))
    fireEvent.click(screen.getByRole('button', { name: 'Befejezem' }))
    expect(await screen.findByRole('heading', { name: 'Üdv újra!' })).toBeInTheDocument()
  })
})

describe('KimeloCard — presentational', () => {
  const period = openState('ILLNESS', 'FEW_DAYS', 1).period!
  it('busy disables every action', () => {
    render(<KimeloCard period={period} busy onNotYet={vi.fn()} onBetter={vi.fn()} onDiscard={vi.fn()} />)
    for (const name of ['Még nem', 'Jobban', 'Tévedés volt']) expect(screen.getByRole('button', { name })).toBeDisabled()
  })
})

describe('KimeloSlot — real mode', () => {
  it('renders nothing while loading, then the card; a failed Még nem leaves the card as it was', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const state = openState('ILLNESS', 'FEW_DAYS', 1)
    server.use(
      http.get(`${API_BASE}/api/train/recovery`, () => HttpResponse.json(state)),
      http.post(`${API_BASE}/api/train/recovery/check-in`, () => HttpResponse.json({ messages: [] }, { status: 500 })),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={client}><ToastProvider><KimeloSlot /><KimeloEntry /></ToastProvider></QueryClientProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Nem vagyok jól' })).not.toBeInTheDocument()
    const notYet = await screen.findByRole('button', { name: 'Még nem' })
    fireEvent.click(notYet)
    await waitFor(() => expect(notYet).toBeEnabled())
    expect(container.querySelector('.nm-kmslim')).toBeNull()
    expect(screen.getByText('Hogy vagy?')).toBeInTheDocument()
    expect(screen.queryByText('Rendben, holnap reggel újra rákérdezek')).not.toBeInTheDocument()
  })

  it('a failed recovery read renders nothing — no „Nem vagyok jól" over an unknown state', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let got = false
    server.use(http.get(`${API_BASE}/api/train/recovery`, () => { got = true; return HttpResponse.json({ messages: [] }, { status: 500 }) }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={client}><ToastProvider><KimeloSlot /><KimeloEntry /></ToastProvider></QueryClientProvider>,
    )
    await waitFor(() => expect(got).toBe(true))
    await waitFor(() => expect(client.getQueryState([...RECOVERY_QUERY_KEY, today()])?.status).toBe('error'))
    expect(screen.queryByRole('button', { name: 'Nem vagyok jól' })).not.toBeInTheDocument()
    expect(container.querySelector('.nm-km, .nm-kmslim')).toBeNull()
  })

  it('no period: the meso list is never fetched (the „Üdv újra!" week is read only while a period exists)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let mesoCalls = 0
    server.use(
      http.get(`${API_BASE}/api/train/recovery`, () => HttpResponse.json(recoveryEmpty)),
      http.get(`${API_BASE}/api/train/mesocycles`, () => { mesoCalls += 1; return HttpResponse.json([]) }),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><ToastProvider><KimeloSlot /><KimeloEntry /></ToastProvider></QueryClientProvider>)
    expect(await screen.findByRole('button', { name: 'Nem vagyok jól' })).toBeInTheDocument()
    expect(mesoCalls).toBe(0)
  })

  it('an open period: the meso list is fetched for the week clause', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let mesoCalls = 0
    server.use(
      http.get(`${API_BASE}/api/train/recovery`, () => HttpResponse.json(openState('ILLNESS', 'FEW_DAYS', 1))),
      http.get(`${API_BASE}/api/train/mesocycles`, () => { mesoCalls += 1; return HttpResponse.json([]) }),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><ToastProvider><KimeloSlot /><KimeloEntry /></ToastProvider></QueryClientProvider>)
    expect(await screen.findByText('Hogy vagy?')).toBeInTheDocument()
    await waitFor(() => expect(mesoCalls).toBe(1))
  })
})
