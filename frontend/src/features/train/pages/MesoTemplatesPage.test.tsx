import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MesoTemplatesPage } from '@/features/train/pages/MesoTemplatesPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="loc">{pathname}</div>
}

function setup() {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <MesoTemplatesPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

describe('MesoTemplatesPage (mock mode · the two fixture templates)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('own DS head + the counted section over the fixture templates', () => {
    setup()
    expect(screen.getByText('Edzés · Sablonok')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Sablonok' })).toBeInTheDocument()
    expect(screen.getByText(/Sablonok · 2/)).toBeInTheDocument()
    expect(screen.getByText('Upper/Lower Power')).toBeInTheDocument()
    expect(screen.getByText('Hypertrophy 04 · Tavasz')).toBeInTheDocument()
    expect(screen.getByText('1× futtatva')).toBeInTheDocument()
    expect(screen.getByText('0× futtatva')).toBeInTheDocument()
  })

  test('the header + Új chip opens the planner', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Új' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/new')
  })

  test('the fixture templates carry the band-vocabulary chips (mezo-d20.15 Task 5)', () => {
    setup()
    // Neither mock fixture template was stamped with the wizard v2 goalPreset — both read
    // as legacy (régi modell), predating the current band model.
    expect(screen.getAllByText('régi modell')).toHaveLength(2)
    expect(screen.getAllByText('indításkor az új modellre konvertálódik')).toHaveLength(2)
    // Upper/Lower Power (b20f0000): 4 training days, Emphasize on back
    expect(screen.getByText('4 nap · Upper / Lower')).toBeInTheDocument()
    expect(screen.getByText('★ Hát')).toBeInTheDocument()
    expect(screen.getByText('4 + 1 deload')).toBeInTheDocument()
    // Hypertrophy 04 · Tavasz (a10e0000): 5 training days, no priorities set
    expect(screen.getByText('5 nap · Upper / Lower / Push / Pull / Legs')).toBeInTheDocument()
    expect(screen.getByText('5 + 1 deload')).toBeInTheDocument()
  })

  test('every card carries the four template actions', () => {
    setup()
    expect(screen.getAllByRole('button', { name: /Szerkesztés/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /Indítás/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /Duplikálás/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /Törlés/ })).toHaveLength(2)
  })

  test('Szerkesztés opens that template in the editor', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getAllByRole('button', { name: /Szerkesztés/ })[0])
    expect(screen.getByTestId('loc')).toHaveTextContent(
      '/train/mesocycles/templates/a10e0000-0000-4000-8000-000000000000',
    )
  })

  test('Indítás opens the shared start sheet', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getAllByRole('button', { name: /Indítás/ })[0])
    expect(await screen.findByRole('heading', { name: 'Mikor kezdjük?' })).toBeInTheDocument()
  })

  test('Duplikálás copies the template under a (másolat) title and opens the copy', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getAllByRole('button', { name: /Duplikálás/ })[1])

    expect(await screen.findByText('Upper/Lower Power (másolat)')).toBeInTheDocument()
    // a copy has never been run
    expect(screen.getAllByText('0× futtatva')).toHaveLength(2)
    expect(screen.getByText(/Sablonok · 3/)).toBeInTheDocument()
    // …and we land in its editor
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toMatch(/^\/train\/mesocycles\/templates\/.+/),
    )
    expect(screen.getByTestId('loc').textContent).not.toContain('b20f0000-0000-4000-8000-000000000000')
  })

  test('Törlés is a two-tap confirm — the first tap only arms it', async () => {
    const user = userEvent.setup()
    setup()
    const del = screen.getAllByRole('button', { name: /Törlés/ })[1]
    await user.click(del)

    // armed, nothing deleted yet
    expect(screen.getByRole('button', { name: /Biztos\? Törlés/ })).toBeInTheDocument()
    expect(screen.getByText('Upper/Lower Power')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Biztos\? Törlés/ }))
    await waitFor(() => expect(screen.queryByText('Upper/Lower Power')).toBeNull())
    expect(screen.getByText(/Sablonok · 1/)).toBeInTheDocument()
  })
})

describe('MesoTemplatesPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('shows a skeleton while the template list is unresolved', async () => {
    server.use(http.get(`${API_BASE}/api/train/meso-templates`, () => new Promise(() => {})))
    setup()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('offers the dashed planner CTA when there is no template at all', async () => {
    server.use(http.get(`${API_BASE}/api/train/meso-templates`, () => HttpResponse.json([])))
    const user = userEvent.setup()
    setup()
    expect(await screen.findByText(/Még nincs sablonod/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Új sablon tervezése/ }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/new')
  })
})

// Motion (mezo-d20.11): the page had NO entrance choreography at all — no
// EntranceGroup, no `.rise`. The face stays as-is (the prototype draws no
// standalone Sablonok page), but the list now staggers like every other one.
test('the template list staggers inside an armed entrance group', async () => {
  setup()
  await screen.findByText(/Sablonok · /)
  const play = document.body.querySelector('.mz-play')
  expect(play).not.toBeNull()
  const risen = [...play!.querySelectorAll('.rise')] as HTMLElement[]
  expect(risen.length).toBeGreaterThan(1)
  expect(risen[0].style.getPropertyValue('--d')).toBe('30ms')
  expect(risen[1].style.getPropertyValue('--d')).toBe('60ms')
})
