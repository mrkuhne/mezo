import { render, screen } from '@testing-library/react'
import { BrandRow } from '@/features/today/components/BrandRow'
import { RetaPhaseSection } from '@/features/today/components/RetaPhaseSection'
import { DateMesoHeader } from '@/features/today/components/DateMesoHeader'
import { today, user } from '@/data/today/today'

test('BrandRow shows the Mezo wordmark', () => {
  render(<BrandRow />)
  expect(screen.getByText('Mezo')).toBeInTheDocument()
})
test('RetaPhaseSection shows the D{n}/7 eyebrow and 7 segments', () => {
  const { container } = render(<RetaPhaseSection day={3} />)
  expect(screen.getByText('Retatrutide · D3/7')).toBeInTheDocument()
  expect(container.querySelectorAll('.reta-seg')).toHaveLength(7)
})
test('DateMesoHeader shows workout type and meso chips', () => {
  render(<DateMesoHeader today={today} user={user} />)
  expect(screen.getByText(/Pull Day/)).toBeInTheDocument()
  expect(screen.getByText(`Week ${user.weekInMeso} · Day ${user.dayInWeek}`)).toBeInTheDocument()
})
