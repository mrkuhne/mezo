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
    // F7.4: the latency shows twice now — the hero stat strip AND the meta grid cell
    expect(screen.getAllByText('7.8 s').length).toBeGreaterThan(0)
    expect(screen.getByText('SIKER')).toBeInTheDocument()
  })

  it('renders the timestamp as a Hungarian date-time, not the raw ISO instant', () => {
    renderDetail()
    // createdAt is '2026-08-14T12:31:07Z' → 14:31 in the Europe/Budapest report zone.
    expect(screen.getByText(/2026\. aug\. 14\. 14:31/)).toBeInTheDocument()
    expect(screen.queryByText(/12:31:07Z/)).toBeNull()
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

  // mezo-d20.11 (1:1 fidelity audit): the detail page had no EntranceGroup, so its cards popped
  // in while every sibling Én page staggered. The `‹` row stays OUTSIDE the group — the way back
  // must be on the first painted frame — and no `.rise` may sit outside `.mz-play`.
  it('staggers its cards inside an armed EntranceGroup, with the back link outside it', () => {
    const { container } = renderDetail()
    const play = container.querySelector('.mz-play')
    expect(play).not.toBeNull()
    const rises = container.querySelectorAll('.rise')
    expect(rises.length).toBeGreaterThan(0)
    for (const el of rises) expect(play!.contains(el)).toBe(true)
    expect(play!.contains(screen.getByRole('button', { name: 'Vissza' }))).toBe(false)
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

  it('says WHY a call failed — the error class and code, not a bare "HIBA"', async () => {
    // An ERROR row has no tokens, no payload and no cost, so without the error strip the page
    // showed the status word and nothing else — while the list row that led here already read
    // "HIBA · ResourceExhaustedException".
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls/${id}`, () =>
        HttpResponse.json({
          ...LLM_CALL_DETAIL_MOCK, id, status: 'ERROR', servedModel: null,
          errorClass: 'ResourceExhaustedException', errorCode: '429',
          promptTokens: null, candidatesTokens: null, thoughtsTokens: null, cachedTokens: null,
          totalTokens: null, costUsd: null, pricingSnapshot: null,
          systemPrompt: null, userMessage: null, responseText: null,
        }),
      ),
    )
    renderDetail(id)
    await waitFor(() =>
      expect(screen.getByText(/HIBA · ResourceExhaustedException · 429/)).toBeInTheDocument(),
    )
    // an unpriced failure shows no money at all — never a $0.00 that would read as "free"
    expect(screen.queryByText(/\$/)).toBeNull()
  })

  it('shows the embedding counters and the embed rate for an embedding call', async () => {
    // gemini-embedding-001 is priced with embed-per-million-chars ONLY, so the four generation
    // rates are null: printing them unconditionally emitted four bare "$" signs and never showed
    // the one rate the cost came from, while the token bar claimed "no usage reported" on top of
    // three populated counters. embed_memory is the highest-volume kind — a third of the log.
    const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls/${id}`, () =>
        HttpResponse.json({
          ...LLM_CALL_DETAIL_MOCK, id, feature: 'embed_memory', operation: 'document',
          callKind: 'EMBED_DOC', toolRounds: null,
          promptTokens: null, candidatesTokens: null, thoughtsTokens: null, cachedTokens: null,
          totalTokens: null,
          embedInputCount: 12, embedDimensions: 768, embedBillableChars: 4820,
          systemPrompt: null, userMessage: null, responseText: null,
          costUsd: 0.0004,
          pricingSnapshot: {
            sourceModel: 'gemini-embedding-001', currency: 'USD',
            inputPerMillion: null, outputPerMillion: null, thinkingPerMillion: null,
            cachedPerMillion: null, embedPerMillionChars: 0.15, pricedOn: '2026-08-14',
          },
        }),
      ),
    )
    renderDetail(id)

    await waitFor(() => expect(screen.getByText('Beágyazás')).toBeInTheDocument())
    expect(screen.getByText('12 db')).toBeInTheDocument()
    expect(screen.getByText('768')).toBeInTheDocument()
    expect(screen.getByText('4820')).toBeInTheDocument()
    expect(screen.getByText(/embed \$0\.15 \/ 1M karakter/)).toBeInTheDocument()
    expect(screen.getByText('$0.0004')).toBeInTheDocument()
    // none of the generation apparatus: no bare "$", no token bar, no net-prompt footnote
    expect(screen.queryByText(/input \$/)).toBeNull()
    expect(screen.queryByText(/nem jelentett token-használatot/)).toBeNull()
    expect(screen.queryByText(/A számlázás nettó prompttal/)).toBeNull()
  })

  it('shows the media metadata a vision or transcribe call carries', async () => {
    const id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls/${id}`, () =>
        HttpResponse.json({
          ...LLM_CALL_DETAIL_MOCK, id, feature: 'meal_draft', operation: 'photo',
          callKind: 'VISION', toolRounds: null,
          imageCount: 1, imageBytesTotal: 862_208, imageMime: 'image/jpeg',
        }),
      ),
    )
    renderDetail(id)

    await waitFor(() => expect(screen.getByText('1 db')).toBeInTheDocument())
    expect(screen.getByText('842.0 kB')).toBeInTheDocument()
    expect(screen.getByText('image/jpeg')).toBeInTheDocument()
    // a vision call still reports tokens — the media block is additional, not a replacement
    expect(screen.getByText(/gondolkodás/)).toBeInTheDocument()
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

  it('shows the retention notice instead of silent empty payload when scrubbed', async () => {
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls/${LLM_CALL_DETAIL_MOCK.id}`, () =>
        HttpResponse.json({
          ...LLM_CALL_DETAIL_MOCK,
          systemPrompt: null,
          userMessage: null,
          responseText: null,
          payloadScrubbedAt: '2026-08-18T02:40:00Z',
        }),
      ),
    )
    renderDetail()
    expect(await screen.findByText(/retention törölte/)).toBeInTheDocument()
  })

  it('shows the retention notice, not the truncation banner, on a scrubbed row that was also truncated', async () => {
    // truncated: true would normally raise the red "A payload csonkolva lett…" banner, but once
    // payloadScrubbedAt is set the payload is gone by design (retention), not by accident
    // (truncation) — the honest scrubbed notice must win, not both / not the misleading one.
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls/${LLM_CALL_DETAIL_MOCK.id}`, () =>
        HttpResponse.json({
          ...LLM_CALL_DETAIL_MOCK,
          systemPrompt: null,
          userMessage: null,
          responseText: null,
          truncated: true,
          payloadScrubbedAt: '2026-08-18T02:40:00Z',
        }),
      ),
    )
    renderDetail()
    expect(await screen.findByText(/retention törölte/)).toBeInTheDocument()
    expect(screen.queryByText(/csonkolva/)).not.toBeInTheDocument()
  })
})
