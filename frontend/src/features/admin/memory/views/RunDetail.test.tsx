import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { RunDetail } from '@/features/admin/memory/views/RunDetail'
import { ADMIN_MEMORY_RUN_DETAIL_EMPTY, ADMIN_MEMORY_RUN_SHADOW_DETAIL } from '@/data/admin/adminMemoryMock'

function renderDetail(detail = ADMIN_MEMORY_RUN_SHADOW_DETAIL, onGo = vi.fn(), onInspect = vi.fn()) {
  render(
    <MemoryRouter>
      <RunDetail detail={detail} onGo={onGo} onInspect={onInspect} />
    </MemoryRouter>,
  )
  return { onGo, onInspect }
}

describe('RunDetail', () => {
  it('renders an absent retriever as a muted "–"', () => {
    renderDetail()
    expect(screen.getAllByText('–').length).toBeGreaterThan(0)
  })

  it('renders a signed rerankDelta', () => {
    renderDetail()
    expect(screen.getByText(/Δ \+1/)).toBeInTheDocument()
  })

  it('renders the SHADOW sentence instead of an empty list when promptTrace is null', () => {
    renderDetail()
    expect(screen.getByText(/árnyékfutás sosem ért el a modellig/)).toBeInTheDocument()
  })

  it('the edge-candidate deep link calls onGo with (graph, candidateRefId)', () => {
    const { onGo } = renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /Megnyitás a Gráfon/ }))
    const edgeCandidate = ADMIN_MEMORY_RUN_SHADOW_DETAIL.candidates.find((c) => c.candidateKind === 'knowledge_edge')!
    expect(onGo).toHaveBeenCalledWith('graph', edgeCandidate.candidateRefId)
  })

  it('an all-absent candidate (total retriever outage) renders the outage note, not a silent zero-height bar', () => {
    renderDetail()
    expect(screen.getByText(/egyik retriever sem adott találatot/)).toBeInTheDocument()
  })

  it('a dry-run detail renders the DRY-RUN badge and the mode caveat unconditionally', () => {
    renderDetail({ ...ADMIN_MEMORY_RUN_DETAIL_EMPTY, dryRun: true })
    expect(screen.getByText('DRY-RUN')).toBeInTheDocument()
    expect(screen.getByText(/nem azt, amit a kísérő ténylegesen kiszolgált/)).toBeInTheDocument()
  })

  it('renders replayNotes as chips with their Hungarian labels', () => {
    renderDetail({ ...ADMIN_MEMORY_RUN_DETAIL_EMPTY, replayNotes: ['pca_unavailable'] })
    expect(screen.getByText(/a térkép-elhelyezés nem sikerült/)).toBeInTheDocument()
  })

  // mezo-k5zy Task 3 — the run's own lead line + each candidate row's own verdict.
  it('renders a run-level verdict lead line for the top selected candidate', () => {
    renderDetail()
    expect(screen.getByText(/^A legjobb találatot .+ találta meg a rendszer\.$/)).toBeInTheDocument()
  })

  it('renders no verdict lead line when there are no candidates at all', () => {
    renderDetail({ ...ADMIN_MEMORY_RUN_DETAIL_EMPTY, candidates: [] })
    expect(screen.queryByText(/találta meg a rendszer/)).not.toBeInTheDocument()
  })

  it('every candidate row carries its own verdict sentence next to its title', () => {
    renderDetail()
    const verdicts = document.querySelectorAll('.am-candhead .verdict')
    expect(verdicts.length).toBe(ADMIN_MEMORY_RUN_SHADOW_DETAIL.candidates.length)
    for (const v of verdicts) {
      expect(v.textContent?.trim().length ?? 0).toBeGreaterThan(0)
    }
  })
})
