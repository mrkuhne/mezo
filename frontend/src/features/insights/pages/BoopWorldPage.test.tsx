import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { BoopWorldPage } from '@/features/insights/pages/BoopWorldPage'

vi.mock('@/features/character/pages/KarakterHubPage', () => ({
  KarakterHubPage: ({ embedded }: { embedded?: boolean }) => <div>{embedded ? 'Meglévő csapatfolyam' : 'Dupla fejléc'}</div>,
}))

it('uses the existing council feed and keeps original tools one step away', () => {
  render(<MemoryRouter><BoopWorldPage /></MemoryRouter>, { wrapper: QueryWrapper })
  expect(screen.getByText('Meglévő csapatfolyam')).toBeInTheDocument()
  expect(screen.queryByText('Dupla fejléc')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Összes funkció' })).toHaveAttribute('href', '/mezo/menu')
  expect(screen.getByRole('link', { name: 'Beszélgetés Booppal' })).toHaveAttribute('href', '/mezo/chat')
  expect(screen.queryByRole('button', { name: 'Új bejegyzés' })).not.toBeInTheDocument()
})
