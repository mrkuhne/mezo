import { render } from '@testing-library/react'
import { MealTimingStrip } from './MealTimingStrip'

const inWindow = { eatenAt: '19:00', windowFrom: '17:00', windowTo: '22:00', slotLabel: 'vacsora' }

it('a pontot a nap 0–24 h tengelyén helyezi el (19:00 → 79.2%)', () => {
  const { container } = render(<MealTimingStrip timing={inWindow} />)
  const dot = container.querySelector('.sb-tline .dot') as HTMLElement
  expect(dot.style.left).toBe('79.2%')
})

it('az ablakot kitöltött sávként rajzolja, nem körvonalként', () => {
  const { container } = render(<MealTimingStrip timing={inWindow} />)
  const band = container.querySelector('.sb-tline .band') as HTMLElement
  expect(band.style.left).toBe('70.8%')
  expect(band.style.width).toBe('20.8%')
})

it('ablakon kívül korall pontot és hidat rajzol az ablak széléig', () => {
  const { container } = render(<MealTimingStrip
    timing={{ ...inWindow, eatenAt: '23:35' }} />)
  expect(container.querySelector('.sb-tline .dot')).toHaveClass('is-miss')
  const link = container.querySelector('.sb-tline .miss-lnk') as HTMLElement
  // 22:00-tól 23:35-ig — a híd az ablak végétől a pontig tart
  expect(link.style.left).toBe('91.7%')
})

it('ablak nélküli nasira halvány teljes sávot rajzol, nem hamis „mindig tökéletes”-t', () => {
  const { container } = render(<MealTimingStrip
    timing={{ eatenAt: '15:30', windowFrom: null, windowTo: null, slotLabel: 'nasi' }} />)
  const band = container.querySelector('.sb-tline .band') as HTMLElement
  expect(band).toHaveClass('is-any')
  expect(container.querySelector('.sb-tline .dot')).not.toHaveClass('is-miss')
})

it('a sáv aria-hidden — a szöveges igazságot a tény-chip hordozza', () => {
  const { container } = render(<MealTimingStrip timing={inWindow} />)
  expect(container.querySelector('.sb-tline')).toHaveAttribute('aria-hidden', 'true')
})
