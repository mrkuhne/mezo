import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { InsightsSubNav } from '@/features/insights/pages/InsightsSubNav'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><InsightsSubNav /></MemoryRouter>)
}

describe('InsightsSubNav (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders all seven sub-nav items with verbatim labels', () => {
    renderAt('/insights')
    for (const label of ['Patterns', 'Weekly', 'Memoir', 'Knowledge', 'Chat', 'Predictions', 'Experiments']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  test('marks the active sub-view from the URL', () => {
    const { container } = renderAt('/insights/memoir')
    expect(container.querySelector('.subnav-item.active')).toHaveTextContent('Memoir')
  })
})

describe('InsightsSubNav (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('shows all seven tabs — nothing hidden (Experiments un-ghosted at P2)', () => {
    renderAt('/insights')
    for (const label of ['Patterns', 'Weekly', 'Memoir', 'Knowledge', 'Chat', 'Predictions', 'Experiments']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  test('Patterns (index) is active only on exact /insights', () => {
    const { container } = renderAt('/insights/chat')
    expect(container.querySelector('.subnav-item.active')).toHaveTextContent('Chat')
  })
})
