import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { QueryWrapper } from '@/test/queryWrapper'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { medicationFixture } from '@/test/fixtures/medication'
import { FuelStackPage } from '@/features/fuel/pages/FuelStackPage'
import { FuelStackProtocolPage } from '@/features/fuel/pages/FuelStackProtocolPage'
import { FuelStackAddPage } from '@/features/fuel/pages/FuelStackAddPage'
import { FuelMedicationPage } from '@/features/fuel/pages/FuelMedicationPage'
import { doseAdvice } from '@/features/fuel/logic/doseAdvice'

// Kiegészítők (area E) in English — the wording is the approved prototype's `L(hu, en)` pairs
// (docs/design_2.0/prototypes/vilagos/fuel.js: `stack`, `protokoll`, `stackUj`, `gyogyszer` and their sheets).
// What the user typed or what is stored stays as written: product names, dose strings, the engine's placement reason.
// Mock mode, so no fetch.
beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'true'); setLang('en', { persist: false }) })
afterEach(() => { vi.unstubAllEnvs(); setLang('hu', { persist: false }) })

const mount = (ui: React.ReactElement, route: string) =>
  render(<QueryWrapper><ToastProvider><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></ToastProvider></QueryWrapper>)

const mountMedication = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['medication'], medicationFixture)
  return render(
    <QueryClientProvider client={client}><MemoryRouter initialEntries={['/fuel/gyogyszer']}><FuelMedicationPage /></MemoryRouter></QueryClientProvider>,
  )
}

describe('Kiegészítők in English', () => {
  it('hub: hero, bands, doors — and the stored Hungarian reason stays out of the hero sentence', () => {
    mount(<FuelStackPage />, '/fuel/stack')
    expect(screen.getByText(/^What do I take today\? · \d of 8 taken$/)).toBeInTheDocument()
    const verdict = screen.getByText(/^Next: .+\.$/)
    // dose · zone, nothing after it (in Hungarian the stored reason follows)
    expect(verdict.nextElementSibling?.textContent).toMatch(/ · (Wake-up|Breakfast|Before training|After training|Lunch|Dinner|Evening|Bedtime)$/)
    expect(screen.getByRole('button', { name: 'Mark as taken' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Today’s doses by time of day: \d of 8 taken$/ })).toBeInTheDocument()
    expect(screen.getAllByText('due now')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: /Morning · \d \/ \d/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Protocol and setup$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Protocol · 8 items\s*What you take, why, and who placed it\./ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Set up a new item\s*I’ll tell you how much to take, when and why\./ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Medication\s*The medication you track and its cycle/ })).toBeInTheDocument()
    expect(screen.getByText('For information, not medical advice.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /: (mark as taken|undo)$/ })).toHaveLength(8)
  })

  it('hub: follows a language change at runtime, without a remount', () => {
    setLang('hu', { persist: false })
    mount(<FuelStackPage />, '/fuel/stack')
    const section = screen.getByRole('heading', { name: /Protokoll és beállítás$/ })
    expect(screen.getByRole('button', { name: 'Bevettem' })).toBeInTheDocument()
    act(() => setLang('en', { persist: false }))
    expect(section).toHaveTextContent('Protocol and setup')
    expect(screen.getByRole('button', { name: 'Mark as taken' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Morning · / })).toBeInTheDocument()
  })

  it('hub: the item box — placement, state, product facts with the translated form and unit', async () => {
    mount(<FuelStackPage />, '/fuel/stack')
    await userEvent.click(screen.getByRole('button', { name: 'D3 + K2 details' }))
    const box = screen.getByRole('dialog')
    expect(within(box).getByText(/ · daily$/)).toBeInTheDocument()
    expect(within(box).getByText(/^(smart placement|placed by hand|your choice|default time)$/)).toBeInTheDocument()
    expect(within(box).getByText('From this product')).toBeInTheDocument()
    expect(within(box).getByText('Daily dose')).toBeInTheDocument()
    expect(within(box).getByText('Why this way')).toBeInTheDocument()
    expect(within(box).getByText(/in your pantry$/)).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: /^(Mark as taken|Undo)$/ })).toBeInTheDocument()
  })

  it('the tick toast and its undo action are English', async () => {
    mount(<FuelStackPage />, '/fuel/stack')
    await userEvent.click(screen.getAllByRole('button', { name: /Origin PWO: mark as taken/ })[0])
    expect(await screen.findByRole('status')).toHaveTextContent('Origin PWO taken')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('protocol: hero, slots, the timing sheet', async () => {
    const { container } = mount(<FuelStackProtocolPage />, '/fuel/stack/protocol')
    expect(screen.getByText(/^Your daily order · \d time slots$/)).toBeInTheDocument()
    expect(container.querySelector('.fo-facts')).toHaveTextContent(/^8items\dtime slots\dplaced by hand$/)
    expect(screen.getByText(/^Tap an item to change its time slot and dose\. Version 3 · 86% confidence\.$/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Time slots$/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /With meals · \d/ })).toBeInTheDocument()
    expect(screen.getAllByText(/· (automatic|manual)/).length).toBeGreaterThan(0)
    expect(screen.getByRole('region', { name: 'Meal matches' })).toHaveTextContent(/Meal match · macros and micros/)
    expect(screen.getByRole('region', { name: 'Meal matches' })).toHaveTextContent(/\d+ g fat per serving · .+ is best taken with a meal that has fat\./)
    expect(screen.getByText('For information, not medical advice. If you take medication, always ask your doctor.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Kreatin monohidrát settings' }))
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByText(/^Supplements · timing/)).toBeInTheDocument()
    expect(within(sheet).getByText('Move to another time slot')).toBeInTheDocument()
    expect(within(sheet).getByLabelText('Dose')).toBeInTheDocument()
    expect(within(sheet).getByText('+ One more intake')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Remove from my supplements' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /\(it is here now\)$/ })).toBeDisabled()
  })

  it('new item: the three steps, the advice with plurals and the translated reference', async () => {
    mount(<FuelStackAddPage />, '/fuel/stack/manage/add')
    expect(screen.getByText('1. Product').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Which product are we setting up?')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search your pantry' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /From your pantry$/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Or a new product$/ })).toBeInTheDocument()
    expect(screen.getAllByText(/already among your supplements/).length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: /Type it in/ }))
    expect(screen.getByText('These are the product’s own details.')).toBeInTheDocument()
    expect(screen.getByLabelText('Form')).toHaveValue('capsule')
    await userEvent.type(screen.getByLabelText('Product name'), 'D3-vitamin')
    await userEvent.type(screen.getByLabelText('Per unit'), '1000')
    await userEvent.type(screen.getByLabelText('Units per box'), '120')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to advice' }))

    expect(screen.getByText('4 capsules a day, that is 4,000 IU.')).toBeInTheDocument()
    expect(screen.getByText(/That sits in the recommended 2,000–4,000 IU range\. The box lasts about 30 days\./)).toBeInTheDocument()
    expect(screen.getByText('Fat-soluble: with a meal that has fat it absorbs 3–4 times better.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Fine-tune$/ })).toBeInTheDocument()
    expect(screen.getByText('Watch out:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to details' })).toBeInTheDocument()
    // not on the shelf yet: nothing is saved with a guessed id
    expect(screen.getByText('One more step')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to pantry' })).toBeInTheDocument()
    expect(screen.getByText(/^For information, not medical advice\. If you take medication or have a chronic condition/)).toBeInTheDocument()
  })

  it('the dose reference reads the current language when it is called', () => {
    expect(doseAdvice({ name: 'Cink', perUnit: 15 })).toMatchObject({ substance: 'Zinc', unit: 'mg', zoneLabel: 'With dinner' })
    setLang('hu', { persist: false })
    expect(doseAdvice({ name: 'Cink', perUnit: 15 })).toMatchObject({ substance: 'Cink', zoneLabel: 'Vacsorával' })
  })

  it('medication: the cycle hero, the dose log, the stop confirm, the two sheets', () => {
    const { container } = mountMedication()
    expect(screen.getByText('‹ Supplements')).toBeInTheDocument()
    expect(screen.getByText('The cycle · day 3 of 7')).toBeInTheDocument()
    expect(screen.getByTestId('medication-phase-note').textContent)
      .toMatch(/^You’re in the stable phase; your last dose was (today|yesterday|\d+ days ago)\.$/)
    expect(container.querySelector('.fk-rc')).toHaveTextContent(/^subQ injectionweekly · Monday$/)
    expect(screen.getByText(/2 days peak · 3 days stable · 2 days trough\. Not a measured level\./)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Phases of the cycle: day 3 of 7, stable phase' })).toBeInTheDocument()
    const rows = within(screen.getByRole('list', { name: 'Doses' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Monday, 22 June')
    // the note is the user's own text
    expect(rows[0]).toHaveTextContent('“Hétfő reggel · subQ has”')

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    const confirm = screen.getByRole('group', { name: 'Confirm stopping' })
    expect(confirm).toHaveTextContent('Teszt gyógyszer will stop. The dose history stays; the Fuel pages no longer take it into account.')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))

    fireEvent.click(screen.getByRole('button', { name: '+ Dose' }))
    const dose = screen.getByRole('dialog')
    expect(within(dose).getByRole('heading', { name: 'New dose' })).toBeInTheDocument()
    expect(within(dose).getByText('Dose · Teszt gyógyszer')).toBeInTheDocument()
    expect(within(dose).getByLabelText('Date')).toBeInTheDocument()
    expect(within(dose).getByRole('button', { name: 'Log dose' })).toBeInTheDocument()
  })

  it('medication: the edit form', () => {
    mountMedication()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const form = screen.getByRole('dialog')
    expect(within(form).getByRole('heading', { name: 'Edit medication' })).toBeInTheDocument()
    expect(within(form).getByLabelText('Active ingredient')).toHaveValue('teszthatoanyag')
    expect(within(form).getByRole('group', { name: 'Route' })).toHaveTextContent('subQ injectionIM injectionoral')
    expect(within(form).getByRole('group', { name: 'How often' })).toHaveTextContent('weeklydaily')
    expect(within(form).getByRole('group', { name: 'Dose day' })).toHaveTextContent('MonTueWedThuFriSatSun')
    expect(within(form).getByText('7-day cycle; the phase layout stays as it is.')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })
})
