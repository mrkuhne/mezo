import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FactCandidateCard } from '@/features/insights/components/FactCandidateCard'
import type { FactCandidate, KnowledgeFact } from '@/data/types'

const baseCandidate: FactCandidate = {
  id: 'c3', text: 'A röplabdát heti egy alkalomra ritkítod — csak szombaton jársz.',
  category: 'train', conflictsWithFactId: 'f4',
}
const conflictFact: KnowledgeFact = {
  id: 'f4', text: 'Volleyball: kedd + csütörtök + szombat', category: 'train', active: true,
  reinforced: 18, source: 'chat', lastReinforcedAt: '2026-08-09T18:00:00Z', createdAt: '2026-02-28T17:40:00Z',
}

describe('FactCandidateCard — konfliktus-jelzés (mezo-ms9a Task 12)', () => {
  // (a) konfliktusos seed-jelöltnél látszik a sor + checkbox bejelölve
  test('(a) conflictFact esetén megjelenik a figyelmeztető sor + bejelölt checkbox', () => {
    render(
      <FactCandidateCard candidate={baseCandidate} conflictFact={conflictFact} onDecide={() => {}} onToggleConflict={() => {}} />,
    )
    expect(screen.getByText(/Ellentmond ennek/)).toBeInTheDocument()
    expect(screen.getByText(/Volleyball: kedd \+ csütörtök \+ szombat/)).toBeInTheDocument()
    const checkbox = screen.getByLabelText('A régit kikapcsolom')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toBeChecked()
  })

  // (b) elfogadás → decide ÉS toggle(off) hívódik
  test('(b) elfogadás bejelölt checkbox mellett decide-ot ÉS onToggleConflict(f4, false)-t is hív', async () => {
    const onDecide = vi.fn()
    const onToggleConflict = vi.fn()
    render(
      <FactCandidateCard
        candidate={baseCandidate} conflictFact={conflictFact} onDecide={onDecide} onToggleConflict={onToggleConflict}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Elfogad' }))
    expect(onDecide).toHaveBeenCalledWith('accept')
    expect(onToggleConflict).toHaveBeenCalledWith('f4', false)
  })

  // (c) checkbox kivéve → csak decide
  test('(c) checkbox kikapcsolva mellett elfogadás csak decide-ot hív, toggle-t nem', async () => {
    const onDecide = vi.fn()
    const onToggleConflict = vi.fn()
    render(
      <FactCandidateCard
        candidate={baseCandidate} conflictFact={conflictFact} onDecide={onDecide} onToggleConflict={onToggleConflict}
      />,
    )
    await userEvent.click(screen.getByLabelText('A régit kikapcsolom'))
    await userEvent.click(screen.getByRole('button', { name: 'Elfogad' }))
    expect(onDecide).toHaveBeenCalledWith('accept')
    expect(onToggleConflict).not.toHaveBeenCalled()
  })

  // (d) elvetés → egyik sem (a toggle biztosan nem, még bejelölt checkbox mellett sem)
  test('(d) elvetés esetén onToggleConflict sosem hívódik, még bejelölt checkbox mellett sem', async () => {
    const onDecide = vi.fn()
    const onToggleConflict = vi.fn()
    render(
      <FactCandidateCard
        candidate={baseCandidate} conflictFact={conflictFact} onDecide={onDecide} onToggleConflict={onToggleConflict}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Elvet' }))
    expect(onDecide).toHaveBeenCalledWith('reject')
    expect(onToggleConflict).not.toHaveBeenCalled()
  })

  // (e) konfliktus-mentes jelöltnél semmi nem látszik
  test('(e) conflictFact hiányában (null) nem renderel figyelmeztetést vagy checkboxot', () => {
    render(
      <FactCandidateCard candidate={{ ...baseCandidate, conflictsWithFactId: null }} conflictFact={null} onDecide={() => {}} />,
    )
    expect(screen.queryByText(/Ellentmond ennek/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('A régit kikapcsolom')).not.toBeInTheDocument()
  })

  // extra: refine-accept ("Mentés") is accept-útvonalnak számít, bejelölt checkboxnál toggle-öl
  test('(extra) Pontosít + Mentés bejelölt checkbox mellett toggle-t is hív', async () => {
    const onDecide = vi.fn()
    const onToggleConflict = vi.fn()
    render(
      <FactCandidateCard
        candidate={baseCandidate} conflictFact={conflictFact} onDecide={onDecide} onToggleConflict={onToggleConflict}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Pontosít' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(onDecide).toHaveBeenCalledWith('refine', baseCandidate.text)
    expect(onToggleConflict).toHaveBeenCalledWith('f4', false)
  })
})

// mezo-hq44: a konfliktus-sor ⚠-ja a közös warning-ikon lett; a mondat változatlan.
test('mezo-hq44: az „Ellentmond ennek" sor warning-ikont rajzol, nem ⚠ glifát', () => {
  render(
    <FactCandidateCard candidate={baseCandidate} conflictFact={conflictFact} onDecide={() => {}} onToggleConflict={() => {}} />,
  )
  const row = screen.getByText(/Ellentmond ennek/)
  expect(row.querySelector('svg')).toBeTruthy()
  expect(row.textContent).not.toMatch(/⚠/)
})
