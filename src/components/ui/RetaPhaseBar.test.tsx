import { render } from '@testing-library/react'
import { RetaPhaseBar } from './RetaPhaseBar'

test('renders 7 segments', () => {
  const { container } = render(<RetaPhaseBar day={3} />)
  expect(container.querySelectorAll('.reta-seg')).toHaveLength(7)
})
test('marks the current day active and earlier days past', () => {
  const { container } = render(<RetaPhaseBar day={3} />)
  const segs = container.querySelectorAll('.reta-seg')
  expect(segs[2].className).toContain('active')
  expect(segs[0].className).toContain('past')
  expect(segs[4].className).not.toContain('active')
  expect(segs[4].className).not.toContain('past')
})
