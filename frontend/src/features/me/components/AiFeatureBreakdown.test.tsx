import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AiFeatureBreakdown } from '@/features/me/components/AiFeatureBreakdown'

const GROUPS = [
  { key: 'companion_chat', callCount: 96, costUsd: 0.74 },
  { key: 'meal_draft', callCount: 34, costUsd: 0.18 },
  { key: 'quest_flavor', callCount: 6, costUsd: null },
]

describe('AiFeatureBreakdown', () => {
  it('renders one row per feature with its call count and cost', () => {
    render(<AiFeatureBreakdown groups={GROUPS} selected={null} onSelect={() => {}} />)

    expect(screen.getByText('companion_chat')).toBeInTheDocument()
    expect(screen.getByText('$0.74')).toBeInTheDocument()
    // an unpriced bucket shows a dash, not $0.00
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('selects a feature on click and clears it when the selected one is clicked again', () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <AiFeatureBreakdown groups={GROUPS} selected={null} onSelect={onSelect} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /companion_chat/ }))
    expect(onSelect).toHaveBeenCalledWith('companion_chat')

    rerender(<AiFeatureBreakdown groups={GROUPS} selected="companion_chat" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /companion_chat/ }))
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })

  it('collapses to the top rows and expands on demand', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ key: `f${i}`, callCount: 1, costUsd: 0.01 }))
    render(<AiFeatureBreakdown groups={many} selected={null} onSelect={() => {}} />)

    expect(screen.queryByText('f11')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Mind/ }))
    expect(screen.getByText('f11')).toBeInTheDocument()
  })

  // Regression guard: a feature rollup under a dime is an ordinary production case (a
  // rarely-used feature), not just mock-data noise — it must still render at 2 decimals like
  // every other row in the column, never 4 (which would read $0.0900 next to $0.74).
  it('renders a sub-dime bucket with the same two-decimal precision as the rest of the column', () => {
    const groups = [
      { key: 'companion_chat', callCount: 96, costUsd: 0.74 },
      { key: 'proactive_heartbeat', callCount: 28, costUsd: 0.09 },
    ]
    render(<AiFeatureBreakdown groups={groups} selected={null} onSelect={() => {}} />)

    expect(screen.getByText('$0.09')).toBeInTheDocument()
    expect(screen.queryByText('$0.0900')).not.toBeInTheDocument()
  })
})
