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
    const { container } = render(<NapomDimensionRow dimension={nutrition} mode="scored" goalTick i={0} />)
    const row = screen.getByRole('button', { name: /^Tápanyag/ })
    expect(row).toHaveAttribute('aria-expanded', 'true')
    // a11y (mezo-yjzhw.7): a short name, the fact line as the description — not the whole body
    expect(row).toHaveAccessibleName('Tápanyag, 82 pont')
    expect(row).toHaveAccessibleDescription('kcal 2980 / 3100 · fehérje 205 / 220 g')
    expect(screen.getByText('súly 30%')).toBeInTheDocument()
    expect(screen.getByText('kcal 2980 / 3100 · fehérje 205 / 220 g')).toBeInTheDocument()
    expect(screen.getByText('82')).toBeInTheDocument()
    expect(container.querySelector('.napom-bar u')).not.toBeNull()
    expect(screen.getByText('BEZÁR')).toBeInTheDocument()
    expect(screen.getByText('kcal · 2980 / 3100')).toBeInTheDocument()
    expect(screen.getByText('A fehérjecélt majdnem hoztad.')).toBeInTheDocument()

    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('MEZO ›')).toBeInTheDocument()
    expect(screen.queryByText('A fehérjecélt majdnem hoztad.')).toBeNull()

    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('A fehérjecélt majdnem hoztad.')).toBeInTheDocument()
  })

  test('scored with no score: the name says "nincs adat"', () => {
    render(<NapomDimensionRow dimension={{ ...nutrition, score: null, status: 'NO_DATA', facts: [] }} mode="scored" i={0} />)
    const row = screen.getByRole('button', { name: 'Tápanyag, nincs adat' })
    expect(row).toHaveAttribute('aria-expanded', 'true')
    // the name already says it — the fact line must not announce it a second time
    expect(row).not.toHaveAttribute('aria-describedby')
    expect(row).toHaveAccessibleDescription('')
  })

  test('scored with neither facts nor note: no empty detail box', () => {
    const { container } = render(
      <NapomDimensionRow dimension={{ ...nutrition, score: null, status: 'NO_DATA', facts: [], note: null }} mode="scored" i={0} />,
    )
    expect(container.querySelector('.napom-dmore')).toBeNull()
  })

  test('today: status word by status, no weight, NO_DATA is a dashed row with a dash for the value', () => {
    const { container, rerender } = render(<NapomDimensionRow dimension={nutrition} mode="today" i={0} />)
    expect(screen.getByText('KÉSZ')).toBeInTheDocument()
    expect(screen.queryByText(/súly/)).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.napom-drow')).toHaveClass('glass')

    expect(container.querySelector('.napom-bar')).not.toBeNull()
    // a live day shows its details up front too (owner 2026-09-26): chips + the note if any
    expect(screen.getByText('kcal · 2980 / 3100')).toBeInTheDocument()
    expect(screen.getByText('A fehérjecélt majdnem hoztad.')).toBeInTheDocument()

    rerender(<NapomDimensionRow dimension={{ ...nutrition, score: null, status: 'NO_DATA', facts: [], note: null }} mode="today" goalTick i={0} />)
    expect(screen.getByText('NYITVA')).toBeInTheDocument()
    // an open row is free space: no empty bar, no goal tick
    expect(container.querySelector('.napom-bar')).toBeNull()
    expect(container.querySelector('.napom-bar u')).toBeNull()
    expect(screen.getByText('–')).toBeInTheDocument()
    expect(container.querySelector('.napom-drow')).toHaveClass('is-open')
    expect(container.querySelector('.napom-drow')).not.toHaveClass('glass')
    // nothing to show → no empty detail box
    expect(container.querySelector('.napom-dmore')).toBeNull()

    rerender(<NapomDimensionRow dimension={{ ...nutrition, score: null, status: 'IN_PROGRESS' }} mode="today" i={0} />)
    expect(screen.getByText('ÚTON')).toBeInTheDocument()
  })
})
