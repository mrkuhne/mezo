// ============================================================
// Mezo · MesoTemplatesPage tests — the Titanium „Sablonjaid" list
// (Train Titanium T10 Task 3, mezo-88iwa.11).
//
// Rewritten from the DS-era suite: the page-header + „+ Új" chip, the shelf StatStrip and
// the whole `MesoTemplateCard` poster (its arc/spine/chips, the ⋯ lifecycle menu with
// Duplikálás + the two-tap Törlés, and the card-foot „Indítás") are no longer this page's
// — a card is now one `.pl-lib-card` that OPENS the template's own page, and the start
// sheet + lifecycle pair live there (MesoTemplateStoryPage.test.tsx carries their tests).
// What is asserted here: the hero's real counts, the card's facts/muscles/story line, the
// card tap's destination, the create CTA, the empty state and the skeleton.
// ============================================================
import { render, screen } from '@testing-library/react'
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
  return render(
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

  test('the hero names the page, says what a sablon is, and counts the real shelf', () => {
    setup()
    expect(screen.getByText('Sablonjaid')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Amiből indíthatsz' })).toBeInTheDocument()
    expect(screen.getByText(/Egy sablon a recept/)).toBeInTheDocument()
    // The fixture shelf: 2 templates, 1 run ever started out of them.
    expect(screen.getByText('2 sablon')).toBeInTheDocument()
    expect(screen.getByText('1 futam indult belőlük')).toBeInTheDocument()
  })

  test('the back pill is docked INSIDE the hero and leads to the library landing', async () => {
    const user = userEvent.setup()
    const { container } = setup()
    const back = screen.getByRole('button', { name: 'Vissza' })
    expect(back).toHaveClass('mz-backbtn')
    // The docking CSS keys on `.pl-lhero > .mz-backbtn` — assert the PARENT, not the class.
    expect(back.parentElement).toBe(container.querySelector('.pl-lhero'))
    await user.click(back)
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/konyvtar')
  })

  test('each template is one card: name, split, the facts, the muscles and one story line', () => {
    setup()
    const card = screen.getByRole('button', { name: /Sablon · Upper\/Lower Power/ })
    // name + split head (the „×/hét" tail is already said by the nap-hetente fact)
    expect(card).toHaveTextContent('Upper/Lower Power')
    expect(card).toHaveTextContent('Upper / Lower')
    // 5 weeks, 4 training days (Sze/Szo/Vas are rest), a calibrated minutes fact
    expect(card.querySelector('.pl-day-facts')).toHaveTextContent('5hét')
    expect(card.querySelector('.pl-day-facts')).toHaveTextContent('4nap hetente')
    expect(card.querySelector('.pl-day-facts')?.textContent).toMatch(/~\d+perc/)
    // the muscles as anatomy chips, one per worked group (never emoji)
    expect(card.querySelectorAll('.pl-lib-mus i').length).toBeGreaterThan(3)
    expect(card.querySelector('.pl-lib-note')).toHaveTextContent('Még nem indítottál belőle')
  })

  test('the story line reads the RUNS, not the template: the active run names its own recipe', () => {
    setup()
    // meso-hyp-04 (active) carries templateId a10e… → that template is the one running now.
    const card = screen.getByRole('button', { name: /Sablon · Hypertrophy 04 · Tavasz/ })
    expect(card.querySelector('.pl-lib-note')).toHaveTextContent('Ebből fut a mostani terved')
  })

  test('a card tap opens that template\'s own page, not the raw editor', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /Sablon · Hypertrophy 04 · Tavasz/ }))
    expect(screen.getByTestId('loc')).toHaveTextContent(
      '/train/templates/a10e0000-0000-4000-8000-000000000000',
    )
  })

  test('the one loud CTA is the create door — the planner', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Új terv összeállítása' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/new')
  })

  test('no destructive action lives on the list any more', () => {
    setup()
    expect(screen.queryByRole('button', { name: /Törlés/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'További műveletek' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Indítás/ })).toBeNull()
  })

  test('the list staggers inside an armed entrance group', () => {
    setup()
    const play = document.body.querySelector('.mz-play')
    expect(play).not.toBeNull()
    const risen = [...play!.querySelectorAll('.rise')] as HTMLElement[]
    expect(risen.length).toBeGreaterThan(1)
    expect(risen[0].style.getPropertyValue('--d')).toBe('40ms')
    expect(risen[1].style.getPropertyValue('--d')).toBe('90ms')
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

  it('says so plainly when there is no template at all, and still offers the planner', async () => {
    server.use(http.get(`${API_BASE}/api/train/meso-templates`, () => HttpResponse.json([])))
    const user = userEvent.setup()
    setup()
    expect(await screen.findByText(/Még nincs sablonod/)).toBeInTheDocument()
    expect(screen.getByText('0 sablon')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Új terv összeállítása' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/new')
  })
})
