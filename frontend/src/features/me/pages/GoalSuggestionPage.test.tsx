import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '@/data/_client/api'
import type { GoalSuggestionPreviewResponse } from '@/data/me/goalApi'
import { GoalSuggestionPage } from '@/features/me/pages/GoalSuggestionPage'

const mocks = vi.hoisted(() => ({
  useGoal: vi.fn(), preview: vi.fn(), actions: vi.fn(), show: vi.fn(),
  accept: vi.fn(), dismiss: vi.fn(), refetch: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useGoal: mocks.useGoal,
  useGoalSuggestionPreview: mocks.preview,
  useSuggestionActions: mocks.actions,
}))
vi.mock('@/shared/ui/ToastProvider', () => ({ useToast: () => ({ show: mocks.show }) }))

const base: GoalSuggestionPreviewResponse = {
  status: 'proposed', reasonCode: 'weekly_correction', affectedFromWeek: 3, affectedToWeek: 8,
  current: { trajectory: 'cut', targetWeightKg: 78, targetDate: '2026-10-24', targetRateKgPerWeek: -0.18, weekAverageKcal: 2780, trainingDayKcal: 2940, restDayKcal: 2580, proteinG: 188, carbsG: 361, fatG: 82, segmentFromWeek: 3, segmentToWeek: 5, segmentLabel: 'MAV', guardStatus: null },
  proposed: { trajectory: 'cut', targetWeightKg: 78, targetDate: '2026-10-24', targetRateKgPerWeek: -0.2, weekAverageKcal: 2660, trainingDayKcal: 2820, restDayKcal: 2460, proteinG: 188, carbsG: 344, fatG: 78, segmentFromWeek: 3, segmentToWeek: 5, segmentLabel: 'MAV', guardStatus: null },
  changedFields: ['targetRateKgPerWeek', 'weekAverageKcal', 'trainingDayKcal', 'restDayKcal', 'carbsG', 'fatG'],
  unchangedFields: ['trajectory', 'targetWeightKg', 'targetDate', 'proteinG', 'segment', 'guards'],
  warnings: ['Az alvás miatt a korrekció tompítva lett.'], blockers: [], canApply: true,
  previewFingerprint: 'b'.repeat(64),
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/me/goals/weight/suggestions/s1']}>
      <Routes>
        <Route path="/me/goals/weight/suggestions/:suggestionId" element={<GoalSuggestionPage />} />
        <Route path="/me/goals/weight" element={<div>Cél hub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useGoal.mockReturnValue({ goalId: 'g1', pending: false })
  mocks.preview.mockReturnValue({ preview: base, pending: false, refetch: mocks.refetch })
  mocks.actions.mockReturnValue({ accept: mocks.accept, dismiss: mocks.dismiss, pending: false })
  mocks.accept.mockResolvedValue(null)
  mocks.dismiss.mockResolvedValue(undefined)
  mocks.refetch.mockResolvedValue(undefined)
})

test('shows loading without firing accept', () => {
  mocks.preview.mockReturnValue({ preview: undefined, pending: true, refetch: mocks.refetch })
  renderPage()
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  expect(mocks.accept).not.toHaveBeenCalled()
})

test('shows the complete current/proposed diff and warning without applying on mount', () => {
  const { container } = renderPage()
  expect(screen.getByText('2 780 kcal')).toBeInTheDocument()
  expect(screen.getByText('2 660 kcal')).toBeInTheDocument()
  expect(screen.getByText('Az alvás miatt a korrekció tompítva lett.')).toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Figyelmeztetés' })).toBeInTheDocument()
  for (const arrow of container.querySelectorAll('.gdiff-arrow')) expect(arrow).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByRole('button', { name: 'Módosítások alkalmazása' })).toBeEnabled()
  expect(mocks.accept).not.toHaveBeenCalled()
})

test('blocks apply when the preview has a blocker', () => {
  mocks.preview.mockReturnValue({ preview: { ...base, blockers: ['GOAL_DIRECTION_TARGET_CONFLICT'], canApply: false, previewFingerprint: null }, pending: false, refetch: mocks.refetch })
  renderPage()
  expect(screen.getByText(/célsúly nem egyezik/i)).toBeInTheDocument()
  expect(screen.getByRole('alert', { name: 'Alkalmazást blokkoló hiba' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Módosítások alkalmazása' })).toBeDisabled()
})

test('keeps suggestion transitions inside one reduced-motion-safe entrance group', () => {
  const { container } = renderPage()
  expect(container.querySelectorAll('.mz-play')).toHaveLength(1)
  for (const item of container.querySelectorAll('.rise')) expect(item.closest('.mz-play')).not.toBeNull()
})

test('offers preview refresh after a stale 409', async () => {
  mocks.accept.mockRejectedValue(new ApiError([{ code: 'GOAL_SUGGESTION_STALE', message: 'Elavult.' }], 409))
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Módosítások alkalmazása' }))
  expect(await screen.findByRole('button', { name: 'Előnézet frissítése' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Előnézet frissítése' }))
  expect(mocks.refetch).toHaveBeenCalled()
})

test('applies the exact fingerprint, shows success and returns to the hub', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Módosítások alkalmazása' }))
  expect(mocks.accept).toHaveBeenCalledWith('g1', 's1', 'b'.repeat(64))
  expect(mocks.show).toHaveBeenCalledWith({ kind: 'success', text: 'A cél módosításai alkalmazva.' })
  expect(await screen.findByText('Cél hub')).toBeInTheDocument()
})

test('Most nem only goes back; dismiss is separate and confirmed', async () => {
  const first = renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Most nem' }))
  expect(mocks.accept).not.toHaveBeenCalled()
  expect(mocks.dismiss).not.toHaveBeenCalled()
  expect(await screen.findByText('Cél hub')).toBeInTheDocument()
  first.unmount()

  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Javaslat elvetése' }))
  expect(mocks.dismiss).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Igen, elvetem' }))
  expect(mocks.dismiss).toHaveBeenCalledWith('g1', 's1')
})

test.each(['accepted', 'dismissed', 'superseded'] as const)('renders %s as history without apply', status => {
  mocks.preview.mockReturnValue({ preview: { ...base, status, canApply: false, previewFingerprint: null }, pending: false, refetch: mocks.refetch })
  renderPage()
  expect(screen.getByText(/történeti nézet/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Módosítások alkalmazása' })).not.toBeInTheDocument()
})
