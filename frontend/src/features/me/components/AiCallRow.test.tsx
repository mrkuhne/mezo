import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { AiCallRow } from '@/features/me/components/AiCallRow'
import { LLM_CALLS_MOCK } from '@/data/me/llmUsageHooks'

const [stream, tool, failed, cancelled, embed] = LLM_CALLS_MOCK.items

function renderRow(call: typeof stream) {
  return render(<AiCallRow call={call} />, { wrapper: MemoryRouter })
}

describe('AiCallRow', () => {
  it('links to the call detail page', () => {
    renderRow(tool)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href', `/me/ai-usage/${tool.id}`,
    )
  })

  it('shows feature, operation, kind badge, tokens, latency and cost', () => {
    renderRow(tool)
    expect(screen.getByText('companion_chat')).toBeInTheDocument()
    expect(screen.getByText(/send/)).toBeInTheDocument()
    expect(screen.getByText('TOOL')).toBeInTheDocument()
    expect(screen.getByText('11 204')).toBeInTheDocument()
    expect(screen.getByText('7.8 s')).toBeInTheDocument()
    expect(screen.getByText('$0.0583')).toBeInTheDocument()
  })

  it('shows the error reason and no cost on a failed call', () => {
    renderRow(failed)
    expect(screen.getByText(/ResourceExhaustedException/)).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('explains a cancelled stream instead of leaving it blank', () => {
    renderRow(cancelled)
    expect(screen.getByText(/megszakadt/i)).toBeInTheDocument()
  })

  it('shows the batch size and dimensions on an embedding call', () => {
    renderRow(embed)
    expect(screen.getByText(/12 db/)).toBeInTheDocument()
    expect(screen.getByText(/768/)).toBeInTheDocument()
  })

  it('marks a streamed call', () => {
    renderRow(stream)
    expect(screen.getByText('STREAM')).toBeInTheDocument()
  })
})
