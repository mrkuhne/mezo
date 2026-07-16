import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { InsightsSubNav } from '@/features/insights/pages/InsightsSubNav'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><InsightsSubNav /></MemoryRouter>)
}

describe('InsightsSubNav (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders all seven pills with verbatim labels', () => {
    renderAt('/insights')
    for (const label of ['Minták', 'Heti', 'Memoár', 'Tudástár', 'Chat', 'Előrejelzések', 'Kísérletek']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  test('marks the active sub-view from the URL', () => {
    const { container } = renderAt('/insights/memoir')
    expect(container.querySelector('.np-pill.on')).toHaveTextContent('Memoár')
  })
})

describe('InsightsSubNav (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('shows all seven tabs — nothing hidden (Experiments un-ghosted at P2)', () => {
    renderAt('/insights')
    for (const label of ['Minták', 'Heti', 'Memoár', 'Tudástár', 'Chat', 'Előrejelzések', 'Kísérletek']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  test('Minták (index) is active only on exact /insights', () => {
    const { container } = renderAt('/insights/chat')
    expect(container.querySelector('.np-pill.on')).toHaveTextContent('Chat')
  })
})
