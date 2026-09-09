// ============================================================
// Mezo · MesocyclePlannerPage — draft outcome signals (mezo-76f6), feature slug
// 'train_meso_plan'. `reportDraftOutcome` itself is mocked here — its own no-op/swallow/happy
// path contract is unit-tested in outcomeClient.test.ts; this file is about WHEN the planner
// decides to call it and with which outcome (accepted/edited on save, discarded on
// regenerate-over-an-unsaved-proposal or on leaving the planner).
// ============================================================
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'

const reportDraftOutcome = vi.hoisted(() => vi.fn())
vi.mock('@/data/aidraft/outcomeClient', () => ({ reportDraftOutcome }))

import { MesocyclePlannerPage } from '@/features/train/pages/MesocyclePlannerPage'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-02T10:00:00'))
  vi.stubEnv('VITE_USE_MOCK', 'true')
})
afterEach(() => {
  // Explicit BEFORE the mock is cleared: a test that leaves the planner mounted with an
  // unresolved proposal would otherwise have its own discard-on-unmount fire during the global
  // testing-library cleanup — which (registered outer-scope, so it runs AFTER this file's own
  // afterEach) would land the call in the NEXT test's count instead of this one's.
  cleanup()
  reportDraftOutcome.mockClear()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/mesocycles/new']}>
        <MesocyclePlannerPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Program generálása/ }))
  await screen.findByRole('textbox', { name: 'Mezociklus neve' })
}

test('accepted: saving a generated proposal untouched reports "accepted"', async () => {
  const user = userEvent.setup()
  setup()
  await generate(user)
  await user.click(screen.getByRole('button', { name: 'Mentés sablonként' }))
  await waitFor(() => expect(reportDraftOutcome).toHaveBeenCalledTimes(1))
  const [draftId, feature, outcome] = reportDraftOutcome.mock.calls[0]
  expect(typeof draftId).toBe('string')
  expect(feature).toBe('train_meso_plan')
  expect(outcome).toBe('accepted')
})

test('edited: a manual edit before saving reports "edited" for the SAME draftId', async () => {
  const user = userEvent.setup()
  setup()
  await generate(user)
  // Any program mutation flips wizardState's `dirty` — deleting an exercise is the composer's
  // own existing affordance for that.
  await user.click(screen.getAllByRole('button', { name: /· szerkesztés$/ })[0])
  await user.click(screen.getAllByRole('button', { name: /törlése$/ })[0])
  await user.click(screen.getByRole('button', { name: 'Vissza' }))

  await user.click(screen.getByRole('button', { name: 'Mentés sablonként' }))
  await waitFor(() => expect(reportDraftOutcome).toHaveBeenCalledTimes(1))
  expect(reportDraftOutcome.mock.calls[0][2]).toBe('edited')
})

test('regenerate over an unsaved proposal discards the OLD draftId and mints a new one', async () => {
  const user = userEvent.setup()
  setup()
  await generate(user)
  await user.click(screen.getByRole('button', { name: '↺ Újragenerálás' }))
  await waitFor(() => expect(reportDraftOutcome).toHaveBeenCalledTimes(1))
  expect(reportDraftOutcome.mock.calls[0][2]).toBe('discarded')
  const discardedId = reportDraftOutcome.mock.calls[0][0]

  // The regenerated proposal is itself a fresh, still-unresolved draft — saving it now reports
  // ACCEPTED for a DIFFERENT draftId than the one just discarded.
  await user.click(screen.getByRole('button', { name: 'Mentés sablonként' }))
  await waitFor(() => expect(reportDraftOutcome).toHaveBeenCalledTimes(2))
  expect(reportDraftOutcome.mock.calls[1][2]).toBe('accepted')
  expect(reportDraftOutcome.mock.calls[1][0]).not.toBe(discardedId)
})

test('regenerate over a MANUAL edit only discards after the confirm — cancelling the confirm reports nothing', async () => {
  const user = userEvent.setup()
  setup()
  await generate(user)
  await user.click(screen.getAllByRole('button', { name: /· szerkesztés$/ })[0])
  await user.click(screen.getAllByRole('button', { name: /törlése$/ })[0])
  await user.click(screen.getByRole('button', { name: 'Vissza' }))

  await user.click(screen.getByRole('button', { name: '↺ Újragenerálás' }))
  const warning = within(screen.getByText(/Kézzel szerkesztett napjaid vannak/).parentElement!)
  await user.click(warning.getByRole('button', { name: 'Mégse' })) // cancel the confirm itself
  expect(reportDraftOutcome).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: '↺ Újragenerálás' }))
  await user.click(within(screen.getByText(/Kézzel szerkesztett napjaid vannak/).parentElement!).getByRole('button', { name: 'Újragenerálás' }))
  await waitFor(() => expect(reportDraftOutcome).toHaveBeenCalledTimes(1))
  expect(reportDraftOutcome.mock.calls[0][2]).toBe('discarded')
})

test('discarded: unmounting the planner with an unsaved proposal reports "discarded"', async () => {
  const user = userEvent.setup()
  const view = setup()
  await generate(user)
  view.unmount()
  await waitFor(() => expect(reportDraftOutcome).toHaveBeenCalledTimes(1))
  expect(reportDraftOutcome.mock.calls[0][2]).toBe('discarded')
})

test('unmounting BEFORE ever generating reports nothing (no draftId to react to)', async () => {
  const view = setup()
  view.unmount()
  await new Promise((r) => setTimeout(r, 0))
  expect(reportDraftOutcome).not.toHaveBeenCalled()
})

test('unmounting AFTER a save does not ALSO fire a discard (exactly once per draft)', async () => {
  const user = userEvent.setup()
  const view = setup()
  await generate(user)
  await user.click(screen.getByRole('button', { name: 'Mentés sablonként' }))
  await waitFor(() => expect(reportDraftOutcome).toHaveBeenCalledTimes(1))
  view.unmount()
  await new Promise((r) => setTimeout(r, 0))
  expect(reportDraftOutcome).toHaveBeenCalledTimes(1)
})
