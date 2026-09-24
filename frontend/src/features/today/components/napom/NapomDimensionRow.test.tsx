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
  test('scored: a collapsed button with weight, fact line, score and MEZO ›; tapping expands chips + note', async () => {
    const user = userEvent.setup()
    const { container } = render(<NapomDimensionRow dimension={nutrition} mode="scored" goalTick i={0} />)
    const row = screen.getByRole('button', { name: /^Tápanyag/ })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('súly 30%')).toBeInTheDocument()
    expect(screen.getByText('kcal 2980 / 3100 · fehérje 205 / 220 g')).toBeInTheDocument()
    expect(screen.getByText('82')).toBeInTheDocument()
    expect(screen.getByText('MEZO ›')).toBeInTheDocument()
    expect(container.querySelector('.napom-bar u')).not.toBeNull()
    expect(screen.queryByText('A fehérjecélt majdnem hoztad.')).toBeNull()

    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('BEZÁR')).toBeInTheDocument()
    expect(screen.getByText('kcal · 2980 / 3100')).toBeInTheDocument()
    expect(screen.getByText('A fehérjecélt majdnem hoztad.')).toBeInTheDocument()

    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('A fehérjecélt majdnem hoztad.')).toBeNull()
  })

  test('today: status word by status, no weight, NO_DATA is a dashed row with a dash for the value', () => {
    const { container, rerender } = render(<NapomDimensionRow dimension={nutrition} mode="today" i={0} />)
    expect(screen.getByText('KÉSZ')).toBeInTheDocument()
    expect(screen.queryByText(/súly/)).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.napom-drow')).toHaveClass('glass')

    expect(container.querySelector('.napom-bar')).not.toBeNull()

    rerender(<NapomDimensionRow dimension={{ ...nutrition, score: null, status: 'NO_DATA', facts: [] }} mode="today" goalTick i={0} />)
    expect(screen.getByText('NYITVA')).toBeInTheDocument()
    // an open row is free space: no empty bar, no goal tick
    expect(container.querySelector('.napom-bar')).toBeNull()
    expect(container.querySelector('.napom-bar u')).toBeNull()
    expect(screen.getByText('–')).toBeInTheDocument()
    expect(container.querySelector('.napom-drow')).toHaveClass('is-open')
    expect(container.querySelector('.napom-drow')).not.toHaveClass('glass')

    rerender(<NapomDimensionRow dimension={{ ...nutrition, score: null, status: 'IN_PROGRESS' }} mode="today" i={0} />)
    expect(screen.getByText('ÚTON')).toBeInTheDocument()
  })
})
