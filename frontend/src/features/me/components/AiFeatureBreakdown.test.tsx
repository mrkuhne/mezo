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
})
