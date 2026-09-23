import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { TeamPage } from '@/features/insights/pages/TeamPage'

const renderPage = () => render(<MemoryRouter><TeamPage /></MemoryRouter>, { wrapper: QueryWrapper })

describe('TeamPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('öt üveg-sor a szobákba, a Szkeptikus csak magyarázatként, plusz a Gépterem-ajtó', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'A csapat' })).toBeInTheDocument()
    const rooms = screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/mezo/csapat/'))
    expect(rooms.map(a => a.getAttribute('href'))).toEqual(
      ['/mezo/csapat/szunya', '/mezo/csapat/mocor', '/mezo/csapat/falat', '/mezo/csapat/deru', '/mezo/csapat/mezo'])
    for (const a of rooms) expect(a.classList.contains('glass')).toBe(true)
    expect(within(rooms[2]).getByText('Falat · étkezés')).toBeInTheDocument()
    expect(screen.getByText(/nem posztol/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Gépterem/ })).toHaveAttribute('href', '/mezo/karakter/gepterem')
  })

  test('üres dossziénál a jelvény őszintén „ismerkedik”', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'A csapat' })
    expect(screen.getAllByText('ismerkedik')).toHaveLength(5)
  })
})
