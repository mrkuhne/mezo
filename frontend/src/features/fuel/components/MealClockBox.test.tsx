import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MealClock, MealClockBox, judgedWindow, type ClockDay } from './MealClockBox'
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'

const tile = (over: Partial<WindowTileVM> = {}): WindowTileVM => ({
  key: '10:52-Tízórai', slotKey: 'snack', state: 'now', icon: 'i-snack', label: 'Tízórai', time: '10:52',
  name: 'Tízórai', ghost: true, fromPlan: false, kcal: 311, rings: [], mealId: null,
  windowFrom: '10:30', windowTo: '11:30', windowReasons: ['bridge'], budgetKcal: 311, plannedTime: '10:52',
  ...over,
} as WindowTileVM)
const row = (over: Partial<DoneMealRow> = {}): DoneMealRow => ({
  mealId: 'm1', name: 'Kókuszos csirke', time: '08:46', kcal: 784, proteinG: 63, carbsG: 92, fatG: 14,
  scorePct: 87, fiberG: 10, sugarG: 6, plannedTime: '08:15', timing: null, ...over,
})
const day: ClockDay = {
  wake: '06:40', bed: '23:00', nowHHmm: '10:52', training: { start: '17:30', end: '18:45', label: 'Edzés' },
  windows: [{ key: 'a', from: '07:20', to: '09:20' }, { key: 'b', from: '10:30', to: '11:30' }], mealCount: 5,
}

describe('MealClock', () => {
  it('renders on a pre-log tile with the window in its label', () => {
    render(<MealClock tile={tile()} row={null} nowHHmm="10:52" onOpen={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Tízórai · ajánlott ablak 10:30–11:30/ })).toBeInTheDocument()
  })
  it('names the hit on a logged tile', () => {
    render(<MealClock tile={tile({ label: 'Reggeli', state: 'done', windowFrom: '07:20', windowTo: '09:20' })} row={row()} nowHHmm="10:52" onOpen={vi.fn()} />)
    expect(screen.getByRole('button', { name: /logolva 08:46 · Az ablakban/ })).toBeInTheDocument()
  })
})

describe('judgedWindow', () => {
  it('prefers the stored plan window over the tile window', () => {
    const r = row({ timing: { eatenAt: '08:46', windowFrom: '07:00', windowTo: '09:00', slotLabel: 'reggeli', windowSource: 'plan' } })
    expect(judgedWindow(tile({ windowFrom: '07:20', windowTo: '09:20' }), r)).toEqual({ from: '07:00', to: '09:00' })
  })
  it('ignores a config window and falls back to the tile', () => {
    const r = row({ timing: { eatenAt: '08:46', windowFrom: '05:00', windowTo: '10:00', slotLabel: 'reggeli', windowSource: 'config' } })
    expect(judgedWindow(tile({ windowFrom: '07:20', windowTo: '09:20' }), r)).toEqual({ from: '07:20', to: '09:20' })
  })
})

describe('MealClockBox', () => {
  it('pre-log: recommended window, why, and how it fits the day', () => {
    render(<MealClockBox tile={tile()} row={null} day={day} next={null} blockColor="var(--lav)" onClose={vi.fn()} />)
    expect(screen.getByText('Ajánlott ablak')).toBeInTheDocument()
    expect(screen.getByText('Miért ekkor?')).toBeInTheDocument()
    expect(screen.getByText('Két fő étkezés között')).toBeInTheDocument()
    expect(screen.getByText('Hogyan illik a napodba')).toBeInTheDocument()
    expect(screen.getByText(/Edzés 17:30–18:45/)).toBeInTheDocument()
  })
  it('post-log: logged time, hit chip, band without a number, forecast', () => {
    render(<MealClockBox tile={tile({ label: 'Reggeli', state: 'done', windowFrom: '07:20', windowTo: '09:20' })} row={row()} day={day} next={tile()} blockColor="var(--amber)" onClose={vi.fn()} />)
    expect(screen.getByText('Logolva')).toBeInTheDocument()
    expect(screen.getByText('Az ablakban')).toBeInTheDocument()
    expect(screen.getByText('Vércukor-válasz')).toBeInTheDocument()
    expect(screen.getByText('Mire számíts')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/glikémiás/i)
    expect(document.body.textContent).not.toMatch(/≈\s*\d/)
  })
  it('post-log without carbs: no blood-sugar section (honest-null)', () => {
    render(<MealClockBox tile={tile({ state: 'done' })} row={row({ carbsG: null })} day={day} next={null} blockColor="var(--lav)" onClose={vi.fn()} />)
    expect(screen.queryByText('Vércukor-válasz')).toBeNull()
  })
})
