import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { AiCallDetailPage } from '@/features/me/pages/AiCallDetailPage'
import { LLM_CALL_DETAIL_MOCK } from '@/data/me/llmUsageHooks'

afterEach(() => vi.unstubAllEnvs())

function renderDetail(id: string = LLM_CALL_DETAIL_MOCK.id) {
  return render(
    <MemoryRouter initialEntries={[`/me/ai-usage/${id}`]}>
      <Routes>
        <Route path="/me/ai-usage/:id" element={<AiCallDetailPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('AiCallDetailPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('shows the call identity and the request/response models', () => {
    renderDetail()
    expect(screen.getByText(/companion_chat/)).toBeInTheDocument()
    expect(screen.getAllByText('gemini-2.5-flash').length).toBeGreaterThan(0)
    expect(screen.getByText('7.8 s')).toBeInTheDocument()
  })

  it('renders the four token segments with the NET prompt', () => {
    renderDetail()
    // prompt is RAW in storage (includes cached) — the bar shows 5826 - 896 = 4930, NOT 5826.
    // No thousands-separator space here: hu-HU's CLDR grouping only kicks in at 5+ digits
    // (minimumGroupingDigits: 2 — verified via `(4930).toLocaleString('hu-HU')` === '4930',
    // vs `(11204).toLocaleString('hu-HU')` === '11 204', the case AiCallRow.test.tsx covers).
    expect(screen.getByText(/4930/)).toBeInTheDocument()
    expect(screen.queryByText(/5826/)).not.toBeInTheDocument()
    expect(screen.getByText(/gondolkodás/)).toBeInTheDocument()
    expect(screen.getByText(/3474/)).toBeInTheDocument()
  })

  it('shows the frozen price snapshot the cost came from', () => {
    renderDetail()
    expect(screen.getByText(/Befagyasztott ártábla/)).toBeInTheDocument()
    // Exact, not regex: the call's own createdAt ('2026-08-14T12:31:07Z…') also contains this
    // substring, so an unanchored /2026-08-14/ matches two elements — pin to the isolated
    // pricingSnapshot.pricedOn node (nested in its own span in the component for this reason).
    expect(screen.getByText('2026-08-14')).toBeInTheDocument()
  })

  it('renders the three payload blocks', () => {
    renderDetail()
    expect(screen.getByText('Rendszerprompt')).toBeInTheDocument()
    expect(screen.getByText('User üzenet')).toBeInTheDocument()
    expect(screen.getByText('Válasz')).toBeInTheDocument()
    expect(screen.getByText(/rizses csirkét/)).toBeInTheDocument()
  })
})

// Two edge cases the mock seed can't exercise (mock mode always answers the same fixed
// LLM_CALL_DETAIL_MOCK regardless of :id) — real mode + a per-test MSW override instead.
describe('AiCallDetailPage (real mode edge cases)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('reads a null createdBy as a background job, not blank', async () => {
    const id = '99999999-9999-4999-8999-999999999999'
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls/${id}`, () =>
        HttpResponse.json({ ...LLM_CALL_DETAIL_MOCK, id, createdBy: null }),
      ),
    )
    renderDetail(id)
    await waitFor(() => expect(screen.getByText('háttérfolyamat')).toBeInTheDocument())
  })

  it('distinguishes a known zero tool-round count from an unknown one in the kind badge', async () => {
    // toolRounds: 0 is a real, KNOWN value (tools were available, the model invoked none) — not
    // the same as null (no tool round ever tallied). The grid's "Tool-körök" cell already gets this
    // right (`!= null`); the kind badge above it must agree, or the page contradicts itself.
    const id = '77777777-7777-4777-7777-777777777777'
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls/${id}`, () =>
        HttpResponse.json({ ...LLM_CALL_DETAIL_MOCK, id, toolRounds: 0 }),
      ),
    )
    renderDetail(id)
    await waitFor(() => expect(screen.getByText('TOOL ×0')).toBeInTheDocument())
  })

  it('explains a call with no reported token usage instead of an empty or NaN bar', async () => {
    const id = '88888888-8888-4888-8888-888888888888'
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls/${id}`, () =>
        HttpResponse.json({
          ...LLM_CALL_DETAIL_MOCK, id,
          promptTokens: null, candidatesTokens: null, thoughtsTokens: null, cachedTokens: null,
        }),
      ),
    )
    renderDetail(id)
    await waitFor(() =>
      expect(screen.getByText(/nem jelentett token-használatot/)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })
})
