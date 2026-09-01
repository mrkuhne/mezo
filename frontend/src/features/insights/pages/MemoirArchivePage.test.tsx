import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { MemoirArchivePage } from '@/features/insights/pages/MemoirArchivePage'

const renderPage = () =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/mezo/memoir/archivum']}>
        <Routes>
          <Route path="/mezo/memoir/archivum" element={<MemoirArchivePage />} />
          <Route path="/mezo/memoir/:weekStart" element={<div data-testid="chapter-probe" />} />
          <Route path="/mezo/memoir" element={<div data-testid="memoir-probe" />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )

describe('MemoirArchivePage (mock mode, F7.5)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the month-grouped timeline with full-card chapters', () => {
    renderPage()
    expect(screen.getByText('Memoár · archívum')).toBeInTheDocument()
    // 3 months of story in the seed
    expect(screen.getByText('Május')).toBeInTheDocument()
    expect(screen.getByText('Április')).toBeInTheDocument()
    expect(screen.getByText('Március')).toBeInTheDocument()
    // the whole card is one tap target with the Fraunces title on it
    expect(screen.getByRole('button', { name: /Egy hét amikor a tested megtanult várni/ })).toBeInTheDocument()
  })

  test('a card navigates to its chapter page — no modal', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Amikor az alvás előre szólt/ }))
    expect(screen.getByTestId('chapter-probe')).toBeInTheDocument()
  })

  test('the back chip returns to the Memoár page', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(screen.getByTestId('memoir-probe')).toBeInTheDocument()
  })
})
