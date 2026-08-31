import type { ReactNode } from 'react'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { FuelSlotsPage } from '@/features/fuel/pages/FuelSlotsPage'
import { useSlotTemplateActions, useSlotTemplates } from '@/data/hooks'
import type { SlotTemplate } from '@/data/types'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}
const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderPage(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/fuel', '/fuel/slots']} initialIndex={1}>
        <Routes>
          <Route path="/fuel/slots" element={<FuelSlotsPage />} />
          <Route path="/fuel" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const SAMPLE: SlotTemplate = {
  dayType: 'rest',
  slots: [
    { label: 'Reggeli', slotKind: 'breakfast', role: 'standard', anchor: { type: 'fixed', time: '07:00' }, budgetPct: 40 },
    { label: 'Ebéd', slotKind: 'lunch', role: 'standard', anchor: { type: 'fixed', time: '13:00' }, budgetPct: 60 },
  ],
}

test('no cached template: shows the recommended preview + a Testreszabás CTA', async () => {
  const qc = newQc()
  renderPage(qc)
  expect(screen.getByRole('tablist', { name: 'Naptípusok' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Pihenőnap' })).toHaveAttribute('aria-selected', 'true')
  expect(await screen.findByRole('button', { name: /Testreszabás/ })).toBeInTheDocument()
  // read-only preview: no editable slot-name inputs yet
  expect(screen.queryByLabelText('Slot neve')).not.toBeInTheDocument()
})

test('Testreszabás forks the recommendation into editable rows; an off-Σ pct shows the sum_pct error and disables Mentés', async () => {
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))

  const nameInputs = await screen.findAllByLabelText('Slot neve')
  expect(nameInputs.length).toBeGreaterThanOrEqual(2)

  // freshly forked rows are normalized to Σ=100 → Mentés starts enabled
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()

  const pctInputs = screen.getAllByLabelText('Budget %') as HTMLInputElement[]
  await userEvent.clear(pctInputs[0])
  await userEvent.type(pctInputs[0], '5')

  expect(await screen.findByRole('alert')).toHaveTextContent('100%')
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
})

// mezo-4ghd fix 1: mirrors the wire's SlotTemplateSlot.label maxLength:40 — an empty/whitespace
// label is a save-blocking tier-1 error (label_length), and the input itself hard-caps at 40 chars.
test('an emptied label shows the label_length error and disables Mentés', async () => {
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))

  const nameInputs = await screen.findAllByLabelText('Slot neve')
  expect(nameInputs[0]).toHaveAttribute('maxLength', '40')
  await userEvent.clear(nameInputs[0])

  expect(await screen.findByRole('alert')).toHaveTextContent('névtelen')
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
})

// mezo-4ghd fix 2: Budget % commits as a clamped integer (wire: integer 1..100, parseInt
// semantics) — verified via the always-rendered Σ BUDGET pill, which reflects the committed
// (not the raw typed) row values.
test('Budget % commits a clamped integer: "12.5" truncates to 12, "0" clamps to 1', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useSlotTemplateActions(), { wrapper })
  await act(() => result.current.putTemplate(SAMPLE)) // Reggeli 40% / Ebéd 60%

  renderPage(qc)
  const pctInputs = await screen.findAllByLabelText('Budget %')

  await userEvent.clear(pctInputs[0])
  await userEvent.type(pctInputs[0], '12.5')
  expect(await screen.findByText('72%')).toBeInTheDocument() // 12 (truncated) + 60

  await userEvent.clear(pctInputs[1])
  await userEvent.type(pctInputs[1], '0')
  expect(await screen.findByText('13%')).toBeInTheDocument() // 12 + 1 (clamped)
})

// mezo-4ghd fix 3: the relative-anchor "Eltolás perc" input clamps its committed value into the
// wire's [-720, 720] bounds.
test('Eltolás perc clamps its committed value to ±720', async () => {
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))

  const anchorSelects = screen.getAllByLabelText('Horgony')
  await userEvent.selectOptions(anchorSelects[0], 'wake')
  const offsetInput = await screen.findByLabelText('Eltolás perc')

  await userEvent.clear(offsetInput)
  await userEvent.type(offsetInput, '900')
  await waitFor(() => expect(offsetInput).toHaveValue('720'))

  await userEvent.clear(offsetInput)
  await userEvent.type(offsetInput, '-900')
  await waitFor(() => expect(offsetInput).toHaveValue('-720'))
})

// mezo-4ghd fix 4: forking before the slot-templates GET resolves in real mode used to be able to
// clobber a saved template that lands late (the `!forked` late-arrival sync never re-fires once a
// fork has already set `forked=true`). Disabling Testreszabás while the GET is pending closes it
// at the source.
test('real mode: Testreszabás is disabled while the slot-templates GET is pending', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/fuel/slot-templates`, async () => {
      await new Promise((r) => setTimeout(r, 50))
      return HttpResponse.json({ templates: [] })
    }),
  )
  const qc = newQc()
  renderPage(qc)

  expect(await screen.findByRole('button', { name: /Testreszabás/ })).toBeDisabled()
  await waitFor(() => expect(screen.getByRole('button', { name: /Testreszabás/ })).toBeEnabled())
})

// mezo-4ghd fix 5: switching the day-type tab used to unconditionally reset `rows`/`forked`,
// silently discarding an unsaved fork/edit. A per-day-type draft now survives the round trip.
test('a fork + edit on one day type survives switching away and back', async () => {
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))

  const nameInputs = await screen.findAllByLabelText('Slot neve')
  await userEvent.clear(nameInputs[0])
  await userEvent.type(nameInputs[0], 'Egyedi Reggeli')

  await userEvent.click(screen.getByRole('tab', { name: 'Reggeli edzés' }))
  // training_am has no saved/forked template yet — the read-only recommended preview, not the
  // (unrelated) editor.
  expect(screen.queryByLabelText('Slot neve')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('tab', { name: 'Pihenőnap' }))
  expect(await screen.findByDisplayValue('Egyedi Reggeli')).toBeInTheDocument()
})

// mezo-4ghd fix round 1 (reviewer finding 1, CRITICAL): a draft stashed while a saved template was
// loaded (switch away+back seeds it, since a loaded template starts `forked=true`) used to outlive
// "Ajánlott visszaállítása" deleting that template server-side — a LATER switch-away+back would
// then resurrect the deleted template's rows as an editable fork, and Mentés would silently
// re-create it. `resetToRecommended` now clears that day type's draft too.
test('reset-then-revisit: deleting a saved template also clears its stashed draft — no resurrection', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => ({ read: useSlotTemplates(), act: useSlotTemplateActions() }), { wrapper })
  await act(() => result.current.act.putTemplate(SAMPLE))

  renderPage(qc)
  expect(await screen.findAllByLabelText('Slot neve')).toHaveLength(2)

  // Switch away and back ONCE while the saved template is still loaded — this is what stashes a
  // draft for 'rest' (a loaded template starts `forked=true`).
  await userEvent.click(screen.getByRole('tab', { name: 'Reggeli edzés' }))
  await userEvent.click(screen.getByRole('tab', { name: 'Pihenőnap' }))
  expect(await screen.findAllByLabelText('Slot neve')).toHaveLength(2)

  await userEvent.click(screen.getByRole('button', { name: 'Ajánlott visszaállítása' }))
  await waitFor(() => expect(result.current.read.templates).toEqual([]))

  // Switch away and back again — the FIRST switch's stashed draft must not resurrect the now
  // deleted template.
  await userEvent.click(screen.getByRole('tab', { name: 'Reggeli edzés' }))
  await userEvent.click(screen.getByRole('tab', { name: 'Pihenőnap' }))

  expect(screen.queryByLabelText('Slot neve')).not.toBeInTheDocument()
  expect(await screen.findByRole('button', { name: /Testreszabás/ })).toBeInTheDocument()
})

// mezo-4ghd fix round 1 (reviewer finding 2, IMPORTANT): the render-time resync in `NumberField`
// only fires when the COMMITTED value changes between renders — typing "12.5" already commits 12
// at the "2" keystroke, so the trailing ".5" left the input showing "12.5" forever (the Σ pill and
// the wire were correct at 12, only the input's own text lagged). `onBlur` now settles it.
test('Budget % input settles to the committed integer on blur, even though it lagged while typing', async () => {
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))

  const pctInputs = await screen.findAllByLabelText('Budget %')
  await userEvent.clear(pctInputs[0])
  await userEvent.type(pctInputs[0], '12.5')
  expect(pctInputs[0]).toHaveValue('12.5') // lags while typing — unchanged, no keystroke-reset

  await userEvent.tab() // blur
  expect(pctInputs[0]).toHaveValue('12')
})

test('fork + Mentés saves the template to the cache and navigates back', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useSlotTemplates(), { wrapper })

  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))

  await waitFor(() => expect(result.current.templates.some(t => t.dayType === 'rest')).toBe(true))
  expect(await screen.findByTestId('location')).toHaveTextContent('/fuel')
})

// mezo-7102 fix wave, finding F2: out_of_span never fired on normal days because the page fed
// validateSlotPlan windows ALREADY clamped by compileTemplate — an anchor placed far outside the
// eating span was silently repaired instead of blocking save. The page now also feeds
// `resolveAnchorTimes`'s RAW (unclamped) resolution, which out_of_span evaluates instead.
test('a wake-anchored row resolving well before wake shows out_of_span and disables Mentés, even though the compiled window is clamped in-span', async () => {
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))

  await screen.findAllByLabelText('Slot neve')
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()

  const anchorSelects = screen.getAllByLabelText('Horgony')
  await userEvent.selectOptions(anchorSelects[0], 'wake')

  const offsetInput = await screen.findByLabelText('Eltolás perc')
  await userEvent.clear(offsetInput)
  await userEvent.type(offsetInput, '-300')

  expect(await screen.findByRole('alert')).toHaveTextContent('időszakon kívülre esik')
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
})

test('an existing template loads straight into the editor with Ajánlott visszaállítása; deleting empties the cache', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => ({ read: useSlotTemplates(), act: useSlotTemplateActions() }), { wrapper })
  await act(() => result.current.act.putTemplate(SAMPLE))

  renderPage(qc)
  expect(await screen.findAllByLabelText('Slot neve')).toHaveLength(2)
  const resetBtn = screen.getByRole('button', { name: 'Ajánlott visszaállítása' })

  await userEvent.click(resetBtn)
  await waitFor(() => expect(result.current.read.templates).toEqual([]))
  expect(screen.queryByRole('button', { name: 'Ajánlott visszaállítása' })).not.toBeInTheDocument()
})

// Fix round 1 regression (reviewer finding 1): in real mode `useSlotTemplates()` starts pending
// (`templates = []`), so a cold mount commits `rows = []` off a still-null `existing`. Before the
// fix, once the delayed GET resolved to a saved template, `existing` flipped non-null but `rows`
// never re-synced — the editor rendered the (stale) empty draft, tripping a spurious `too_few`
// error instead of showing the saved template. The FuelSettingsSheet.test.tsx delayed-handler
// idiom reproduces the race deterministically.
test('real mode cold mount: a delayed GET resolving to a saved template lands in the editor, not a stale empty draft', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/fuel/slot-templates`, async () => {
      await new Promise((r) => setTimeout(r, 50))
      return HttpResponse.json({
        templates: [
          {
            dayType: 'rest',
            slots: [
              { label: 'Reggeli', slotKind: 'breakfast', role: 'standard', anchorType: 'fixed', time: '07:00', budgetPct: 40 },
              { label: 'Ebéd', slotKind: 'lunch', role: 'standard', anchorType: 'fixed', time: '13:00', budgetPct: 60 },
            ],
          },
        ],
      })
    }),
  )
  const qc = newQc()
  renderPage(qc)

  // Cold frame: the GET is still pending — the recommended (read-only) view, never a broken
  // empty editor with a too_few error.
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Slot neve')).not.toBeInTheDocument()

  // Once the delayed GET resolves, the saved template's OWN rows render — not a stale empty draft.
  expect(await screen.findByDisplayValue('Reggeli')).toBeInTheDocument()
  expect(screen.getByDisplayValue('Ebéd')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ajánlott visszaállítása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()
})

// mezo-7102 Task 12: Mezo's qualitative "olvasat" on the current draft.
test('mock mode: Mezo értékelése shows the canned verdict card', async () => {
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Mezo értékelése' }))

  expect(await screen.findByText(/A felosztás illik a célodhoz/, {}, { timeout: 3000 })).toBeInTheDocument()
})

test('real mode: a 503 from the evaluate endpoint shows the honest-degrade note and leaves Mentés enabled', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.post(`${API_BASE}/api/fuel/slot-templates/evaluate`, () => new HttpResponse(null, { status: 503 })),
  )
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Mezo értékelése' }))

  expect(await screen.findByText(/Az AI-értékelés most nem elérhető/, {}, { timeout: 3000 })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()
})

test('mock mode: editing a row after a successful evaluate clears the verdict card', async () => {
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Mezo értékelése' }))
  expect(await screen.findByText(/A felosztás illik a célodhoz/, {}, { timeout: 3000 })).toBeInTheDocument()

  const nameInputs = screen.getAllByLabelText('Slot neve')
  await userEvent.type(nameInputs[0], '!')

  expect(screen.queryByText(/A felosztás illik a célodhoz/)).not.toBeInTheDocument()
})

// Fidelity audit (mezo-d20.11): the page had NO entrance choreography. Its FACE stays the
// pre-Mozaik `.pghead-np` editor one on purpose — the prototype does not cover the meal-window
// editor, so re-facing it belongs to the F7.3 design round, not to a 1:1 audit.
test('the editor rises inside an EntranceGroup with the Mozaik sage shell (F7.3)', async () => {
  const qc = newQc()
  const { container } = renderPage(qc)
  await screen.findByText('Étkezési ablakok')
  expect(container.querySelector('.mz-page.mz-p-sage')).not.toBeNull()
  const play = container.querySelector('.mz-play')
  expect(play).not.toBeNull()
  expect(play?.querySelector('.rise .mz-eyebrow')).not.toBeNull()
  const all = [...container.querySelectorAll('.rise')]
  expect(all.length).toBeGreaterThan(2)
  expect(all.every(el => play?.contains(el))).toBe(true)
})

test('real mode: Mentés PUTs the flattened wire body (fixed anchor)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let captured: { dayType: string; body: { slots: Record<string, unknown>[] } } | null = null
  server.use(
    http.put(`${API_BASE}/api/fuel/slot-templates/:dayType`, async ({ params, request }) => {
      const body = (await request.json()) as { slots: Record<string, unknown>[] }
      captured = { dayType: String(params.dayType), body }
      return HttpResponse.json({ dayType: params.dayType, ...body })
    }),
  )
  const qc = newQc()
  renderPage(qc)
  await userEvent.click(await screen.findByRole('button', { name: /Testreszabás/ }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))

  await waitFor(() => expect(captured).not.toBeNull())
  expect(captured!.dayType).toBe('rest')
  expect(captured!.body.slots.length).toBeGreaterThan(0)
  for (const slot of captured!.body.slots) {
    expect(slot).toEqual(
      expect.objectContaining({ anchorType: 'fixed', time: expect.any(String) }),
    )
    expect(slot).not.toHaveProperty('offsetMin')
  }
})
