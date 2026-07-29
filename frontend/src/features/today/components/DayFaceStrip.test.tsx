import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { DayFaceStrip } from '@/features/today/components/DayFaceStrip'

const COUNTS = { reggel: 3, nap: 2, este: 4 }
const DONE = { reggel: 5, nap: 0, este: 0 }

describe('DayFaceStrip', () => {
  test('renders one tab per face inside a tablist', () => {
    render(<DayFaceStrip selected="reggel" current="reggel" counts={COUNTS} doneCounts={DONE} onSelect={() => {}} />)
    expect(screen.getByRole('tablist', { name: 'Napszakok' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  test('only the selected face has aria-selected', () => {
    render(<DayFaceStrip selected="este" current="reggel" counts={COUNTS} doneCounts={DONE} onSelect={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true'])
  })

  test('the spoken label carries the label, the open count and whether it is now', () => {
    render(<DayFaceStrip selected="reggel" current="nap" counts={COUNTS} doneCounts={DONE} onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Reggel · 3 nyitott tétel' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Nap · most · 2 nyitott tétel' })).toBeInTheDocument()
  })

  test('a face with no open items but some done reads as complete', () => {
    render(<DayFaceStrip selected="reggel" current="reggel" counts={{ reggel: 0, nap: 2, este: 4 }}
      doneCounts={{ reggel: 5, nap: 0, este: 0 }} onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Reggel · most · kész' })).toBeInTheDocument()
  })

  test('tapping a tab reports its face', () => {
    const onSelect = vi.fn()
    render(<DayFaceStrip selected="reggel" current="reggel" counts={COUNTS} doneCounts={DONE} onSelect={onSelect} />)
    screen.getAllByRole('tab')[2].click()
    expect(onSelect).toHaveBeenCalledWith('este')
  })

  test('a face with no open items and no done items reads as nothing to do', () => {
    render(<DayFaceStrip selected="reggel" current="reggel" counts={{ reggel: 0, nap: 0, este: 4 }}
      doneCounts={{ reggel: 0, nap: 0, este: 0 }} onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Reggel · most · nincs teendő' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Nap · nincs teendő' })).toBeInTheDocument()
  })

  test('the now class marks the current face, distinct from selected', () => {
    const { container } = render(<DayFaceStrip selected="reggel" current="nap" counts={COUNTS} doneCounts={DONE} onSelect={() => {}} />)
    const buttons = container.querySelectorAll('.dfs-pill')
    expect(buttons[0]).toHaveClass('sel')
    expect(buttons[0]).not.toHaveClass('now')
    expect(buttons[1]).toHaveClass('now')
    expect(buttons[1]).not.toHaveClass('sel')
  })
})
