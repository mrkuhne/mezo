import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  // Folyadék (mezo-n4wf5.3): one hero, then five numbered cards in the prototype's order.
  test('the five numbered sections stand in order under the hero', () => {
    const { container } = render(
      <InterviewStep state={initialWizardState('2026-09-07')} dispatch={vi.fn()} onGenerate={vi.fn()} generating={false} />,
    )
    expect(screen.getByText('Mikor edzel — és mire gyúrsz?')).toBeInTheDocument()
    const heads = Array.from(container.querySelectorAll('h2.fo-sec')).map((h) => h.textContent)
    expect(heads).toEqual(['1Edzésnapok · 4 nap', '2Hossz', '3A célod · opcionális', '4Fókusz · max 2 hangsúly', '5Ami magától megy'])
  })

  test('the hero draws the plan as one vessel per week: the peak marked, the rest week hatched', () => {
    const { container } = render(
      <InterviewStep state={initialWizardState('2026-09-07')} dispatch={vi.fn()} onGenerate={vi.fn()} generating={false} />,
    )
    const weeks = container.querySelectorAll('.fo-hero .fo-tubes .fo-vial')
    expect(weeks).toHaveLength(6)
    expect(weeks[4]).toHaveTextContent('5. hétcsúcs')
    expect(weeks[5]).toHaveClass('hatch')
    expect(weeks[5]).toHaveTextContent('6. hétpihenő')
    expect(screen.getByText('6 hét = 5 emelkedő hét + 1 pihenőhét')).toBeInTheDocument()
    // the plain words replaced the jargon everywhere on the screen
    expect(container.textContent).not.toMatch(/rámpa|deload|plafon|blokk|Emphasize|Maintain/i)
  })

  test('the generate CTA switches label and disables while generating', () => {
    const state = initialWizardState('2026-09-07')
    const dispatch = vi.fn()
    const { rerender, container } = render(
      <InterviewStep state={state} dispatch={dispatch} onGenerate={vi.fn()} generating={false} />,
    )
    const idleBtn = screen.getByRole('button', { name: 'Program generálása' })
    expect(idleBtn).toBeEnabled()
    // the one primary action floats in the page's foot
    expect(container.querySelector('.fo-foot')).toContainElement(idleBtn)
    expect(idleBtn.textContent).not.toMatch(/✨/)

    rerender(<InterviewStep state={state} dispatch={dispatch} onGenerate={vi.fn()} generating />)
    const busyBtn = screen.getByRole('button', { name: 'Mezo dolgozik…' })
    expect(busyBtn).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Program generálása' })).not.toBeInTheDocument()
  })

  test('a failed first generation stands in the hero as an alert with its retry', async () => {
    const user = userEvent.setup()
    const onGenerate = vi.fn()
    const { container } = render(
      <InterviewStep state={initialWizardState('2026-09-07')} dispatch={vi.fn()} onGenerate={onGenerate} generating={false} failed />,
    )
    const alert = screen.getByRole('alert')
    expect(container.querySelector('.fo-hero')).toContainElement(alert)
    expect(alert).toHaveTextContent('Nem sikerült a generálás — próbáld újra.')
    await user.click(screen.getByRole('button', { name: '↺ Újrapróbálom' }))
    expect(onGenerate).toHaveBeenCalledTimes(1)
  })
})
