// ============================================================
// Mezo · WeeklyLearningSheet tests (mezo-3n2so, learned expenditure part 2, spec §5.1).
// The „Heti tanulás” sheet — opened from the highlighted Alap row of the Fuel Mai equation box.
// The data hooks are stubbed so the contract (which mark/dismiss call, which copy) is tested the
// same way in mock and real mode.
// ============================================================
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExpenditureWeeklyCard, IntakeDayMarkResult } from '@/data/fuel/expenditureApi'
import { onToast } from '@/shared/lib/toastBus'

const hooks = vi.hoisted(() => ({
  setMark: vi.fn(),
  clearMark: vi.fn(),
  dismiss: vi.fn(),
}))

vi.mock('@/data/fuel/expenditureHooks', () => ({
  useIntakeDayMark: () => ({ setMark: hooks.setMark, clearMark: hooks.clearMark, pending: false }),
  useDismissWeeklyCard: () => ({ dismiss: hooks.dismiss }),
}))

import { WeeklyLearningSheet } from '@/features/fuel/sheets/WeeklyLearningSheet'

const CARD: ExpenditureWeeklyCard = {
  weekStart: '2026-09-21',
  weekEnd: '2026-09-27',
  status: 'updated',
  confidence: 'high',
  appliedBaseKcal: 2480,
  posteriorSdKcal: 148,
  stepKcal: 60,
  usableDays: 4,
  weighInDays: 4,
  minUsableDays: 4,
  minWeighInDays: 2,
  excludedDays: [
    { date: '2026-09-23', kcal: 1180, reason: 'suspicious' },
    { date: '2026-09-27', kcal: 1020, reason: 'marked' },
  ],
}

const HOLDING: ExpenditureWeeklyCard = {
  ...CARD,
  status: 'holding',
  confidence: 'medium',
  appliedBaseKcal: 2420,
  stepKcal: 0,
  usableDays: 3,
  weighInDays: 1,
}

const markResult = (date: string, status: IntakeDayMarkResult['day']['status'], before: number, after: number): IntakeDayMarkResult => ({
  day: { date, kcal: 1180, status, mark: status === 'confirmed_complete' ? 'complete' : status === 'marked_incomplete' ? 'incomplete' : null },
  appliedBaseBeforeKcal: before,
  appliedBaseAfterKcal: after,
  recomputed: true,
})

function renderSheet(card: ExpenditureWeeklyCard = CARD, onClose = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/fuel']}>
      <Routes>
        <Route path="/fuel" element={<WeeklyLearningSheet card={card} onClose={onClose} />} />
        <Route path="/fuel/tanulas" element={<p>tanulás oldal</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return { onClose }
}

const row = (label: RegExp) => screen.getByText(label).closest('.fwl-day') as HTMLElement

beforeEach(() => {
  hooks.setMark.mockReset()
  hooks.clearMark.mockReset()
  hooks.dismiss.mockReset().mockResolvedValue(undefined)
})
afterEach(() => vi.clearAllMocks())

describe('WeeklyLearningSheet', () => {
  it('a fej a hetet, a tanult alapot, a biztonságot és a ±σ-t mondja, a lépést és az okát', () => {
    renderSheet()
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByText('Heti tanulás · szept. 21–27.')).toBeInTheDocument()
    expect(within(sheet).getByRole('heading', { name: 'Alap 2 480 kcal' })).toBeInTheDocument()
    expect(within(sheet).getByText('Biztos · ±150 kcal')).toBeInTheDocument()
    expect(sheet.querySelector('.fwl-step')!.textContent).toBe('+60 kcal a napi keretedben')
    expect(within(sheet).getByText('A súlyod lassabban nőtt, mint amit a felírt evés alapján vártam.')).toBeInTheDocument()
  })

  it('lefelé lépésnél a „gyorsabban” okot mondja', () => {
    renderSheet({ ...CARD, stepKcal: -40 })
    expect(document.querySelector('.fwl-step')!.textContent).toBe('−40 kcal a napi keretedben')
    expect(screen.getByText('A súlyod gyorsabban nőtt, mint amit a felírt evés alapján vártam.')).toBeInTheDocument()
  })

  it('kevés adatnál a kártya számaival mondja, miért várt, és nincs lépés-sor', () => {
    renderSheet(HOLDING)
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: 'Ezen a héten vártam' })).toBeInTheDocument()
    expect(within(sheet).getByText('Alap 2 420 kcal · Közepesen biztos · ±150 kcal')).toBeInTheDocument()
    expect(sheet.querySelector('.fwl-why')!.textContent)
      .toBe('Kevés adat volt: 3 teljes nap, 1 mérlegelés — legalább 4 és 2 kell. A keret nem változott.')
    expect(sheet.querySelector('.fwl-step')).toBeNull()
    expect(sheet.className).toContain('is-hold')
  })

  it('a kihagyott napok: nap + dátum, kcal, ok-chip, és a megfelelő gomb', () => {
    renderSheet()
    const sus = row(/Sze, szept\. 23\./)
    expect(within(sus).getByText(/1 180 kcal/)).toBeInTheDocument()
    expect(within(sus).getByText('hiányosnak tűnt')).toBeInTheDocument()
    expect(within(sus).getByRole('button', { name: 'Teljes volt' })).toBeInTheDocument()
    const marked = row(/V, szept\. 27\./)
    expect(within(marked).getByText('te jelölted hiányosnak')).toBeInTheDocument()
    expect(within(marked).getByRole('button', { name: 'Visszavonom' })).toBeInTheDocument()
  })

  it('„Teljes volt” jelöl, a sor átvált, és kiírja, mennyit mozdult a keret', async () => {
    hooks.setMark.mockResolvedValue(markResult('2026-09-23', 'confirmed_complete', 2480, 2440))
    renderSheet()
    await userEvent.click(within(row(/Sze, szept\. 23\./)).getByRole('button', { name: 'Teljes volt' }))
    expect(hooks.setMark).toHaveBeenCalledWith('2026-09-23', 'complete')
    const sus = row(/Sze, szept\. 23\./)
    expect(within(sus).getByText('te jelölted teljesnek')).toBeInTheDocument()
    expect(within(sus).getByRole('button', { name: 'Visszavonom' })).toBeInTheDocument()
    expect(screen.getByText('A keret −40 kcal-lal változott')).toBeInTheDocument()
  })

  it('„Visszavonom” törli a jelölést; változatlan alapnál „A keret nem változott”', async () => {
    hooks.clearMark.mockResolvedValue(markResult('2026-09-27', 'usable', 2480, 2480))
    renderSheet()
    await userEvent.click(within(row(/V, szept\. 27\./)).getByRole('button', { name: 'Visszavonom' }))
    expect(hooks.clearMark).toHaveBeenCalledWith('2026-09-27')
    expect(screen.getByText('A keret nem változott')).toBeInTheDocument()
    expect(within(row(/V, szept\. 27\./)).getByText('számít')).toBeInTheDocument()
  })

  it('sikertelen mentésnél hibaüzenet, és a sor marad, ami volt', async () => {
    hooks.setMark.mockRejectedValue(new Error('500'))
    const toasts: unknown[] = []
    const off = onToast((t) => toasts.push(t))
    renderSheet()
    await userEvent.click(within(row(/Sze, szept\. 23\./)).getByRole('button', { name: 'Teljes volt' }))
    off()
    expect(toasts).toContainEqual({ kind: 'error', text: 'Nem sikerült menteni, próbáld újra' })
    const sus = row(/Sze, szept\. 23\./)
    expect(within(sus).getByText('hiányosnak tűnt')).toBeInTheDocument()
    expect(within(sus).getByRole('button', { name: 'Teljes volt' })).toBeInTheDocument()
    expect(screen.queryByText(/A keret/)).not.toBeInTheDocument()
  })

  it('„Bezárom” elrejti ezt a hetet és bezárja a lapot', async () => {
    const { onClose } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Bezárom' }))
    expect(hooks.dismiss).toHaveBeenCalledWith('2026-09-21')
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('„Részletek ›” a tanulás oldalára visz', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: /Részletek/ }))
    expect(await screen.findByText('tanulás oldal')).toBeInTheDocument()
  })
})
