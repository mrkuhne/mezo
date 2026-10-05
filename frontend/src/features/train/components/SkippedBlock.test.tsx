import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import { KimeloInner, RecoveryBlock, RunRampInner, SkippedBlock } from '@/features/train/components/SkippedBlock'

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

// ── Kímélő mód S2 (mezo-q4xt2.2) — prototype kmHero() / kmInner() / the rCb run card ──
const period = (over: Partial<Parameters<typeof RecoveryBlock>[0]['period']> = {}) => ({
  category: 'ILLNESS' as const, estimate: 'FEW_DAYS' as const, estimateExpired: false, checkedInToday: false, ...over,
})

test('recovery variant: category icon, „Beteg vagy · becslés: 2–3 nap", the sub-line, both buttons', () => {
  const h = { onRelease: vi.fn(), onBetter: vi.fn(), onNotYet: vi.fn() }
  const { container } = render(<RecoveryBlock period={period()} {...h} />)
  const block = container.querySelector('.trm-skipd')!
  expect(block).toHaveClass('glass')
  expect(hrefs(block)).toEqual(['#t-ill'])
  expect(screen.getByText('Beteg vagy · becslés: 2–3 nap')).toBeInTheDocument()
  expect(screen.getByText('Az edzés ma magától kimarad. Nem számít mulasztásnak, a sorozatod marad.')).toBeInTheDocument()
  expect(screen.queryByText('A becsült idő letelt — hogy vagy?')).toBeNull()
  const btns = [...container.querySelectorAll('.trm-skacts button')].map((b) => b.textContent)
  expect(btns).toEqual(['Ma mégis edzek', 'Jobban vagyok'])
  fireEvent.click(screen.getByRole('button', { name: 'Ma mégis edzek' }))
  expect(h.onRelease).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Jobban vagyok' }))
  expect(h.onBetter).toHaveBeenCalled()
})

test('recovery variant, estimate passed: „… volt", the question, Jobban vagyok / Még nem + the quiet link', () => {
  const h = { onRelease: vi.fn(), onBetter: vi.fn(), onNotYet: vi.fn() }
  const { container } = render(<RecoveryBlock period={period({ category: 'STOMACH', estimate: 'TODAY', estimateExpired: true })} {...h} />)
  expect(hrefs(container.querySelector('.trm-skipd')!)).toEqual(['#t-digestion'])
  expect(screen.getByText('Gyomorrontás · becslés: csak ma volt')).toBeInTheDocument()
  expect(screen.getByText('A becsült idő letelt — hogy vagy?')).toBeInTheDocument()
  expect([...container.querySelectorAll('.trm-skacts button')].map((b) => b.textContent)).toEqual(['Jobban vagyok', 'Még nem'])
  fireEvent.click(screen.getByRole('button', { name: 'Még nem' }))
  expect(h.onNotYet).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Ma mégis edzek' }))
  expect(h.onRelease).toHaveBeenCalled()
})

test('recovery variant: the question is gone once checked in today; UNKNOWN estimate reads honestly', () => {
  render(<RecoveryBlock period={period({ estimate: 'UNKNOWN', estimateExpired: true, checkedInToday: true, category: 'TRAVEL' })}
    onRelease={() => {}} onBetter={() => {}} onNotYet={() => {}} />)
  expect(screen.queryByText('A becsült idő letelt — hogy vagy?')).toBeNull()
  expect(screen.getByText('Úton vagy · még nem tudod, meddig tart')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ma mégis edzek' })).toBeInTheDocument()
})

test('recovery variant: buttons disabled while a write is in flight', () => {
  render(<RecoveryBlock period={period()} busy onRelease={() => {}} onBetter={() => {}} onNotYet={() => {}} />)
  expect(screen.getByRole('button', { name: 'Ma mégis edzek' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Jobban vagyok' })).toBeDisabled()
})

test('kmInner: flat t-kimelo block „Kímélő mód"; the run-ramp inner block', () => {
  const { container, unmount } = render(<KimeloInner />)
  const block = container.querySelector('.trm-skipd')!
  expect(block).toHaveClass('is-in')
  expect(block).not.toHaveClass('glass')
  expect(hrefs(block)).toEqual(['#t-kimelo'])
  expect(screen.getByText('Kímélő mód')).toBeInTheDocument()
  expect(screen.getByText('Magától kimarad · nem számít mulasztásnak.')).toBeInTheDocument()
  unmount()
  const r = render(<RunRampInner />)
  expect(hrefs(r.container.querySelector('.trm-skipd')!)).toEqual(['#t-sprout'])
  expect(screen.getByText('Első futás kihagyás után: kb. fele olyan hosszú, laza tempóban.')).toBeInTheDocument()
})
