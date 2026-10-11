// ============================================================
// Mezo · MesoTemplatesPage tests — „Sablonjaid" in the Folyadék look (mezo-n4wf5.3; the
// behaviour is Train Titanium T10 Task 3's, mezo-88iwa.11).
//
// A template is one block in the list card that OPENS the template's own page; the start
// sheet + lifecycle pair live there (MesoTemplateStoryPage.test.tsx carries their tests).
// What is asserted here: the hero's real counts, the block's week capsules / facts / muscles /
// story line, the block tap's destination, the create button, the empty state and the skeleton.
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
    expect(screen.getByText('Sablonjaid')).toHaveClass('fo-hero-lbl')
    expect(screen.getByText('2 sablonból indíthatsz.')).toHaveClass('fo-hero-verdict')
    expect(screen.getByText(/Egy sablon a recept/)).toBeInTheDocument()
    // the big tilted template glyph of the hero
    expect(document.querySelector('.fo-hero .fo-hero-art use')!.getAttribute('href')).toBe('#t-template')
    // The fixture shelf: 2 templates, 1 run ever started out of them.
    expect(screen.getByText('2 sablon')).toBeInTheDocument()
    // 2 + 0: the PPL template's runCount covers both the active meso-hyp-04 and the closed
    // meso-hyp-03 that carries its templateId — the same 2 the story page derives.
    expect(screen.getByText('2 futam indult belőlük')).toBeInTheDocument()
  })

  test('the page\'s own back control (drawn where no title bar is mounted) leads to the library landing', async () => {
    const user = userEvent.setup()
    setup()
    const back = screen.getByRole('button', { name: 'Vissza' })
    expect(back).toHaveClass('fo-backpill')
    expect(back).toHaveTextContent('‹ Edzéstervek')
    await user.click(back)
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/konyvtar')
  })

  test('each template is one block: name, split, the week capsules, the facts, the muscles and one story line', () => {
    setup()
    const card = screen.getByRole('button', { name: /Sablon · Upper\/Lower Power/ })
    // name + split head (the „×/hét" tail is already said by the nap-hetente fact)
    expect(card).toHaveTextContent('Upper/Lower Power')
    expect(card).toHaveTextContent('Upper / Lower')
    // 5 weeks, 4 training days (Sze/Szo/Vas are rest), a calibrated minutes fact
    expect(card).toHaveClass('er-tpl')
    expect(card.querySelector('.fo-facts')).toHaveTextContent('5hét')
    expect(card.querySelector('.fo-facts')).toHaveTextContent('4nap hetente')
    expect(card.querySelector('.fo-facts')?.textContent).toMatch(/~\d+perc/)
    // the week as seven capsules: the four training days full, Sze / Szo / Vas empty
    const caps = [...card.querySelectorAll('.fo-caps i')]
    expect(caps.map((c) => c.textContent)).toEqual(['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'])
    expect(caps.map((c) => c.classList.contains('f'))).toEqual([true, true, false, true, true, false, false])
    // the muscles as overlapping anatomy chips, at most four (never emoji)
    expect(card.querySelectorAll('.ex-stk .ex-mchp')).toHaveLength(4)
    expect(card.querySelector('.er-tpl-use')).toHaveTextContent('Még nem indítottál belőle')
  })

  test('the story line reads the RUNS, not the template: the active run names its own recipe', () => {
    setup()
    // meso-hyp-04 (active) carries templateId a10e… → that template is the one running now.
    const card = screen.getByRole('button', { name: /Sablon · Hypertrophy 04 · Tavasz/ })
    expect(card.querySelector('.er-tpl-use')).toHaveTextContent('Ebből fut a mostani terved')
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

  test('folyadék: hero → 1 „Sablonok · egy kapszula egy nap", every block in ONE white card, no old skin', () => {
    const { container } = setup()
    expect([...container.querySelectorAll('.fo-sec')].map((h) => h.textContent)).toEqual(['1Sablonok · egy kapszula egy nap'])
    const blocks = [...container.querySelectorAll('.er-tpl')]
    expect(blocks).toHaveLength(2)
    expect(new Set(blocks.map((b) => b.closest('.fo-card'))).size).toBe(1)
    expect(screen.getByText('Sablonból indulsz, vagy nulláról építed')).toBeInTheDocument()
    expect(container.querySelector('.glass, [class*="pl-l"], [class*="pl-d"], .mz-play, .mz-backbtn')).toBeNull()
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
    expect(await screen.findByText('Még nincs sablonod.')).toHaveClass('fo-hero-verdict')
    expect(screen.getByText('Még nincs sablonod — az elsőt fent állíthatod össze.')).toBeInTheDocument()
    expect(screen.getByText('0 sablon')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Új terv összeállítása' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/new')
  })
})
