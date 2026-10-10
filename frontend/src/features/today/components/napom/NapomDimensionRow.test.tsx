import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { NapomDimensionRow } from '@/features/today/components/napom/NapomDimensionRow'
import type { NormalizedDayDimension } from '@/data/me/dayEvaluation'

const nutrition: NormalizedDayDimension = {
  id: 'nutrition', label: 'Táplálkozás', weight: 0.3, score: 82, status: 'DONE',
  facts: [{ label: 'kcal', value: '2980 / 3100' }, { label: 'fehérje', value: '205 / 220 g' }],
  note: 'A fehérjecélt majdnem hoztad.',
}

describe('NapomDimensionRow', () => {
  test('scored: an expanded button with weight, fact line, score, chips + note; tapping folds it', async () => {
    const user = userEvent.setup()
    const { container } = render(<NapomDimensionRow dimension={nutrition} mode="scored" goalTick />)
    const row = screen.getByRole('button', { name: /^Tápanyag/ })
    expect(row).toHaveAttribute('aria-expanded', 'true')
    // a11y (mezo-yjzhw.7): a short name, the fact line as the description — not the whole body
    expect(row).toHaveAccessibleName('Tápanyag, 82 pont')
    expect(row).toHaveAccessibleDescription('kcal 2980 / 3100 · fehérje 205 / 220 g')
    expect(screen.getByText('súly 30%')).toBeInTheDocument()
    expect(screen.getByText('kcal 2980 / 3100 · fehérje 205 / 220 g')).toBeInTheDocument()
    expect(screen.getByText('82')).toBeInTheDocument()
    // a kit row with a level at the score, and the kcal goal mark at its end
    expect(container.querySelector('.fo-row.nn-drow')).not.toBeNull()
    expect((container.querySelector('.fo-level i') as HTMLElement).style.width).toBe('82%')
    expect(container.querySelector('.nn-lv .nn-goal')).not.toBeNull()
    expect(screen.getByText('bezár')).toBeInTheDocument()
    expect(screen.getByText('kcal · 2980 / 3100')).toBeInTheDocument()
    expect(screen.getByText('A fehérjecélt majdnem hoztad.')).toBeInTheDocument()

    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Mezo ›')).toBeInTheDocument()
    expect(screen.queryByText('A fehérjecélt majdnem hoztad.')).toBeNull()

    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('A fehérjecélt majdnem hoztad.')).toBeInTheDocument()
  })

  test('scored with no score: the name says "nincs adat"', () => {
    render(<NapomDimensionRow dimension={{ ...nutrition, score: null, status: 'NO_DATA', facts: [] }} mode="scored" />)
    const row = screen.getByRole('button', { name: 'Tápanyag, nincs adat' })
    expect(row).toHaveAttribute('aria-expanded', 'true')
    // the name already says it — the fact line must not announce it a second time
    expect(row).not.toHaveAttribute('aria-describedby')
    expect(row).toHaveAccessibleDescription('')
  })

  test('scored with neither facts nor note: no empty detail box', () => {
    const { container } = render(
      <NapomDimensionRow dimension={{ ...nutrition, score: null, status: 'NO_DATA', facts: [], note: null }} mode="scored" />,
    )
    expect(container.querySelector('.nn-open')).toBeNull()
    // a closed day's row with no score is dimmed, never a fabricated 0
    expect(container.querySelector('.nn-drow')).toHaveClass('dim')
  })

  test('today: status pill by status, no weight, NO_DATA is an open row with a dash for the value', () => {
    const { container, rerender } = render(<NapomDimensionRow dimension={nutrition} mode="today" />)
    expect(screen.getByText('kész')).toHaveClass('fo-st', 'ok')
    expect(screen.queryByText(/súly/)).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.nn-drow')).not.toHaveClass('dim')

    expect((container.querySelector('.fo-level i') as HTMLElement).style.width).toBe('82%')
    // a live day shows its details up front too (owner 2026-09-26): chips + the note if any
    expect(screen.getByText('kcal · 2980 / 3100')).toBeInTheDocument()
    expect(screen.getByText('A fehérjecélt majdnem hoztad.')).toBeInTheDocument()

    rerender(<NapomDimensionRow dimension={{ ...nutrition, score: null, status: 'NO_DATA', facts: [], note: null }} mode="today" goalTick />)
    expect(screen.getByText('nyitva')).toHaveClass('fo-st', 'warn')
    // an open row claims nothing: an empty level, no goal mark
    expect((container.querySelector('.fo-level i') as HTMLElement).style.width).toBe('0%')
    expect(container.querySelector('.nn-goal')).toBeNull()
    expect(screen.getByText('–')).toBeInTheDocument()
    // nothing to show → no empty detail box
    expect(container.querySelector('.nn-open')).toBeNull()

    rerender(<NapomDimensionRow dimension={{ ...nutrition, score: null, status: 'IN_PROGRESS' }} mode="today" />)
    expect(screen.getByText('úton')).toHaveClass('fo-st', 'q')
  })

  test('a ✓ fact value (the engine\'s water yes) is the tick glyph with a spoken word, in the line and the chip (U11)', () => {
    const logging: NormalizedDayDimension = {
      id: 'logging', label: 'Naplózás', weight: 0.1, score: 90, status: 'DONE',
      facts: [{ label: 'étkezés időben', value: '80%' }, { label: 'víz', value: '✓' }, { label: 'check-in', value: '4 / 4' }],
      note: null,
    }
    const { container } = render(<NapomDimensionRow dimension={logging} mode="scored" />)
    const row = screen.getByRole('button', { name: /^Logolás/ })
    expect(row).toHaveAccessibleDescription('étkezés időben 80% · víz megvan · check-in 4 / 4')
    expect(container.querySelector('.fo-row .g > small use')?.getAttribute('href')).toBe('#t-tick')
    const chip = [...container.querySelectorAll('.fo-chips > span')].find((c) => c.textContent?.startsWith('víz'))
    expect(chip?.querySelector('use')?.getAttribute('href')).toBe('#t-tick')
    expect(chip?.textContent).toBe('víz · megvan')
    expect(container.textContent).not.toMatch(/✓/)
  })

  test('loading: a dimmed placeholder that claims nothing', () => {
    const { container } = render(<NapomDimensionRow dimension={nutrition} mode="loading" />)
    expect(container.querySelector('.nn-drow')).toHaveClass('dim')
    expect(screen.getByText('betöltés…')).toBeInTheDocument()
    expect(screen.getByText('–')).toBeInTheDocument()
    expect(screen.queryByText('82')).toBeNull()
    expect((container.querySelector('.fo-level i') as HTMLElement).style.width).toBe('0%')
  })

  test('fresh: the row wears the one-shot highlight class', () => {
    const { container } = render(<NapomDimensionRow dimension={nutrition} mode="today" fresh />)
    expect(container.querySelector('.nn-drow')).toHaveClass('is-fresh')
  })
})
