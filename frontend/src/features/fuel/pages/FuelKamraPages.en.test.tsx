import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { QueryWrapper } from '@/test/queryWrapper'
import { ingredients } from '@/data/fuel/pantry'
import { FuelKonyhaPage } from '@/features/fuel/pages/FuelKonyhaPage'
import { FuelKamraPage } from '@/features/fuel/pages/FuelKamraPage'
import { KamraItemDetailPage } from '@/features/fuel/pages/KamraItemDetailPage'

// Konyha + Kamra (area G) in English: the approved prototype's `L(hu, en)` pairs, verbatim
// (docs/design_2.0/prototypes/vilagos/fuel.js `konyha()`, `kamra()`, `kamraItem()`, `sheetsC`). Mock mode, so no fetch.
// What the user typed or stored (item / recipe / brand names, the dose, the protocol text) is never translated.
beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'true'); setLang('en', { persist: false }) })
afterEach(() => { vi.unstubAllEnvs(); setLang('hu', { persist: false }) })

const mount = (ui: React.ReactElement, route: string, path = route) =>
  render(<QueryWrapper><MemoryRouter initialEntries={[route]}><Routes><Route path={path} element={ui} /><Route path="*" element={null} /></Routes></MemoryRouter></QueryWrapper>)

describe('Konyha + Kamra in English', () => {
  it('Konyha hub: the empty pot invites to the workshop; counts and both doors', () => {
    const { container } = mount(<FuelKonyhaPage />, '/fuel/konyha')
    const hero = container.querySelector('.fo-hero') as HTMLElement
    expect(hero).toHaveTextContent('Recipe workshop · empty pot')
    expect(hero).toHaveTextContent('Let’s cook up a meal.')
    expect(hero).toHaveTextContent(/The numbers come from your pantry: \d+ items on your shelf\./)
    expect(within(hero).getByRole('button', { name: 'Open the workshop' })).toBeInTheDocument()
    expect(hero.querySelector('.fp-goals')).toHaveTextContent('High proteinBefore trainingAfter trainingBefore bedBreakfast')
    expect(screen.getByRole('heading', { name: /Quick add$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save a recipe/ })).toHaveTextContent('by hand, in your own words')
    expect(screen.getByRole('button', { name: /New pantry item/ })).toHaveTextContent('a photo of the label or a product link')
    expect(screen.getByRole('button', { name: /^\d+ recipes/ })).toHaveTextContent(/your favourite right now: .+ · eaten \d+ times/)
    expect(screen.getByRole('button', { name: /items on the shelf/ })).toHaveTextContent('what we cook and count from')
    expect(container.querySelector('.fp-shelfsplit .fx-leg')!.textContent).toMatch(/^Food\d+Supplements\d+$/)
  })

  it('Konyha hub: the text follows a language change at runtime, on the same node', () => {
    setLang('hu', { persist: false })
    const { container } = mount(<FuelKonyhaPage />, '/fuel/konyha')
    const verdict = container.querySelector('.fo-hero-verdict')!
    expect(verdict).toHaveTextContent('Főzzünk ki valamit.')
    act(() => setLang('en', { persist: false }))
    expect(container.querySelector('.fo-hero-verdict')).toBe(verdict)
    expect(verdict).toHaveTextContent('Let’s cook up a meal.')
    expect(screen.getByRole('heading', { name: /Pantry$/ })).toBeInTheDocument()
  })

  it('Kamra: hero, kind pills (Supps / Stims / Meds), tiles, the swap card', () => {
    const { container } = mount(<FuelKamraPage />, '/fuel/kamra')
    const hero = container.querySelector('.fo-hero') as HTMLElement
    expect(hero).toHaveTextContent('Your shelf · by kind')
    expect(hero).toHaveTextContent(/\d+ items on your shelf: \d+ foods and \d+ supplements\./)
    expect(within(hero).getByRole('button', { name: '+ New item' })).toBeInTheDocument()
    expect(within(hero).getByRole('button', { name: 'Shared catalogue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Kitchen' })).toHaveTextContent('‹ Kitchen')
    expect(screen.getByLabelText('Search the pantry')).toHaveAttribute('placeholder', 'Search items or brands…')
    for (const name of [/^All\d+$/, /^Food\d+$/, /^Supps\d+$/, /^Stims\d+$/, /^Meds\d+$/]) expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filters · by category' })).toBeInTheDocument()
    const chicken = [...container.querySelectorAll('.fp-shelf button.fo-stat')].find(b => /Csirkemell/.test(b.textContent ?? ''))!
    expect(chicken).toHaveTextContent('Csirkemell') // the stored name is not translated
    expect(chicken).toHaveTextContent(/23 g protein · .+ · catalogue/)
    expect(screen.getByText(/For foods, the tile’s level is protein density/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /A smarter swap$/ })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/tétel|polc|Szűr|fehérje|kiegészítő/i)
  })

  it('Kamra: the category sheet and the add sheet speak English', async () => {
    mount(<FuelKamraPage />, '/fuel/kamra')
    await userEvent.click(screen.getByRole('button', { name: 'Filters · by category' }))
    expect(await screen.findByRole('heading', { name: 'What should I show?' })).toBeInTheDocument()
    expect(screen.getByText('category filter')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Fruit\d+$/ }))
    expect(screen.getByRole('button', { name: '1 selected · clear' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Filter · \d+ items?$/ }))
    expect(await screen.findByRole('button', { name: 'Filters · 1 category' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove the Fruit filter' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '+ New item' }))
    expect(await screen.findByRole('heading', { name: 'New pantry item' })).toBeInTheDocument()
    expect(screen.getByText('by hand')).toBeInTheDocument()
    expect(screen.getByLabelText('Type')).toHaveDisplayValue('Food')
    expect(screen.getByLabelText('Source')).toHaveDisplayValue('Own entry')
    expect(screen.getByText('Macros · per 100 g')).toBeInTheDocument()
    expect(screen.getByLabelText('Sat. fat')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to shelf' })).toBeDisabled()
    expect(screen.getByText('You can add it once it has a name.')).toBeInTheDocument()
  })

  it('Kamra item: verdict, bar, quality rows, source with the client-formatted date, recipes', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(['pantry'], {
      ingredients: [{ ...ingredients[0], scrapedAt: '2026-05-20T09:14:00', sharedFrom: { authorName: 'Anna' }, catalogEditable: false }],
      stash: [], imports: [], suggestions: [],
    })
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/fuel/kamra/${ingredients[0].id}`]}><Routes><Route path="/fuel/kamra/:id" element={<KamraItemDetailPage />} /></Routes></MemoryRouter>
      </QueryClientProvider>,
    )
    const hero = container.querySelector('.fo-hero') as HTMLElement
    expect(hero).toHaveTextContent('23 g of protein in every 100 g.')
    expect(within(hero).getByText('What’s in 100 g?')).toBeInTheDocument()
    expect(hero.querySelector('.fx-leg')).toHaveTextContent('The rest (water, fibre…)75.5 g')
    expect(within(hero).getByRole('button', { name: 'Log it · into today’s meal' })).toBeInTheDocument()
    expect(within(hero).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(within(hero).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Macros$/ })).toBeInTheDocument()
    const quality = screen.getByRole('heading', { name: /Quality · per 100 g$/ }).nextElementSibling as HTMLElement
    for (const t of ['Sugar', 'Salt', 'Saturated fat', 'Processing']) expect(within(quality).getByText(t)).toBeInTheDocument()
    const src = screen.getByRole('region', { name: 'Source' })
    expect(within(src).getByText('On your shelf')).toBeInTheDocument()
    expect(within(src).getByText('How it got here: catalogue')).toBeInTheDocument()
    expect(within(src).getByText(/· 20 May · 09:14$/)).toBeInTheDocument()
    expect(within(src).getByText('shared · Anna')).toBeInTheDocument()
    expect(within(src).getByText('Price')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Used in recipes$/ })).toBeInTheDocument()
    expect(screen.getByText(/· eaten \d+ times$/)).toBeInTheDocument()
  })

  it('Kamra item: a supplement says one sentence per time slot; not found', () => {
    const { container, unmount } = mount(<KamraItemDetailPage />, '/fuel/kamra/ing-kreatin', '/fuel/kamra/:id')
    expect(container.querySelector('.fo-hero')).toHaveTextContent('You take it when you wake up.')
    expect(screen.getByRole('heading', { name: /In your day$/ })).toBeInTheDocument()
    expect(screen.getByText(/^among your supplements · /)).toBeInTheDocument()
    unmount()
    mount(<KamraItemDetailPage />, '/fuel/kamra/nope', '/fuel/kamra/:id')
    expect(screen.getByText('You may have taken it off the shelf. Everything you still have is in your pantry.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Back to Pantry' }).length).toBeGreaterThanOrEqual(1)
  })
})
