import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AiModelBreakdown } from '@/features/me/components/AiModelBreakdown'
import { LLM_BREAKDOWN_MOCK } from '@/data/me/llmUsageHooks'

describe('AiModelBreakdown', () => {
  it('renders one tile per served model with its call count and rollup cost', () => {
    render(<AiModelBreakdown groups={LLM_BREAKDOWN_MOCK.models} />)

    expect(screen.getByText('Modell szerint')).toBeInTheDocument()
    expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument()
    expect(screen.getByText('217')).toBeInTheDocument()
    expect(screen.getByText('$1.12')).toBeInTheDocument()
    expect(screen.getByText('gemini-embedding-001')).toBeInTheDocument()
    expect(screen.getByText('$0.09')).toBeInTheDocument()
  })

  it('keeps the null-keyed bucket as "ismeretlen" with a dashed cost, not a dropped row', () => {
    // An ERROR call never reached a model, so the backend returns a null-keyed group. Those calls
    // happened — hiding them would hide exactly the traffic the AI-napló exists to surface — and
    // their cost is UNKNOWN, never $0.00 (ADR 0014).
    render(<AiModelBreakdown groups={LLM_BREAKDOWN_MOCK.models} />)

    expect(screen.getByText('ismeretlen')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('$0.00')).toBeNull()
  })

  it('renders nothing at all when the period has no calls', () => {
    const { container } = render(<AiModelBreakdown groups={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
