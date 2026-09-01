import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { MemoirChapterPage } from '@/features/insights/pages/MemoirChapterPage'

const renderAt = (weekStart: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/mezo/memoir/${weekStart}`]}>
        <Routes>
          <Route path="/mezo/memoir/archivum" element={<div data-testid="archive-probe" />} />
          <Route path="/mezo/memoir/:weekStart" element={<MemoirChapterPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )

describe('MemoirChapterPage (mock mode, F7.5)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the chapter with paragraph-split body and anchors', () => {
    renderAt('2026-05-04')
    expect(screen.getByText('Amikor az alvás előre szólt')).toBeInTheDocument()
    // body split on \n\n → two paragraphs
    expect(screen.getByText(/Kedd éjjel öt óra negyven/)).toBeInTheDocument()
    expect(screen.getByText(/Nem hiba volt, hanem adat/)).toBeInTheDocument()
    expect(screen.getByText('Miből íródott')).toBeInTheDocument()
    expect(screen.getByText(/alvás → edzésminőség/)).toBeInTheDocument()
  })

  test('the pager walks the shelf order and dries up at the ends', () => {
    renderAt('2026-05-11') // the newest chapter
    expect(screen.queryByText(/következő/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /előző/ }))
    expect(screen.getByText('Amikor az alvás előre szólt')).toBeInTheDocument()
    // now both directions exist
    expect(screen.getByText(/következő/)).toBeInTheDocument()
  })

  test('the oldest chapter has no előző tile', () => {
    renderAt('2026-03-30')
    expect(screen.getByText('A próbahét')).toBeInTheDocument()
    expect(screen.queryByText(/előző/)).not.toBeInTheDocument()
    expect(screen.getByText(/következő/)).toBeInTheDocument()
  })

  test('an unknown week renders the honest missing state', () => {
    renderAt('2031-01-06')
    expect(screen.getByText(/Ez a fejezet nincs meg/)).toBeInTheDocument()
  })

  test('the back chip returns to the archive', () => {
    renderAt('2026-05-04')
    fireEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(screen.getByTestId('archive-probe')).toBeInTheDocument()
  })
})
