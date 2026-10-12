// ============================================================
// Mezo · Fuel Mai in English (Folyadék F5, mezo-n4wf5.5) — the page family of area A: the Mai page with
// its hero, macro vials, meal blocks, the equation sheet, the skip and doctor sheets, the gentle-mode faces
// and the day pager. Wording = the approved prototype's `L(hu, en)` pairs (vilagos/fuel.js). Also the two
// faces that only exist since this slice — loading and error — in both languages.
// ============================================================
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { QueryWrapper } from '@/test/queryWrapper'
import type { FuelSlot } from '@/data/types'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { FuelGuidanceCard } from '@/features/fuel/components/FuelGuidanceCard'
import { FuelRecoveryNote, FuelRecoveryStrip } from '@/features/fuel/components/FuelRecoveryNote'
import { MealSkipSheet } from '@/features/fuel/sheets/MealSkipSheet'
import { DoctorSheet } from '@/features/fuel/sheets/DoctorSheet'
import { DayNavigator } from '@/shared/ui/DayNavigator'
import { buildDayPlan } from '@/features/fuel/logic/buildDayPlan'

const hoisted = vi.hoisted(() => ({
  state: 'ok' as 'ok' | 'pending' | 'error',
  refetch: vi.fn(),
  overrideSlots: null as FuelSlot[] | null,
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useFuelDay: (date?: string) => {
      const real = actual.useFuelDay(date)
      if (hoisted.state === 'ok') return real
      return { ...real, isPending: hoisted.state === 'pending', isError: hoisted.state === 'error', refetch: hoisted.refetch }
    },
    useFuelTimeline: (date?: string) => {
      const real = actual.useFuelTimeline(date)
      return hoisted.overrideSlots ? { ...real, plan: { ...real.plan, slots: hoisted.overrideSlots } } : real
    },
  }
})

beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'true'); setLang('en', { persist: false }) })
afterEach(() => {
  vi.unstubAllEnvs()
  hoisted.state = 'ok'
  hoisted.overrideSlots = null
  hoisted.refetch.mockReset()
  setLang('hu', { persist: false })
})

const mount = (ui: React.ReactElement, route = '/fuel') =>
  render(<QueryWrapper><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></QueryWrapper>)

const SLOTS: FuelSlot[] = [
  { time: '09:15', kind: 'meal', label: 'Breakfast', slotKey: 'breakfast', state: 'done', mealId: 'm1', mealName: 'Túrós zabkása · áfonyával',
    kcal: 580, p: 42, c: 78, f: 12, windowFrom: '07:00', windowTo: '10:00', budgetKcal: 656, plannedTime: '08:30' },
  { time: '16:30', kind: 'snack', label: 'Snack', slotKey: 'snack', state: 'pending', kcal: 380, p: 26, c: 34, f: 15,
    windowFrom: '16:00', windowTo: '17:30', budgetKcal: 380, plannedTime: '16:30', skipKey: 'snack#1' },
]

describe('Fuel Mai in English', () => {
  it('the page: pager, hero, numbered sections, blocks, the between-meals card', () => {
    hoisted.overrideSlots = SLOTS
    const { container } = mount(<FuelMaiPage />)
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
    expect(container.querySelector('.fa-dn-mid small')).toHaveTextContent('Today')
    const hero = container.querySelector('.fa-hero') as HTMLElement
    expect(within(hero).getByText('Today so far')).toBeInTheDocument()
    expect(hero.querySelector('.fo-hero-verdict')!.textContent)
      .toMatch(/^[\d,]+ kcal still fits, (\d+ g of protein to go|and your protein is done)\.$/)
    expect(within(hero).getByText('kcal eaten')).toBeInTheDocument()
    expect(within(hero).getByText('still fits')).toBeInTheDocument()
    expect(within(hero).getByRole('button', { name: 'Log a meal' })).toBeInTheDocument()
    expect(within(hero).getByRole('button', { name: 'How does it add up?' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(expect.arrayContaining([
      '1Today’s macros', '2Today’s blocks · 1 meal', '3Between meals',
    ]))
    expect(Array.from(container.querySelectorAll('.fa-mac .fo-vial > small')).map(e => e.textContent!.replace(/\/.*$/, '')))
      .toEqual(['Protein', 'CarbsCarbs', 'Fat', 'Water', 'Fibre'])
    expect(screen.getByText('Tap Water to log a drink.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Log water · / })).toBeInTheDocument()
    // a block: the window's own (translated) label arrives from the logic; the stored meal name is never translated
    expect(screen.getByRole('button', { name: /^Breakfast · logged / })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Túrós zabkása · áfonyával' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Mezo’s rating: 9\.2$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Snack · log here' })).toHaveTextContent('+ Log here')
    expect(screen.getByRole('button', { name: 'Skip snack' })).toHaveTextContent(/^(Skip|I skipped it)$/)
    expect(container.querySelector('.fa-blk.open .fa-when')!.textContent).toMatch(/^Suggested 16:00–17:30/)
    expect(screen.getByRole('button', { name: 'Log between meals' })).toHaveTextContent('Log anythingbetween meals too')
    // no Hungarian left on the page (the stored meal name and the day's mock notes aside)
    expect(container.textContent).not.toMatch(/Logol|étkezés|Ablakon|kihagy|Ajánlott|belefér|makró/i)
  })

  it('the page text follows a language change at runtime, without a remount', () => {
    setLang('hu', { persist: false })
    hoisted.overrideSlots = SLOTS
    const { container } = mount(<FuelMaiPage />)
    const hero = container.querySelector('.fa-hero')!
    expect(hero.querySelector('.fo-hero-lbl')).toHaveTextContent('Ma eddig')
    expect(screen.getByRole('button', { name: 'Étkezés logolása' })).toBeInTheDocument()
    act(() => setLang('en', { persist: false }))
    expect(container.querySelector('.fa-hero')).toBe(hero)
    expect(hero.querySelector('.fo-hero-lbl')).toHaveTextContent('Today so far')
    expect(screen.getByRole('button', { name: 'Log a meal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Today’s macros/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Snack · log here' })).toBeInTheDocument()
  })

  it('the equation sheet', async () => {
    mount(<FuelMaiPage />)
    await userEvent.click(screen.getByRole('button', { name: 'How does it add up?' }))
    const box = await screen.findByRole('dialog')
    expect(within(box).getByRole('heading', { name: /kcal (still fits today|over the budget)$/ })).toBeInTheDocument()
    for (const t of ['Base', 'Movement', 'Food', 'Left']) expect(within(box).getByText(t)).toBeInTheDocument()
    expect(within(box).getByText('eaten')).toBeInTheDocument()
    expect(within(box).getByText('what you have logged so far today')).toBeInTheDocument()
    expect(within(box).getByText('what is left of today’s budget')).toBeInTheDocument()
    expect(within(box).getByText(/^Your budget comes from your base need/)).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'In detail: where the budget comes from' })).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('behaviour change 1: a window-less log is titled „Between meals · HH:mm" by the logic', () => {
    const base = { id: 's1', slot: 'snack', title: 'Whey + banán', score: null, kcal: 356, p: 29, c: 31, f: 13, mealItems: [], items: [], tags: [],
      loggedAt: '2026-07-02T10:05:00', mealDate: '2026-07-02' }
    const plan = buildDayPlan({
      date: '2026-07-02', nowHHmm: '14:00', wake: '06:30', bed: '23:00', mealsPerDay: 3, meals: [base] as never, recipes: [], blocks: [],
      budget: { kcal: 2400, p: 180, c: 240, f: 73, energy: { base: 2400, planned: 0, extra: 0, balance: 0, target: 2400 } },
      protocolSlots: [],
    } as never)
    const extra = plan.slots.find(s => s.mealId === 's1')!
    expect(extra.label).toBe('Between meals · 10:05')
    // what the user typed is never translated
    expect(extra.mealName).toBe('Whey + banán')
  })

  it('the day pager on a past day', () => {
    const { container } = render(<DayNavigator date="2026-10-05" maxDate="2026-10-07" minDate="2026-09-30" onChange={() => {}} eyebrow />)
    expect(container.querySelector('.fa-dn-mid small')).toHaveTextContent('2 days ago')
    expect(container.querySelector('.fa-dn-mid .dp-trigger')).toHaveTextContent('Monday, 5 October')
    act(() => setLang('hu', { persist: false }))
    expect(container.querySelector('.fa-dn-mid small')).toHaveTextContent('2 nappal ezelőtt')
    expect(container.querySelector('.fa-dn-mid .dp-trigger')).toHaveTextContent('hétfő, október 5.')
    expect(screen.getByRole('button', { name: 'Előző nap' })).toBeEnabled()
  })

  it('gentle mode: the strip, the two notes and the guidance face', async () => {
    const { container } = mount(
      <>
        <FuelRecoveryStrip category="INJURY" day={2} onTap={() => {}} />
        <FuelRecoveryNote mode="MAINTENANCE" deficitDropped />
        <FuelRecoveryNote mode="ESTIMATE" />
        <FuelGuidanceCard category="STOMACH" day={2} waterMl={1300} waterTargetMl={2500} eatenKcal={2060} onWater={() => {}} />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Gentle mode, injury, day 2' })).toHaveTextContent('Gentle mode · injury · day 2')
    expect(screen.getByText('No dieting while you are injured')).toBeInTheDocument()
    expect(container.textContent).toContain('tissue rebuilds from it. This is not medical advice.')
    expect(screen.getByText('You are travelling, estimating is fine')).toBeInTheDocument()
    expect(screen.getByText('Gentle mode · stomach bug · day 2')).toBeInTheDocument()
    expect(screen.getByText('No calorie target today.')).toBeInTheDocument()
    expect(container.querySelector('.fa-gh .fo-hero-sub')).toHaveTextContent(
      'Rest, drink, and eat when you can. We let the numbers go for now. 2,060 kcal so far today; we do not measure it against anything.')
    expect(screen.getByRole('button', { name: 'Log water' })).toHaveTextContent('1.3 / 2.5 lfluids today')
    expect(screen.getByRole('button', { name: '+ Water' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /What helps now/ })).toBeInTheDocument()
    expect(screen.getByText('Small sips, often')).toBeInTheDocument()
    expect(screen.getByText('These go down more easily')).toBeInTheDocument()
    expect(Array.from(container.querySelectorAll('.fa-easy span')).map(e => e.textContent)).toContain('Boiled rice')
    await userEvent.click(screen.getByRole('button', { name: 'When to see a doctor' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('You cannot keep fluids down')
  })

  it('the skip sheet and the doctor sheet', () => {
    const skip: PlannedSkip = { id: 's1', kind: 'MEAL', date: '2026-09-27', sessionKey: 'snack#1', reasonCategory: 'STOMACH', reasonText: null,
      plannedKcal: 420, source: 'USER', serious: true, freePass: false, excused: true }
    const sheet = mount(<MealSkipSheet open skip={skip} slotLabel="Snack" canOpenRecovery onClose={() => {}} onReason={() => {}} onDone={() => {}} openRecovery={() => Promise.resolve()} />)
    expect(screen.getByRole('heading', { name: 'Why are you skipping it?' })).toBeInTheDocument()
    expect(screen.getByText('Skipped · Snack · optional; it helps Mezo understand the pattern')).toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'Reason for skipping' })
    expect(Array.from(group.querySelectorAll('button')).map(b => b.textContent))
      .toEqual(['Not hungry', 'No time', 'Stomach bug', 'I’m ill', 'Travelling', 'Other'])
    expect(screen.getByText('Get well soon.')).toBeInTheDocument()
    expect(screen.getByText('If it may last several days, choose how long. Gentle mode changes Fuel too.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
    sheet.unmount()
    mount(<DoctorSheet category="ILLNESS" onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'When to see a doctor' })).toBeInTheDocument()
    expect(screen.getByText('illness')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByText('This is not medical advice.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})

// New since this slice (drawn in the prototype as `mai.tolt` / `mai.hiba`): the pager and the empty bowl with one
// sentence — never a day of zeros, and nothing below it.
describe('Fuel Mai · loading and error', () => {
  it.each([['hu', 'Betöltöm a napodat…', 'Egy pillanat, és itt lesznek a mai számaid.'], ['en', 'Loading your day…', 'One moment and today’s numbers will be here.']] as const)(
    'loading (%s): the empty bowl with one sentence, no numbers, no sections', (lang, title, sub) => {
      setLang(lang, { persist: false })
      hoisted.state = 'pending'
      const { container } = mount(<FuelMaiPage />)
      const hero = screen.getByRole('status')
      expect(within(hero).getByText(title)).toBeInTheDocument()
      expect(within(hero).getByText(sub)).toBeInTheDocument()
      expect(hero.querySelector('.fx-bg.plain')).not.toBeNull()
      expect(hero.querySelector('.fx-bg-n')).toBeNull()
      expect(container.querySelector('.fa-dn')).not.toBeNull()
      expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
      expect(container.querySelector('.fa-blocks, .fa-mac')).toBeNull()
      expect(within(hero).queryByRole('button')).toBeNull()
    })

  it.each([['hu', 'Most nem sikerült betölteni a napodat.', 'Amit eddig felírtál, megvan; csak megmutatni nem tudom.', 'Újrapróbálom'],
    ['en', 'Your day could not be loaded just now.', 'What you have logged is safe; I just cannot show it.', 'Try again']] as const)(
    'error (%s): one calm sentence and the retry', async (lang, title, sub, retry) => {
      setLang(lang, { persist: false })
      hoisted.state = 'error'
      const { container } = mount(<FuelMaiPage />)
      const hero = screen.getByRole('alert')
      expect(within(hero).getByText(title)).toBeInTheDocument()
      expect(within(hero).getByText(sub)).toBeInTheDocument()
      expect(hero.querySelector('.fx-bg.plain')).not.toBeNull()
      expect(container.querySelector('.fa-blocks, .fa-mac')).toBeNull()
      await userEvent.click(within(hero).getByRole('button', { name: retry }))
      expect(hoisted.refetch).toHaveBeenCalledOnce()
    })
})
