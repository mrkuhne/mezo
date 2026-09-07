import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { ReplayBox } from '@/features/admin/memory/views/ReplayBox'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderReplayBox() {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <ReplayBox userId="u-1" onGo={vi.fn()} onInspect={vi.fn()} />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

describe('ReplayBox (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('submitting posts the toggles as sent, and the result carries the DRY-RUN badge + caveat', async () => {
    let seenBody: { query: string; reranker: boolean; rewrite: boolean } | null = null
    server.use(http.post(`${API_BASE}/api/admin/users/:userId/memory/replay`, async ({ request }) => {
      seenBody = (await request.json()) as typeof seenBody
      return HttpResponse.json({
        run: { id: null, createdAt: '2026-09-07T10:00:00Z', consumerPolicy: 'CHAT_AMBIENT', servingMode: 'NEW', queryMode: 'RAW', rawQuery: seenBody!.query, candidateCount: 0, selectedCount: 0, durationMs: 10, embeddingVersion: 'v1', retrieverTrace: [] },
        fusion: { rrfK: 60, retrieverWeights: {} },
        promptTrace: null,
        promptTraceReason: 'DRY_RUN',
        dryRun: true,
        queryProjection: null,
        replayNotes: ['pca_unavailable'],
        candidates: [],
      })
    }))

    renderReplayBox()
    fireEvent.change(screen.getByPlaceholderText(/mennyit aludtam/), { target: { value: 'teszt lekérdezés' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Újraírás' }))
    fireEvent.click(screen.getByRole('button', { name: 'Futtatás' }))

    await waitFor(() => expect(screen.getByText('DRY-RUN')).toBeInTheDocument())
    expect(screen.getByText(/nem azt, amit a kísérő ténylegesen kiszolgált/)).toBeInTheDocument()
    expect(screen.getByText(/a térkép-elhelyezés nem sikerült/)).toBeInTheDocument()
    expect(seenBody).toEqual({ query: 'teszt lekérdezés', reranker: false, rewrite: true, consumerPolicy: 'CHAT_AMBIENT' })
  })

  it('the toggle labels read engedélyezve, not bekapcsolva, once enabled', () => {
    renderReplayBox()
    fireEvent.click(screen.getByRole('switch', { name: 'Újrarangsorolás' }))
    expect(screen.getByText(/Újrarangsorolás — engedélyezve/)).toBeInTheDocument()
  })
})
