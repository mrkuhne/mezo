import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ComebackPill, comebackLine, comebackPillLabel } from '@/features/train/components/ComebackPill'

const EX = [
  { id: 'e1', name: 'Húzódzkodás', sets: 3 },
  { id: 'e2', name: 'Evezés rúddal', sets: 2 },
]

test('pill label „VISSZATÉRŐ EDZÉS · k/N"', () => {
  expect(comebackPillLabel({ index: 1, total: 2 })).toBe('VISSZATÉRŐ EDZÉS · 1/2')
  expect(comebackPillLabel({ index: 2, total: 2 })).toBe('VISSZATÉRŐ EDZÉS · 2/2')
})

test('index 1: fewer sets and ~10% less weight; index 2: fewer sets, the weight does not rise', () => {
  expect(comebackLine({ index: 1 })).toBe('Könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly')
  expect(comebackLine({ index: 2 })).toBe('Könnyített: harmadával kevesebb sorozat, a súly nem nő')
})

test('the note: t-sprout, the line, the served set counts, Kikapcsolom a könnyítést', () => {
  const onWaive = vi.fn()
  const { container } = render(<ComebackPill comeback={{ index: 1, total: 2, mode: 'RAMP' }} exercises={EX} onWaive={onWaive} />)
  expect(container.querySelector('.trm-cbnote use')?.getAttribute('href')).toBe('#t-sprout')
  expect(screen.getByText('Könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly')).toBeInTheDocument()
  expect([...container.querySelectorAll('.trm-cbsets > div')].map((d) => d.textContent)).toEqual(['Húzódzkodás3 szett', 'Evezés rúddal2 szett'])
  fireEvent.click(screen.getByRole('button', { name: 'Kikapcsolom a könnyítést' }))
  expect(onWaive).toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Mégsem vagyok jól' })).toBeNull()
})

test('„Mégsem vagyok jól" only when the return can still be undone', () => {
  const onUndo = vi.fn()
  render(<ComebackPill comeback={{ index: 2, total: 2, mode: 'RAMP' }} exercises={EX} onWaive={() => {}} onUndo={onUndo} />)
  fireEvent.click(screen.getByRole('button', { name: 'Mégsem vagyok jól' }))
  expect(onUndo).toHaveBeenCalled()
})
