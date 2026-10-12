// Fuel settings and the meal-windows editor in English (Folyadék F5, mezo-n4wf5.5): verbatim from the approved prototype's
// `L(hu, en)` pairs (docs/design_2.0/prototypes/vilagos/fuel.js `beallitas()` / `ablakok()`). Mock mode, so no fetch.
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { makeHookWrapperWithClient } from '@/test/queryWrapper'
import { FuelSettingsPage } from '@/features/fuel/pages/FuelSettingsPage'
import { FuelSlotsPage } from '@/features/fuel/pages/FuelSlotsPage'
import { validateSlotPlan } from '@/features/fuel/logic/validateSlotPlan'
import { onToast } from '@/shared/lib/toastBus'

beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'true'); localStorage.clear(); setLang('en', { persist: false }) })
afterEach(() => { vi.unstubAllEnvs(); setLang('hu', { persist: false }) })

function mount(path: '/settings/fuel' | '/settings/fuel/slots') {
  const { wrapper: Wrapper } = makeHookWrapperWithClient()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings/fuel" element={<FuelSettingsPage />} />
          <Route path="/settings/fuel/slots" element={<FuelSlotsPage />} />
          <Route path="*" element={<div data-testid="elsewhere" />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>,
  )
}

describe('Fuel settings in English', () => {
  it('the hero, the four sections and their fields', () => {
    const { container } = mount('/settings/fuel')
    expect(screen.getByRole('button', { name: 'Back' })).toHaveTextContent('‹ Settings')
    const hero = container.querySelector('.fb-hero')!
    expect(hero).toHaveTextContent('Daily rhythm · 4 meals')
    expect(hero).toHaveTextContent(/Your budget today is [\d,]+ kcal, split across four meals\./)
    expect(hero).toHaveTextContent('The day’s curve moves with your settings. The rhythm guides, it doesn’t restrict: any window can be logged later.')
    expect(screen.getByRole('img', { name: 'The day’s meals on a timeline' })).toBeInTheDocument()
    expect(hero.querySelector('.fb-tide text.w')).toHaveTextContent('14:00 caffeine cut-off')
    expect([...container.querySelectorAll('h2.fo-sec')].map((h) => h.textContent)).toEqual(['1Rhythm', '2Macros', '3Targets', '4Fine-tuning'])
    expect(screen.getByText('Meals per day')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'meals' })).toHaveTextContent('4meals')
    expect(screen.getByLabelText('Caffeine cut-off')).toHaveValue('14:00')
    expect(screen.getByText('The cut-off also sets the line on Today, the day plan and the caffeine habit.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit meal windows' })).toHaveTextContent('Meal windowsedit · three day types')
    expect(screen.getByRole('combobox', { name: 'Macro profile' })).toHaveValue('balanced')
    for (const name of ['Balanced', 'Low fat', 'Low carb', 'High carb', 'Custom']) expect(screen.getByRole('option', { name })).toBeInTheDocument()
    expect(container.querySelector('.fb-mac')).toHaveTextContent(/From today’s target · [\d,]+ kcal · active goal\d+%Protein\d+ g\d+%Carbs\d+ g\d+%Fat\d+ g/)
    expect(screen.getByLabelText('Water target (ml)')).toBeInTheDocument()
    expect(screen.getByLabelText('Fibre target (g)')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Protein level' })).toHaveTextContent('LowModerateHigh')
    expect(screen.getByRole('switch', { name: 'Learn from your weight and food' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('each week Mezo learns how much energy you really use')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('a custom split: the three fields, the sum error, the note; a changed profile is a preview', async () => {
    mount('/settings/fuel')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Macro profile' }), 'custom')
    expect(screen.getByText(/Today’s target with this setting ·/)).toBeInTheDocument()
    expect(screen.getByText('Preview: it applies when you save.')).toBeInTheDocument()
    const fat = screen.getByLabelText('Fat %')
    expect(screen.getByLabelText('Protein %')).toBeInTheDocument()
    expect(screen.getByLabelText('Carbs %')).toBeInTheDocument()
    await userEvent.clear(fat)
    await userEvent.type(fat, '10')
    expect(screen.getByRole('alert')).toHaveTextContent('The shares must add up to 100%.')
    expect(screen.getByText('The protein target is protected per kg of body weight. Carbs absorb the difference.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('saving says "Saved"', async () => {
    const toasts: string[] = []
    const off = onToast((t) => { if ('text' in t) toasts.push(t.text) })
    mount('/settings/fuel')
    await userEvent.click(screen.getByRole('switch', { name: 'Learn from your weight and food' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByTestId('elsewhere')
    off()
    expect(toasts).toEqual(['Saved'])
  })

  it('the page text follows a language change at runtime, without a remount', () => {
    setLang('hu', { persist: false })
    const { container } = mount('/settings/fuel')
    const hero = container.querySelector('.fb-hero')!
    const first = container.querySelector('h2.fo-sec')!
    expect(hero).toHaveTextContent('Napi ritmus · 4 étkezés')
    expect(first).toHaveTextContent('Ritmus')
    act(() => setLang('en', { persist: false }))
    expect(hero).toHaveTextContent('Daily rhythm · 4 meals')
    expect(first).toHaveTextContent('Rhythm')
    expect(screen.getByRole('option', { name: 'Balanced' })).toBeInTheDocument()
  })
})

describe('Meal windows in English', () => {
  it('the recommended face: short day tabs, the split, the steps', async () => {
    const { container } = mount('/settings/fuel/slots')
    expect(screen.getByRole('button', { name: 'Back' })).toHaveTextContent('‹ Fuel')
    expect(screen.getByRole('tablist', { name: 'Day types' })).toHaveTextContent('RestMorningEvening')
    const hero = container.querySelector('.fb-hero')!
    expect(hero).toHaveTextContent('Recommended split · Σ 100%')
    expect(hero).toHaveTextContent(/Rest day: (three|four|five|six) windows split the day\./)
    expect(hero).toHaveTextContent('Worked out for a day without training. Each vessel’s level is that window’s share of calories.')
    expect(screen.getByRole('button', { name: 'Customise' })).toBeEnabled()
    expect(container.querySelector('h2.fo-sec')).toHaveTextContent('Windows')
    expect(container.querySelector('.fb-rec .fo-step')).toHaveTextContent(/^\d\d:\d\dBreakfast[\d,]+ kcal\d+%$/)
    expect(screen.getByText('This is the recommendation. Customise starts from it. After that you can change the names, types, times and shares.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Evening' }))
    expect(hero).toHaveTextContent(/Evening training: \w+ windows split the day\./)
  })

  it('the editor: fields, kinds, roles, anchors, the sum, Mezo’s view', async () => {
    const { container } = mount('/settings/fuel/slots')
    await userEvent.click(screen.getByRole('button', { name: 'Customise' }))
    const n = screen.getAllByLabelText('Window name').length
    const hero = container.querySelector('.fb-hero')!
    expect(hero).toHaveTextContent('Customising · Σ 100%')
    expect(hero).toHaveTextContent('The shares add up to 100%: ready to save.')
    expect(hero).toHaveTextContent('Change the name, the type, the time or the share. Each level is a share of calories. Together the shares must make 100%.')
    expect([...container.querySelectorAll('h2.fo-sec')].map((h) => h.textContent)).toEqual([`1Windows · ${n}`, '2How it adds up', '3Mezo’s view'])
    expect(screen.getAllByRole('group', { name: 'Type' })[0]).toHaveTextContent('BreakfastLunchDinnerSnack')
    expect(screen.getAllByRole('group', { name: 'Role' })[0]).toHaveTextContent('GeneralBefore trainingAfter training')
    expect(screen.getAllByLabelText('Anchor')[0]).toHaveTextContent('Fixed timeAfter wakingAround training startAfter training endsBefore bed')
    expect(screen.getAllByLabelText('Time')).toHaveLength(n)
    expect(screen.getAllByLabelText('Share %')).toHaveLength(n)
    await userEvent.selectOptions(screen.getAllByLabelText('Anchor')[0], 'wake')
    expect(screen.getByRole('textbox', { name: 'Offset (min)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease Offset (min)' })).toBeInTheDocument()
    expect(screen.getByText('Sum of the shares')).toBeInTheDocument()
    expect(container.querySelector('.fb-wv')).toHaveTextContent(/[\d,]+ kcal · \d+ g protein$/)
    expect(screen.getByRole('button', { name: 'Ask Mezo' })).toBeEnabled()
    expect(screen.getByText('An opinion on the current split. It never blocks saving. If you change a row, ask again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    // a new window starts with the English word; deleting names it
    await userEvent.click(screen.getByRole('button', { name: '+ New window' }))
    expect((screen.getAllByLabelText('Window name')[n] as HTMLInputElement).value).toBe('Snack')
    expect(screen.getAllByRole('button', { name: 'Delete Snack' }).length).toBeGreaterThan(0)
  })

  it('an off sum and an unnamed window are said in English', async () => {
    const { container } = mount('/settings/fuel/slots')
    await userEvent.click(screen.getByRole('button', { name: 'Customise' }))
    const share = screen.getAllByLabelText('Share %')[0]
    await userEvent.clear(share)
    await userEvent.type(share, '5')
    await userEvent.clear(screen.getAllByLabelText('Window name')[0])
    expect(container.querySelector('.fb-hero')).toHaveTextContent(/The shares add up to \d+%, so it can’t be saved\./)
    const alerts = screen.getAllByRole('alert').map((a) => a.textContent)
    expect(alerts).toEqual([expect.stringMatching(/^The shares add up to \d+%\. They need to make 100%\.$/), 'One meal window has no name. Give it one.'])
    expect(screen.getByRole('button', { name: 'Delete the unnamed window' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('every check of the plan has an English sentence; a window’s own name stays as typed', () => {
    const row = (label: string, time: string, budgetPct: number, role: 'standard' | 'pre_workout' = 'standard') =>
      ({ label, slotKind: 'snack' as const, role, anchor: { type: 'fixed' as const, time }, budgetPct })
    const win = (label: string, time: number, budgetPct: number) =>
      ({ slotKey: 'snack' as const, kind: 'snack' as const, label, time, weight: budgetPct, budgetPct, rule: 'template-fixed' as const })
    const rows = [row('Tízórai', '10:00', 20, 'pre_workout'), row('Esti falat', '22:30', 80)]
    const { errors, warnings } = validateSlotPlan(rows, [win('Tízórai', 600, 20), win('Esti falat', 1350, 80)] as never,
      { wake: '07:00', bed: '23:00', dayType: 'rest', budgetKcal: 4000, rawTimes: [600, 1350] })
    expect(errors).toEqual([])
    expect(warnings.map((w) => w.text)).toEqual([
      '“Tízórai” is too big for a window before training.',
      'Most of the day’s budget falls in the last third of the day.',
      '“Esti falat” comes after the kitchen closes.',
    ])
    const few = validateSlotPlan([row('A', '10:00', 100)], [win('A', 600, 100)] as never, { wake: '07:00', bed: '23:00', dayType: 'rest', budgetKcal: 2000 })
    expect(few.errors.map((e) => e.text)).toEqual(['A plan needs at least 2 meal windows.'])
  })

  it('the page text follows a language change at runtime, without a remount', async () => {
    setLang('hu', { persist: false })
    const { container } = mount('/settings/fuel/slots')
    const hero = container.querySelector('.fb-hero')!
    expect(hero).toHaveTextContent('Ajánlott felosztás · Σ 100%')
    expect(screen.getByRole('tab', { name: 'Pihenőnap' })).toBeInTheDocument()
    act(() => setLang('en', { persist: false }))
    expect(hero).toHaveTextContent('Recommended split · Σ 100%')
    expect(screen.getByRole('tab', { name: 'Rest' })).toBeInTheDocument()
    expect(container.querySelector('.fb-rec .fo-step')).toHaveTextContent('Breakfast')
  })
})
