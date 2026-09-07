import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { InterviewStep } from '@/features/train/wizard/InterviewStep'
import { initialWizardState } from '@/features/train/wizard/wizardState'

// mezo-yty6 fix round 1: the generate CTA's `generating` state had no direct test. It is
// unit-tested here (rather than through the real useMesoPlanGenerate mutation in
// MesocyclePlannerPage.test.tsx) because the mock proposal resolves fast enough that
// TanStack Query's mutation batches its 'pending' and 'success' notifications into a single
// React render — the transient state is not observably renderable through the real hook,
// with fireEvent or otherwise (verified empirically). InterviewStep receives `generating`
// as a prop, so it is independently and deterministically testable here.
describe('InterviewStep', () => {
  test('the generate CTA switches label and disables while generating', () => {
    const state = initialWizardState('2026-09-07')
    const dispatch = vi.fn()
    const { rerender } = render(
      <InterviewStep state={state} dispatch={dispatch} onGenerate={vi.fn()} generating={false} />,
    )
    const idleBtn = screen.getByRole('button', { name: '✨ Program generálása' })
    expect(idleBtn).toBeEnabled()

    rerender(<InterviewStep state={state} dispatch={dispatch} onGenerate={vi.fn()} generating />)
    const busyBtn = screen.getByRole('button', { name: 'Mezo dolgozik…' })
    expect(busyBtn).toBeDisabled()
    expect(screen.queryByRole('button', { name: '✨ Program generálása' })).not.toBeInTheDocument()
  })
})
