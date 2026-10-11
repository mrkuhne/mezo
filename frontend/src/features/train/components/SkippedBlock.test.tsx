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

// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `skBlock()` / `skActs()`): a kit callout box + text links.
test('no reason: the skip glyph, „ok nélkül", the free-pass line, „Okot adok"', () => {
  const onReason = vi.fn()
  const { container } = render(<SkippedBlock skip={sk()} onReason={onReason} onUndo={() => {}} />)
  expect(screen.getByText('Kihagyva · ok nélkül')).toBeInTheDocument()
  expect(screen.getByText('A heti szabadjegyed fedezi — a sorozatod marad.')).toBeInTheDocument()
  const block = container.querySelector('.fo-box.em-skipd')!
  expect(container.querySelector('.glass, [class*="trm-"]')).toBeNull()
  expect(hrefs(block)).toEqual(['#t-skip'])
  expect([...container.querySelectorAll('.em-skacts button')].map((b) => b.textContent)).toEqual(['Okot adok', 'Visszavonom'])
  fireEvent.click(screen.getByRole('button', { name: 'Okot adok' }))
  expect(onReason).toHaveBeenCalled()
})

test('with a reason: its glyph, the label, „Másik ok"; inner = the indented form under a row', () => {
  const onUndo = vi.fn()
  const { container } = render(
    <SkippedBlock inner skip={sk({ reasonCategory: 'ILLNESS', serious: true, freePass: false })} onReason={() => {}} onUndo={onUndo} />,
  )
  expect(screen.getByText('Kihagyva · Beteg vagyok')).toBeInTheDocument()
  expect(screen.getByText('Nem számít mulasztásnak. Jobbulást!')).toBeInTheDocument()
  const block = container.querySelector('.fo-under.col > .fo-box.em-skipd')!
  expect(hrefs(block)).toEqual(['#t-ill'])
  expect(container.querySelector('.fo-under.col > .em-skacts')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Másik ok' })).toBeInTheDocument()
  const undo = screen.getByRole('button', { name: 'Visszavonom' })
  expect(undo).toHaveClass('fo-lk')
  fireEvent.click(undo)
  expect(onUndo).toHaveBeenCalled()
})

// ── Kímélő mód S2 (mezo-q4xt2.2) — prototype `thero()` km branch / `kmIn()` / the comeback run line ──
const period = (over: Partial<Parameters<typeof RecoveryBlock>[0]['period']> = {}) => ({
  category: 'ILLNESS' as const, estimate: 'FEW_DAYS' as const, estimateExpired: false, checkedInToday: false, ...over,
})

test('recovery variant: category glyph, „Beteg vagy · becslés: 2–3 nap", the sub-line, the button and the link', () => {
  const h = { onRelease: vi.fn(), onBetter: vi.fn(), onNotYet: vi.fn() }
  const { container } = render(<RecoveryBlock period={period()} {...h} />)
  const block = container.querySelector('.fo-box.em-skipd')!
  expect(hrefs(block)).toEqual(['#t-ill'])
  expect(screen.getByText('Beteg vagy · becslés: 2–3 nap')).toBeInTheDocument()
  expect(screen.getByText('Az edzés ma magától kimarad. Nem számít mulasztásnak, a sorozatod marad.')).toBeInTheDocument()
  expect(screen.queryByText('A becsült idő letelt — hogy vagy?')).toBeNull()
  const btns = [...container.querySelectorAll('.em-skacts button')].map((b) => b.textContent)
  expect(btns).toEqual(['Jobban vagyok', 'Ma mégis edzek'])
  expect(screen.getByRole('button', { name: 'Jobban vagyok' })).toHaveClass('fo-btn')
  fireEvent.click(screen.getByRole('button', { name: 'Ma mégis edzek' }))
  expect(h.onRelease).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Jobban vagyok' }))
  expect(h.onBetter).toHaveBeenCalled()
})

test('recovery variant, estimate passed: „… volt", the question, Jobban vagyok / Még nem + the quiet link', () => {
  const h = { onRelease: vi.fn(), onBetter: vi.fn(), onNotYet: vi.fn() }
  const { container } = render(<RecoveryBlock period={period({ category: 'STOMACH', estimate: 'TODAY', estimateExpired: true })} {...h} />)
  expect(hrefs(container.querySelector('.fo-box.em-skipd')!)).toEqual(['#t-digestion'])
  expect(screen.getByText('Gyomorrontás · becslés: csak ma volt')).toBeInTheDocument()
  expect(screen.getByText('A becsült idő letelt — hogy vagy?')).toBeInTheDocument()
  expect([...container.querySelectorAll('.em-skacts button')].map((b) => b.textContent)).toEqual(['Jobban vagyok', 'Még nem', 'Ma mégis edzek'])
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

test('kmInner: the indented kímélő line; the run-ramp line', () => {
  const { container, unmount } = render(<KimeloInner />)
  const block = container.querySelector('.fo-under.em-kmin')!
  expect(hrefs(block)).toEqual(['#t-kimelo'])
  expect(screen.getByText('Kímélő mód')).toBeInTheDocument()
  expect(block.textContent).toContain('Kímélő mód · Magától kimarad · nem számít mulasztásnak.')
  unmount()
  const r = render(<RunRampInner />)
  expect(hrefs(r.container.querySelector('.fo-under.em-rampin')!)).toEqual(['#t-sprout'])
  expect(r.container.querySelector('.fo-under.em-rampin')!.textContent).toContain('Visszatérő futás · Első futás kihagyás után: kb. fele olyan hosszú, laza tempóban.')
})
