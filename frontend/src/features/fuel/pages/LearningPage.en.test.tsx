// Fuel · Tanulás (area D) in English (Folyadék F5, mezo-n4wf5.5): the learning page and the three sheets of the area, verbatim
// from the approved prototype's `L(hu, en)` pairs (fuel.js `tanulas()`, sheets `hw`, `weekly`, `energy`, `water`), plus one
// runtime switch on the same node. Mock mode, so no fetch.
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { QueryWrapper } from '@/test/queryWrapper'
import type { ExpenditureWeeklyCard } from '@/data/fuel/expenditureApi'
import { LearningPage } from '@/features/fuel/pages/LearningPage'
import { WeeklyLearningSheet } from '@/features/fuel/sheets/WeeklyLearningSheet'
import { EnergyBreakdownSheet, type EnergyBreakdown } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'

beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'true'); setLang('en', { persist: false }) })
afterEach(() => vi.unstubAllEnvs())

const mount = (ui: React.ReactElement) => render(<QueryWrapper><MemoryRouter>{ui}</MemoryRouter></QueryWrapper>)

const CARD: ExpenditureWeeklyCard = {
  weekStart: '2026-09-28', weekEnd: '2026-10-04', status: 'updated', confidence: 'medium',
  appliedBaseKcal: 2480, posteriorSdKcal: 150, stepKcal: 60, usableDays: 5, weighInDays: 4,
  minUsableDays: 4, minWeighInDays: 2,
  excludedDays: [{ date: '2026-10-02', kcal: 1180, reason: 'suspicious' }, { date: '2026-09-28', kcal: 2150, reason: 'marked' }],
}

const ENERGY: EnergyBreakdown = {
  base: { kcal: 2480, bmr: 1893, neat: 1.2, neatLabel: '', formula: 'KATCH', source: 'learned', formulaKcal: 2400, sdKcal: 150, confidence: 'medium' },
  movement: {
    kcal: 950, isWeeklyAvg: false, pending: 300,
    parts: [{ key: 'planned', label: 'Planned training · logged', kcal: 420 }, { key: 'extra', label: 'Unplanned movement', kcal: 530 }],
    blocks: [{ label: 'Felsőtest A', kind: 'gym', min: 58, kcal: 420, done: true }, { label: 'Futás', kind: 'run', min: 30, kcal: 300, done: false }],
  },
  deficit: { kcal: -330, rateKgPerWk: 0.3, goalLabel: 'Nyári cut' },
  target: 3100,
}

describe('Fuel · learning in English', () => {
  it('the page: hero, numbered sections, the chart key, the days and the six steps', () => {
    mount(<LearningPage />)
    const hero = document.querySelector('.fo-hero') as HTMLElement
    expect(within(hero).getByText(/^Learned base · (Still learning|Fairly sure|Sure) · ±\d+ kcal$/)).toBeInTheDocument()
    expect(within(hero).getByText(/^This is what you burn without training: [\d,]+ kcal\.$/)).toBeInTheDocument()
    expect(within(hero).getByText(/^The formula would say [\d,]+ kcal\./)).toBeInTheDocument()
    expect(within(hero).getByRole('img', { name: /^Learned base [\d,]+ kcal, in a ±\d+ kcal band; the formula says [\d,]+$/ })).toHaveTextContent(/formula [\d,]+/)
    expect(screen.getByRole('heading', { name: /^1Week by week · \d+ weeks$/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2The last 14 days' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '3Details of the latest week' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^The base of your budget week by week, \d+ weeks: dashed is the formula/ })).toBeInTheDocument()
    expect(screen.getByText('base of the budget')).toBeInTheDocument()
    expect(screen.getByText('uncertainty (±)')).toBeInTheDocument()
    expect(screen.getByText('Tap a week for its numbers. Where there is no row the line breaks; I do not fill it in.')).toBeInTheDocument()
    expect(screen.getByText('By the formula')).toBeInTheDocument()
    expect(screen.getByText('Complete days')).toBeInTheDocument()
    expect(screen.getByText(/^Today is still going: it is counted next Monday\./)).toBeInTheDocument()
    expect(screen.getAllByRole('switch')[0]).toHaveAccessibleName(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d+ [A-Z][a-z]{2} counts$/)
    expect(screen.getByRole('button', { name: /What I looked at\d+ complete days · \d+ weigh-ins · \d+ weeks/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /How it changed/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('a step sheet: its head, its words and the walk between the steps', async () => {
    mount(<LearningPage />)
    await userEvent.click(screen.getByRole('button', { name: /The calculation, simply/ }))
    const sheet = screen.getByRole('dialog', { name: '3. The calculation, simply' })
    expect(within(sheet).getByText(/^the latest week · \d+/)).toBeInTheDocument()
    expect(within(sheet).getByText('On average you ate')).toBeInTheDocument()
    expect(within(sheet).getByText('− what you burned by moving')).toBeInTheDocument()
    expect(within(sheet).getByText('= what you burn without movement')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Previous' })).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Next step' }))
    expect(screen.getByRole('heading', { name: '4. What I filtered out so it would not mislead me' })).toBeInTheDocument()
    expect(screen.getByText(/days? that looked incomplete$/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2) // the × and the link
  })

  it('the page follows a language change at runtime, on the same nodes', () => {
    setLang('hu', { persist: false })
    mount(<LearningPage />)
    const h2 = screen.getByRole('heading', { name: '2Az utolsó 14 nap' })
    const verdict = document.querySelector('.fo-hero-verdict') as HTMLElement
    expect(verdict).toHaveTextContent(/^Ennyit égetsz edzés nélkül: /)
    act(() => setLang('en', { persist: false }))
    expect(h2).toHaveTextContent('The last 14 days')
    expect(document.querySelector('.fo-hero-verdict')).toBe(verdict)
    expect(verdict).toHaveTextContent(/^This is what you burn without training: /)
    expect(screen.getByRole('button', { name: /What I looked at/ })).toBeInTheDocument()
  })

  it('the weekly sheet: moved, and held', () => {
    const { unmount } = mount(<WeeklyLearningSheet card={CARD} onClose={() => {}} />)
    const sheet = screen.getByRole('dialog', { name: 'Base 2,480 kcal' })
    expect(within(sheet).getByText('Weekly learning · 28 Sep – 4 Oct · Fairly sure · ±150 kcal')).toBeInTheDocument()
    expect(sheet.querySelector('.fx-tot')!.textContent).toBe('in your daily budget+60kcal')
    expect(within(sheet).getByText('Your weight rose more slowly than I expected from the eating you logged.')).toBeInTheDocument()
    expect(within(sheet).getByRole('img', { name: 'The base stepped from 2,420 to 2,480' })).toHaveTextContent('last week 2,420')
    expect(within(sheet).getByText('Days left out')).toBeInTheDocument()
    expect(within(sheet).getByText('Fri, 2 Oct')).toBeInTheDocument()
    expect(within(sheet).getByText('1,180 kcal · looked incomplete')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'It was complete' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    expect(within(sheet).getByText('If you leave them as they are, these days stay left out.')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Details' })).toBeInTheDocument()
    unmount()
    mount(<WeeklyLearningSheet card={{ ...CARD, status: 'holding', stepKcal: 0, usableDays: 3, weighInDays: 1 }} onClose={() => {}} />)
    const held = screen.getByRole('dialog', { name: 'I waited this week' })
    expect(held.querySelector('.ft-held')!.textContent)
      .toBe('There was too little data: 3 complete days, 1 weigh-in; at least 4 and 2 are needed. The budget did not change.')
  })

  it('the energy sheet', () => {
    mount(<EnergyBreakdownSheet breakdown={ENERGY} initial="base" onClose={() => {}} />)
    const sheet = screen.getByRole('dialog', { name: 'Where do the 3,100 kcal come from?' })
    expect(within(sheet).getByText('The daily goal is not fixed: it is built from your base need, the movement you logged today and your goal.')).toBeInTheDocument()
    expect([...sheet.querySelectorAll('.fx-leg > span')].map(x => x.textContent)).toEqual(['Base2,480', 'Movement+950', 'Deficit−330'])
    expect(within(sheet).getByText('Base · learned · 2,480')).toBeInTheDocument()
    expect(within(sheet).getByText('By the formula · resting burn × lifestyle')).toBeInTheDocument()
    expect(within(sheet).getByText('without training').tagName).toBe('STRONG')
    expect(within(sheet).getByRole('button', { name: /Learned base · Fairly sure · ±150 kcalHow I learned: week by week, and your days/ })).toBeInTheDocument()
    expect(within(sheet).getByText('Movement · logged today · +950')).toBeInTheDocument()
    expect(within(sheet).getByText('Today’s movement')).toBeInTheDocument()
    expect(within(sheet).getByText('The estimated extra from today’s workouts, for information')).toBeInTheDocument()
    expect(within(sheet).getByText('Felsőtest A · 58 min')).toBeInTheDocument() // the workout's name is the user's: never translated
    expect(within(sheet).getByText('Futás · planned · 30 min')).toBeInTheDocument()
    expect(within(sheet).getByText('Deficit · Nyári cut · −330')).toBeInTheDocument()
    expect(within(sheet).getByText('Goal pace · kg/week').previousSibling?.textContent).toBe('0.30')
    expect(within(sheet).getByText(/^Your goal “Nyári cut” at about 0\.30 kg\/week comes with a daily deficit of about 330 kcal \(about 7,700 kcal per 1 kg of fat/)).toBeInTheDocument()
    expect(within(sheet).getAllByRole('button', { name: 'Close' })).toHaveLength(2)
  })

  it('the water sheet, and its runtime switch', async () => {
    mount(<WaterLogSheet currentMl={1300} targetMl={2500} onLog={() => {}} onClose={() => {}} onUndo={() => {}} canUndo />)
    const sheet = screen.getByRole('dialog', { name: 'How much did you drink?' })
    expect(within(sheet).getByText('A short break for a sip.')).toBeInTheDocument()
    expect(within(sheet).getByRole('img', { name: '1.3 of 2.5 litres so far today' })).toBeInTheDocument()
    expect(within(sheet).getByText('1.3 / 2.5 l so far today')).toBeInTheDocument()
    expect(within(sheet).getByRole('status', { name: 'Amount of water to log' })).toHaveTextContent('0ml')
    expect(within(sheet).getByPlaceholderText('e.g. 330')).toHaveAccessibleName('Amount of water by hand (ml)')
    expect(within(sheet).getByText('ml by hand')).toBeInTheDocument()
    const save = within(sheet).getByRole('button', { name: 'Save' })
    expect(within(sheet).getByRole('button', { name: 'Undo the last one' })).toBeInTheDocument()
    act(() => setLang('hu', { persist: false }))
    expect(save).toHaveTextContent('Mentés')
    expect(screen.getByRole('dialog', { name: 'Mennyit ittál?' })).toBe(sheet)
  })
})
