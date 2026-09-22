import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, test, expect } from 'vitest'
import { KnowledgeNodePage } from '@/features/insights/pages/KnowledgeNodePage'
const archive = vi.fn()
vi.mock('@/data/hooks', () => ({
  useKnowledgeGraphNodes: () => ({ nodes: [{ id: 'node-1', kind: 'GOAL', title: 'Erősebb hát', summary: 'Fokozatos terhelés.', topEdges: ['Edzés → regeneráció'], updatedAt: '2026-09-19' }], isPending: false, isError: false }),
  useKnowledgeGraphActions: () => ({ archive, pending: false }),
}))
test('full page preserves category return context and existing archive action', async () => {
  render(<MemoryRouter initialEntries={['/mezo/knowledge/node/node-1?view=kategoriak&kind=GOAL&start=2026-09-14']}><Routes><Route path="/mezo/knowledge/node/:id" element={<KnowledgeNodePage />} /></Routes></MemoryRouter>)
  expect(screen.getByText('Fokozatos terhelés.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Tudástár/ })).toHaveAttribute('href', '/mezo/knowledge?view=kategoriak&kind=GOAL&start=2026-09-14')
  await userEvent.click(screen.getByRole('button', { name: 'Archivál' }))
  expect(archive).toHaveBeenCalledWith('node-1')
})
