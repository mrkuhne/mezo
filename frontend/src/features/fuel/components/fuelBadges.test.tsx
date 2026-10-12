// The two small Fuel badges in the Folyadék look (F5, mezo-n4wf5.5) — rewritten to the new truth: the source badge is the
// kit's quiet status pill (no own recipe, no glass chip), the NOVA mark is a coloured dot with its group as the hover title.
import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { setLang } from '@/shared/i18n'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { NovaDot } from '@/features/fuel/components/NovaDot'

afterEach(() => setLang('hu', { persist: false }))

test('SourceBadge shows the source label as the kit status pill', () => {
  const { container } = render(<SourceBadge source="kifli.hu" />)
  const pill = screen.getByText('kifli.hu')
  expect(pill).toHaveClass('fo-st', 'q')
  expect(container.querySelector('.glass, [class*="fkx-"], [class*="fkk-"]')).toBeNull()
})

test('SourceBadge: a shop name is a proper name, the two own words follow the language on the same node', () => {
  const { container } = render(<><SourceBadge source="manual" /><SourceBadge source="tesco.hu" /></>)
  const [manual, shop] = [...container.querySelectorAll('.fo-st')]
  expect(manual).toHaveTextContent('Saját bevitel')
  act(() => setLang('en', { persist: false }))
  expect(container.querySelectorAll('.fo-st')[0]).toBe(manual)
  expect(manual.textContent).not.toBe('Saját bevitel')
  expect(manual.textContent).toMatch(/^[A-Za-z ]+$/)
  expect(shop).toHaveTextContent('tesco.hu')
})

test('NovaDot labels the NOVA group, in its colour, with the group name as the title', () => {
  const { container } = render(<NovaDot nova={3} />)
  expect(screen.getByText('NOVA 3')).toBeInTheDocument()
  const dot = container.querySelector('.fg-nova') as HTMLElement
  expect(dot).toHaveAttribute('title', 'Feldolgozott')
  expect(dot.style.getPropertyValue('--c')).toBe('var(--fo-warn)')
  expect(dot.querySelector('i')).toHaveAttribute('aria-hidden', 'true')
})
