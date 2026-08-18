import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeExplainer, EXPLAINER_STORAGE_KEY } from '@/features/insights/components/KnowledgeExplainer'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test('elsőre nyitva van és elmagyarázza a top-10 korlátot', () => {
  render(<KnowledgeExplainer />)
  expect(screen.getByText(/Csak a 10 legerősebb bekapcsolt tény fér be/)).toBeInTheDocument()
})

test('összecsukható, és az állapot túléli az újrarenderelést', async () => {
  const { unmount } = render(<KnowledgeExplainer />)
  await userEvent.click(screen.getByRole('button', { name: /Hogyan működik a tudástár/ }))
  expect(screen.queryByText(/Csak a 10 legerősebb bekapcsolt tény fér be/)).not.toBeInTheDocument()
  expect(localStorage.getItem(EXPLAINER_STORAGE_KEY)).toBe('1')

  unmount()
  render(<KnowledgeExplainer />)
  expect(screen.queryByText(/Csak a 10 legerősebb bekapcsolt tény fér be/)).not.toBeInTheDocument()
})

test('letiltott localStorage mellett is renderel (alapból nyitva) és a kapcsoló is működik (mezo-9ryh review fix)', async () => {
  const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError')
  })
  const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError')
  })

  render(<KnowledgeExplainer />)
  expect(screen.getByText(/Csak a 10 legerősebb bekapcsolt tény fér be/)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: /Hogyan működik a tudástár/ }))
  expect(screen.queryByText(/Csak a 10 legerősebb bekapcsolt tény fér be/)).not.toBeInTheDocument()

  getSpy.mockRestore()
  setSpy.mockRestore()
})
