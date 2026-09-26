import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FactCandidateCard } from '@/features/insights/components/FactCandidateCard'
import type { FactCandidate, KnowledgeFact } from '@/data/types'

const baseCandidate: FactCandidate = {
  id: 'c3', text: 'A röplabdát heti egy alkalomra ritkítod — csak szombaton jársz.',
  category: 'train', owner: 'mocor', source: 'chat', createdAt: '2026-08-22T07:00:00Z',
  evidence: null, weekStart: null, conflictsWithFactId: 'f4',
}
const conflictFact: KnowledgeFact = {
  id: 'f4', text: 'Volleyball: kedd + csütörtök + szombat', category: 'train', active: true,
  reinforced: 18, source: 'chat', owner: 'mocor',
  lastReinforcedAt: '2026-08-09T18:00:00Z', createdAt: '2026-02-28T17:40:00Z',
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
    await userEvent.click(screen.getByRole('button', { name: 'Igen, jegyezd meg' }))
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
    await userEvent.click(screen.getByRole('button', { name: 'Igen, jegyezd meg' }))
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
    await userEvent.click(screen.getByRole('button', { name: 'Nem igaz' }))
    expect(onDecide).toHaveBeenCalledWith('reject')
    expect(onToggleConflict).not.toHaveBeenCalled()
  })

  // (f) snooze → decide-ot hívja, de a toggle-t sosem, még bejelölt checkbox mellett sem
  test('(f) „Most ne" onDecide(\'snooze\')-t hív, onToggleConflict-ot sosem, még bejelölt checkbox mellett sem', async () => {
    const onDecide = vi.fn()
    const onToggleConflict = vi.fn()
    render(
      <FactCandidateCard
        candidate={baseCandidate} conflictFact={conflictFact} onDecide={onDecide} onToggleConflict={onToggleConflict}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Most ne' }))
    expect(onDecide).toHaveBeenCalledWith('snooze')
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

  // extra: refine-accept ("Így jegyezd meg") is accept-útvonalnak számít, bejelölt checkboxnál toggle-öl
  test('(extra) Pontosítom + Így jegyezd meg bejelölt checkbox mellett toggle-t is hív', async () => {
    const onDecide = vi.fn()
    const onToggleConflict = vi.fn()
    render(
      <FactCandidateCard
        candidate={baseCandidate} conflictFact={conflictFact} onDecide={onDecide} onToggleConflict={onToggleConflict}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Pontosítom' }))
    await userEvent.click(screen.getByRole('button', { name: 'Így jegyezd meg' }))
    expect(onDecide).toHaveBeenCalledWith('refine', baseCandidate.text)
    expect(onToggleConflict).toHaveBeenCalledWith('f4', false)
  })
})

describe('FactCandidateCard — byline (U9b Task 8, mezo-zpxv7)', () => {
  test('a byline "<Csapattag> hozta · <mikor>" alakot mutat', () => {
    render(
      <FactCandidateCard
        candidate={{ ...baseCandidate, owner: 'falat', createdAt: new Date().toISOString() }}
        onDecide={() => {}}
      />,
    )
    expect(screen.getByText('Falat hozta · ma')).toBeInTheDocument()
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
