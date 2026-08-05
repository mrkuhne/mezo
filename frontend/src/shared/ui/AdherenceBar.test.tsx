import { render, screen } from '@testing-library/react'
import { AdherenceBar } from '@/shared/ui/AdherenceBar'

const SEGMENTS = [
  { name: 'Fehérje', fraction: 0.22, color: 'var(--macro-protein)', value: '22g' },
  { name: 'Szénhidrát', fraction: 0.28, color: 'var(--macro-carbs)', value: '38g' },
  { name: 'Zsír', fraction: 0.16, color: 'var(--macro-fat)', value: '11g' },
]

test('renders the track with an accessible summary + legend entries', () => {
  render(<AdherenceBar segments={SEGMENTS} />)
  expect(screen.getByRole('img', { name: 'Fehérje 22%, Szénhidrát 28%, Zsír 16%' })).toBeInTheDocument()
  expect(screen.getByText('Fehérje')).toBeInTheDocument()
  expect(screen.getByText('38g')).toBeInTheDocument()
})

test('over-100% stacks are clamped so the track never overflows', () => {
  const { container } = render(
    <AdherenceBar
      legend={false}
      segments={[
        { name: 'a', fraction: 0.8, color: 'red' },
        { name: 'b', fraction: 0.6, color: 'blue' },
      ]}
    />,
  )
  const [a, b] = Array.from(container.querySelectorAll<HTMLElement>('.adher-track > div'))
  expect(a.style.width).toBe('80%')
  expect(b.style.width).toBe('20%')
})
