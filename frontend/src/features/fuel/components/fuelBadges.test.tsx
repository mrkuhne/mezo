import { render, screen } from '@testing-library/react'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { NovaDot } from '@/features/fuel/components/NovaDot'

test('SourceBadge shows the source label', () => {
  render(<SourceBadge source="kifli.hu" />)
  expect(screen.getByText('kifli.hu')).toBeInTheDocument()
})
test('NovaDot labels the NOVA group', () => {
  render(<NovaDot nova={3} />)
  expect(screen.getByText('NOVA 3')).toBeInTheDocument()
})
