import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GrowthHero } from '@/features/me/components/GrowthHero'

const base = { totalXp: 18420, level: { level: 7, xpInLevel: 340, xpForNext: 500 }, disciplinePct: 84, consistencyWeeks: 6 }

test('renders the XP number (HU grouped), Szint, Fegyelem and Ritmus rows', () => {
  const { container } = render(<GrowthHero {...base} />)
  expect(screen.getByText('18 420')).toBeInTheDocument()
  expect(screen.getByText('Szint 7')).toBeInTheDocument()
  expect(screen.getByText('340')).toBeInTheDocument()
  expect(screen.getByText('/ 500')).toBeInTheDocument()
  expect(screen.getByText('84%')).toBeInTheDocument()
  expect(screen.getByText('6')).toBeInTheDocument()
  expect(container.querySelector('.gr-tbar i.gold')?.getAttribute('style')).toContain('--w: 68%')
  const dots = container.querySelectorAll('.gr-wdots i')
  expect(dots).toHaveLength(8)
  expect(container.querySelectorAll('.gr-wdots i.on')).toHaveLength(6)
  expect(dots[7].classList.contains('now')).toBe(true)
})

test('honest states: null discipline hides the Fegyelem row, null level hides the Szint row', () => {
  render(<GrowthHero {...base} level={null} disciplinePct={null} />)
  expect(screen.queryByText('Fegyelem')).not.toBeInTheDocument()
  expect(screen.queryByText(/^Szint/)).not.toBeInTheDocument()
  expect(screen.getByText('Ritmus')).toBeInTheDocument()
})

test('0 weeks: eight empty dots and "0 hét"', () => {
  const { container } = render(<GrowthHero {...base} consistencyWeeks={0} />)
  expect(container.querySelectorAll('.gr-wdots i.on')).toHaveLength(0)
  expect(screen.getByText('0')).toBeInTheDocument()
})

test('disciplinePct is clamped to 0-100 for both the bar and the text', () => {
  const { container: negative } = render(<GrowthHero {...base} disciplinePct={-5} />)
  expect(negative.querySelector('.gr-tbar i.lav')?.getAttribute('style')).toContain('--w: 0%')
  expect(within(negative).getByText('0%')).toBeInTheDocument()

  const { container: over } = render(<GrowthHero {...base} disciplinePct={150} />)
  expect(over.querySelector('.gr-tbar i.lav')?.getAttribute('style')).toContain('--w: 100%')
  expect(within(over).getByText('100%')).toBeInTheDocument()
})
