import { render, screen } from '@testing-library/react'
import { VolleyballCard } from '@/features/today/components/VolleyballCard'
import { VulnerabilityCard } from '@/features/today/components/VulnerabilityCard'

const session = { day: 'Csü', time: '19:30', duration: 90, court: 'BVSC', intensity: 'magas', role: 'edzés', today: true }

test('VolleyballCard renders null without a session', () => {
  const { container } = render(<VolleyballCard session={undefined} />)
  expect(container.firstChild).toBeNull()
})
test('VolleyballCard renders details + the demo AI note with a note prop (mock mode)', () => {
  render(<VolleyballCard session={session} note="Pull Day 17:00, Volleyball 19:30." />)
  expect(screen.getByText(/Sport · 19:30/)).toBeInTheDocument()
  expect(screen.getByText(/Stacked day/)).toBeInTheDocument()
})
test('VolleyballCard hides the AI note without a note prop (real mode)', () => {
  render(<VolleyballCard session={session} />)
  expect(screen.getByText(/Sport · 19:30/)).toBeInTheDocument()
  expect(screen.queryByText(/Stacked day/)).not.toBeInTheDocument()
})
test('VolleyballCard names a cross-training session Cross, not Röplabda (mezo-rhe5)', () => {
  render(<VolleyballCard session={{ ...session, sport: 'cross' }} />)
  expect(screen.getByText('Cross')).toBeInTheDocument()
  expect(screen.getByText('CROSS')).toBeInTheDocument()
  expect(screen.queryByText('Röplabda')).not.toBeInTheDocument()
})
test('VolleyballCard names a TRX session TRX (mezo-rhe5)', () => {
  render(<VolleyballCard session={{ ...session, sport: 'trx' }} />)
  // Both the type tag and the title read 'TRX' for this sport.
  expect(screen.getAllByText('TRX')).toHaveLength(2)
  expect(screen.queryByText('Röplabda')).not.toBeInTheDocument()
})
test('VolleyballCard defaults an unmarked session to Röplabda (Phase-1 mock default)', () => {
  render(<VolleyballCard session={session} />)
  expect(screen.getByText('Röplabda')).toBeInTheDocument()
})
test('VulnerabilityCard renders the warmer companion message', () => {
  render(<VulnerabilityCard />)
  expect(screen.getByText(/sebezhetőbb hangnem/)).toBeInTheDocument()
})
