import { render, screen } from '@testing-library/react'
import { VolleyballCard } from '@/features/today/components/VolleyballCard'
import { VulnerabilityCard } from '@/features/today/components/VulnerabilityCard'

test('VolleyballCard renders null without a session', () => {
  const { container } = render(<VolleyballCard session={undefined} />)
  expect(container.firstChild).toBeNull()
})
test('VolleyballCard renders details with a session', () => {
  render(<VolleyballCard session={{ day: 'Csü', time: '19:30', duration: 90, court: 'BVSC', intensity: 'magas', role: 'edzés', today: true }} />)
  expect(screen.getByText(/Sport · 19:30/)).toBeInTheDocument()
  expect(screen.getByText(/Stacked day/)).toBeInTheDocument()
})
test('VulnerabilityCard renders the warmer companion message', () => {
  render(<VulnerabilityCard />)
  expect(screen.getByText(/sebezhetőbb hangnem/)).toBeInTheDocument()
})
