import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { KnowledgeFact } from '@/data/types'
import { RoladFacts } from './RoladFacts'

const fact = (id: string, over: Partial<KnowledgeFact> = {}): KnowledgeFact => ({
  id, text: `tény ${id}`, category: 'life', active: true, reinforced: 1, source: 'chat', owner: 'mezo',
  lastReinforcedAt: null, createdAt: `2026-08-${id.padStart(2, '0')}T10:00:00Z`, ...over,
})

const renderFacts = (facts: KnowledgeFact[], degraded = false) =>
  render(<MemoryRouter><RoladFacts facts={facts} degraded={degraded} /></MemoryRouter>)

describe('RoladFacts', () => {
  test('at most four of the freshest active facts, each a glass case in its owner’s accent', () => {
    const facts = ['1', '2', '3', '4', '5', '6'].map((id) => fact(id))
    facts[5] = fact('6', { owner: 'szunya' })
    facts[0] = fact('1', { active: false, createdAt: '2026-09-01T10:00:00Z' })
    const { container } = renderFacts(facts)
    const rows = container.querySelectorAll('[data-rolad-fact]')
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveClass('glass', 'tf-case', 'tf-c-lav')
    expect(within(rows[0] as HTMLElement).getByText('SZUNYA')).toBeInTheDocument()
    expect(screen.queryByText('tény 1')).not.toBeInTheDocument()
    expect(screen.getByText('5 AKTÍV')).toBeInTheDocument()
  })

  test('a user-authored fact says TŐLED, with its origin and date', () => {
    renderFacts([fact('3', { source: 'manual', owner: 'falat', createdAt: '2026-08-20T10:00:00Z' })])
    const row = screen.getByText('tény 3').closest('[data-rolad-fact]') as HTMLElement
    expect(within(row).getByText('TŐLED')).toBeInTheDocument()
    expect(row).toHaveClass('tf-c-gold')
    expect(row).toHaveTextContent(/kézzel · /)
  })

  test('the door opens the full Tények view with the real total', () => {
    renderFacts([fact('1'), fact('2', { active: false })])
    const door = screen.getByRole('link', { name: /Mind a 2 tény/ })
    expect(door).toHaveAttribute('href', '/mezo/knowledge?view=tenyek')
    expect(door).toHaveTextContent('kereséssel, forrással és Elhallgattatom-kapcsolóval')
  })

  test('hidden when the companion is off or no fact is active', () => {
    const { container, rerender } = renderFacts([fact('1')], true)
    expect(container).toBeEmptyDOMElement()
    rerender(<MemoryRouter><RoladFacts facts={[fact('1', { active: false })]} degraded={false} /></MemoryRouter>)
    expect(container).toBeEmptyDOMElement()
  })
})
