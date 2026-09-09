// ============================================================
// Mezo · LogFlowPage/MealComposer — draft outcome signals (mezo-76f6): accepted/edited/discarded
// for the meal_draft feature, keyed by the backend-minted draftId MOCK_AI_MEAL_DRAFT carries
// ('mock-ai-draft'). `reportDraftOutcome` itself is mocked here — its own no-op/swallow/happy-path
// contract is unit-tested in outcomeClient.test.ts; this file is about WHEN the composer decides
// to call it and with which outcome.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryWrapper } from '@/test/queryWrapper'

const reportDraftOutcome = vi.hoisted(() => vi.fn())
vi.mock('@/data/aidraft/outcomeClient', () => ({ reportDraftOutcome }))

import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  reportDraftOutcome.mockClear()
  vi.unstubAllEnvs()
})

async function landAiDraft() {
  const onClose = vi.fn()
  const view = render(<LogFlowPage onClose={onClose} />, { wrapper: QueryWrapper })
  await userEvent.click(screen.getByRole('button', { name: '✨ AI · fotó vagy szöveg' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Mit ettél?' }), 'csirkés wrap')
  await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))
  await screen.findByText('Csirkés wrap')
  return view
}

test('accept-clean: saving the AI draft untouched reports "accepted" for its draftId', async () => {
  await landAiDraft()
  await userEvent.click(screen.getByRole('button', { name: /Logolás · \+10 XP/ }))
  await vi.waitFor(() => expect(reportDraftOutcome).toHaveBeenCalledWith('mock-ai-draft', 'meal_draft', 'accepted'))
  expect(reportDraftOutcome).toHaveBeenCalledTimes(1)
})

test('accept-after-edit: touching an AI-landed line before saving reports "edited"', async () => {
  await landAiDraft()
  await userEvent.click(screen.getByRole('button', { name: 'Csirkés wrap növelés' }))
  await userEvent.click(screen.getByRole('button', { name: /Logolás · \+10 XP/ }))
  await vi.waitFor(() => expect(reportDraftOutcome).toHaveBeenCalledWith('mock-ai-draft', 'meal_draft', 'edited'))
  expect(reportDraftOutcome).toHaveBeenCalledTimes(1)
})

// Escape/back share ONE close path in the real app (LogFlowPage's onCancel/Escape both call the
// prop `onClose`, which is the PARENT removing this component — an unmount); a mock `onClose` in
// isolation does not itself unmount the tree, so `view.unmount()` is what actually exercises the
// signal these UI affordances all funnel into.
test('close-with-draft: unmounting with an unsaved AI draft reports "discarded"', async () => {
  const view = await landAiDraft()
  view.unmount()
  await vi.waitFor(() => expect(reportDraftOutcome).toHaveBeenCalledWith('mock-ai-draft', 'meal_draft', 'discarded'))
  expect(reportDraftOutcome).toHaveBeenCalledTimes(1)
})

test('a save already reported this draft — the ensuing unmount does not ALSO fire a discard', async () => {
  const view = await landAiDraft()
  await userEvent.click(screen.getByRole('button', { name: /Logolás · \+10 XP/ }))
  await vi.waitFor(() => expect(reportDraftOutcome).toHaveBeenCalledWith('mock-ai-draft', 'meal_draft', 'accepted'))
  view.unmount()
  await new Promise((r) => setTimeout(r, 20))
  expect(reportDraftOutcome).toHaveBeenCalledTimes(1) // exactly once per draft
})

test('closing with no AI draft at all reports nothing (no draftId to react to)', async () => {
  const view = render(<LogFlowPage onClose={vi.fn()} />, { wrapper: QueryWrapper })
  view.unmount()
  await new Promise((r) => setTimeout(r, 20))
  expect(reportDraftOutcome).not.toHaveBeenCalled()
})
