import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { KnowledgeBaseView } from '@/features/insights/components/KnowledgeBaseView'
import { hubCounts, type Loadable } from '@/features/insights/logic/hubCounts'
import { HERO, TILE_STATE } from '@/features/insights/logic/hubCopy'

const base = <T,>(items: T): Loadable<T> => ({ items, degraded: false, isPending: false, isError: false, refetch: vi.fn() })
const err = <T,>(e: T): Loadable<T> => ({ ...base(e), isError: true })
const loading = <T,>(e: T): Loadable<T> => ({ ...base(e), isPending: true })

const renderHub = (counts: ReturnType<typeof hubCounts>) =>
  render(<MemoryRouter><KnowledgeBaseView pendingCount={0} counts={counts} onNavigate={vi.fn()} /></MemoryRouter>)

describe('KnowledgeBaseView hero honesty', () => {
  it('all four sections failed: no number, no split, an honest line instead of a 0', () => {
    const { container } = renderHub(hubCounts(err([]), err([]), err([]), err([])))
    expect(container.querySelector('.th-hero .big')).toHaveTextContent(HERO.unavailable)
    expect(container.querySelector('.th-split')).toBeNull()
    expect(container.querySelector('.th-hero-note')).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('facts still loading, the rest failed: the hero says it is loading, no split, no 0', () => {
    const { container } = renderHub(hubCounts(loading([]), err([]), err([]), err([])))
    expect(container.querySelector('.th-hero .big')).toHaveTextContent(TILE_STATE.loading)
    expect(container.querySelector('.th-split')).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })
})
