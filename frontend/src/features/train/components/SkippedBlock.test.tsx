import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import { SkippedBlock } from '@/features/train/components/SkippedBlock'

function sk(over: Partial<PlannedSkip> = {}): PlannedSkip {
  return {
    id: 's1', kind: 'GYM', date: '2026-09-29', reasonCategory: 'NONE', reasonText: null, source: 'USER',
    serious: false, freePass: true, excused: true, ...over,
  }
}

const hrefs = (el: Element) => [...el.querySelectorAll('use')].map((u) => u.getAttribute('href'))

test('no reason: t-skip icon, „ok nélkül", the free-pass shield, „Okot adok"', () => {
  const onReason = vi.fn()
  const { container } = render(<SkippedBlock skip={sk()} onReason={onReason} onUndo={() => {}} />)
  expect(screen.getByText('Kihagyva · ok nélkül')).toBeInTheDocument()
  expect(screen.getByText('A heti szabadjegyed fedezi — a sorozatod marad.')).toBeInTheDocument()
  const block = container.querySelector('.trm-skipd')!
  expect(block).toHaveClass('glass')
  expect(hrefs(block)).toEqual(['#t-skip', '#t-shield'])
  fireEvent.click(screen.getByRole('button', { name: 'Okot adok' }))
  expect(onReason).toHaveBeenCalled()
})

test('with a reason: its icon, the label, „Másik ok"; inner = flat (no glass in glass)', () => {
  const onUndo = vi.fn()
  const { container } = render(
    <SkippedBlock inner skip={sk({ reasonCategory: 'ILLNESS', serious: true, freePass: false })} onReason={() => {}} onUndo={onUndo} />,
  )
  expect(screen.getByText('Kihagyva · Beteg vagyok')).toBeInTheDocument()
  expect(screen.getByText('Nem számít mulasztásnak. Jobbulást!')).toBeInTheDocument()
  const block = container.querySelector('.trm-skipd')!
  expect(block).not.toHaveClass('glass')
  expect(block).toHaveClass('is-in')
  expect(hrefs(block)).toEqual(['#t-ill'])
  expect(screen.getByRole('button', { name: 'Másik ok' })).toBeInTheDocument()
  const undo = screen.getByRole('button', { name: 'Visszavonom' })
  expect(hrefs(undo)).toEqual(['#t-repeat'])
  fireEvent.click(undo)
  expect(onUndo).toHaveBeenCalled()
})
