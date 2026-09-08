import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminUserDetailPage } from '@/features/admin/pages/AdminUserDetailPage'
import {
  ADMIN_USER_DETAIL_MOCK,
  ADMIN_USER_FEEDBACK_NONE_MOCK,
  userFeedbackMockFor,
} from '@/data/admin/adminInsightsMock'
import { ADMIN_ROWS_MOCK } from '@/data/admin/adminDataMock'
import { MOCK_BELA_ID } from '@/data/admin/adminMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage(id = ADMIN_USER_DETAIL_MOCK.user.id) {
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${id}`]}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
        <Route path="/admin/users" element={<div>USERS LIST PAGE</div>} />
        <Route path="/admin/users/:id/memory" element={<div>MEMORY PAGE</div>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

// Fix round 1 (Finding 1): mount the page under a route that does NOT capture an `:id` param,
// so `useParams().id` is `undefined` and `userId` is `''` — the same shape the app hits if this
// page is ever reached without an id. `useAdminUserDetail` passes `enabled: id !== ''`, so in
// real mode this query never fetches and (pre-fix) never leaves `isPending`.
function renderPageWithoutId() {
  return render(
    <MemoryRouter initialEntries={['/admin/users/detail']}>
      <Routes>
        <Route path="/admin/users/detail" element={<AdminUserDetailPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('AdminUserDetailPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the six tabs (Funkciók renamed, Visszajelzések new before Memória), opening on Aktivitás', async () => {
    renderPage()
    expect(await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)).toBeInTheDocument()
    const tabs = ['Aktivitás', 'Adatok', 'Funkciók', 'Költség', 'Visszajelzések', 'Memória']
    for (const t of tabs) {
      expect(screen.getByRole('tab', { name: t })).toBeInTheDocument()
    }
    // Order matters — Visszajelzések sits right before Memória (plan Task 3).
    expect(screen.getAllByRole('tab').map((el) => el.textContent)).toEqual(tabs)
    expect(screen.getByRole('tab', { name: 'Aktivitás' })).toHaveAttribute('aria-selected', 'true')
  })

  // mezo-4qyt.3: "Memória" is a link dressed as a tab — it NAVIGATES to its own route rather
  // than switching local tab state, so `aria-selected` is never true for it (asserted below).
  it('Memória navigates to the memory sub-route instead of switching the local tab', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    expect(screen.getByRole('tab', { name: 'Memória' })).toHaveAttribute('aria-selected', 'false')
    fireEvent.click(screen.getByRole('tab', { name: 'Memória' }))
    expect(await screen.findByText('MEMORY PAGE')).toBeInTheDocument()
  })

  it('switches the rendered panel when a tab is clicked', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    expect(screen.queryByText(ADMIN_USER_DETAIL_MOCK.inventory[0].table)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Adatok' }))
    expect(await screen.findByText(ADMIN_USER_DETAIL_MOCK.inventory[0].table)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Adatok' })).toHaveAttribute('aria-selected', 'true')
  })

  // mezo-zde2 Task 3 — per-domain heat strips replace the old single summed strip; each of
  // ADMIN_USER_DETAIL_MOCK's two domains (train/food) gets its own labelled row, and the
  // first/last-seen line is computed from the same series (firstLastActivity: index 0 and 88
  // active -> daysAgo 89 and 1, see adminViz.test.ts's hand-worked fixture for the arithmetic).
  it('Aktivitás tab renders one heat strip per domain, HU-labelled, plus a first/last seen line', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    expect(screen.getByText('Edzés')).toBeInTheDocument() // featureLabel('train')
    expect(screen.getByText('Étkezés')).toBeInTheDocument() // featureLabel('food')
    // two independent heat strips, not one summed strip
    expect(document.querySelectorAll('.ad-heat').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/89 napja/)).toBeInTheDocument()
    expect(screen.getByText(/1 napja/)).toBeInTheDocument()
  })

  // Final review F1 — `featureUsage30d` is 0-merged across every domain by the backend, so a
  // raw `Object.keys()` used-set would mark every domain feature "used" and the never-discovered
  // section could never list one. `ADMIN_USER_DETAIL_MOCK.featureUsage30d` now carries a GENUINE
  // zero (`train_meso_plan: 0`) precisely to pin this: it must be excluded from the adoption
  // list (0-call rows are noise) AND must still show up in "Ezeket még nem találta meg" even
  // though its key is present in the map — only `companion_chat`(34)/`meal_draft`(12)/`food`(9)
  // count as "used". Board non-system keys: companion_chat/meal_draft/meal_coach/
  // train_meso_plan/proactive_feed/food — meal_coach and proactive_feed were never in
  // featureUsage30d at all, the classic "never tried" case.
  it('Funkciók tab lists only n>0 adoption rows and never-discovered honestly includes a genuine-zero key (F1)', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    fireEvent.click(screen.getByRole('tab', { name: 'Funkciók' }))
    expect(await screen.findByText('Ezeket még nem találta meg')).toBeInTheDocument()

    // adoption list: real, used (n>0) rows only
    expect(screen.getByText('Beszélgetés a társsal')).toBeInTheDocument() // companion_chat, 34
    expect(screen.getByText('34')).toBeInTheDocument()
    expect(screen.getByText('Étel-felismerés')).toBeInTheDocument() // meal_draft, 12

    // never-discovered: meal_coach/proactive_feed (never tried) AND train_meso_plan (genuine 0
    // in featureUsage30d — F1's core assertion), but NOT companion_chat/meal_draft/food (used).
    const neverDiscoveredTile = screen.getByText('Ezeket még nem találta meg').closest<HTMLElement>('.mz-tile')!
    expect(within(neverDiscoveredTile).getByText('Edzésterv-készítés')).toBeInTheDocument() // train_meso_plan
    expect(within(neverDiscoveredTile).getByText('Étkezési tanácsadó')).toBeInTheDocument() // meal_coach
    expect(within(neverDiscoveredTile).getByText('Üzenőfal-üzenetek')).toBeInTheDocument() // proactive_feed
    expect(within(neverDiscoveredTile).queryByText('Beszélgetés a társsal')).toBeNull() // companion_chat used
    expect(within(neverDiscoveredTile).queryByText('Étel-felismerés')).toBeNull() // meal_draft used
    expect(within(neverDiscoveredTile).queryByText('Étkezés')).toBeNull() // food used

    // the system row never appears in either section
    expect(screen.queryByText('Ismeretlen hívás')).toBeNull()
  })

  // mezo-zde2 Task 3 — the new Visszajelzések tab: surface names, ▲/▼ counts, reasons, recall %.
  // renderPage() mounts Anna's row (ADMIN_USER_DETAIL_MOCK.user is Anna's insight per the mock's
  // own comment), so `userFeedbackMockFor` serves ADMIN_USER_FEEDBACK_ANNA_MOCK.
  it('Visszajelzések tab lists surfaces with reasons and the recall ratio line', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    fireEvent.click(screen.getByRole('tab', { name: 'Visszajelzések' }))
    expect(await screen.findByText('Beszélgetés')).toBeInTheDocument() // surfaceLabel('chat_message')
    expect(screen.getByText('Heti javaslat')).toBeInTheDocument() // surfaceLabel('weekly_suggestion')
    expect(screen.getByText('▲4')).toBeInTheDocument()
    expect(screen.getByText('▼1')).toBeInTheDocument()
    expect(screen.getByText('Rossz időzítés')).toBeInTheDocument() // feedbackReasonLabel('bad_timing')
    // recall: useful 3, irrelevant 1 -> 3/(3+1) = 75%
    expect(screen.getByText(/75%-a volt hasznos/)).toBeInTheDocument()
  })

  // On-but-empty: `surfaces: []` (Béla in the real seed) is a real, honest zero — never a fake
  // fallback. Route this render at Béla's id directly against `userFeedbackMockFor`'s own
  // fallback (mock mode reads through the real fetch fn regardless of VITE_USE_MOCK's msw wiring
  // for this id, since MOCK_BELA_ID has no detail seed — assert against the feedback fetch only
  // by hitting the tab and relying on `userFeedbackMockFor(MOCK_BELA_ID)` === NONE_MOCK).
  it('Visszajelzések tab shows the honest empty state when companion is on but no votes were cast', async () => {
    expect(userFeedbackMockFor(MOCK_BELA_ID)).toEqual(ADMIN_USER_FEEDBACK_NONE_MOCK)
    renderPage(MOCK_BELA_ID)
    fireEvent.click(await screen.findByRole('tab', { name: 'Visszajelzések' }))
    expect(await screen.findByText('Még nem adott visszajelzést.')).toBeInTheDocument()
  })

  it('navigates back to the users list', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    fireEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(await screen.findByText('USERS LIST PAGE')).toBeInTheDocument()
  })
})

describe('AdminUserDetailPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('renders the fetched user', async () => {
    renderPage()
    expect(await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)).toBeInTheDocument()
  })

  it('shows a tile-level error with a retry when the detail fetch fails', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users/:id/insight`, () => new HttpResponse(null, { status: 500 })))
    renderPage()
    expect(await screen.findByText(/nem elérhető/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /újra/i })).toBeInTheDocument()
  })

  // Companion-off override: `surfaces: null` renders the honest "ki van kapcsolva" tile instead
  // of an empty list (which would be indistinguishable from "on but no votes"). Real mode only —
  // mock mode never touches MSW, so this override would be silently ignored there.
  it('Visszajelzések tab shows "ki van kapcsolva" when the companion switch is off (surfaces null)', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users/:id/feedback`, () => HttpResponse.json({ surfaces: null, recall: null })))
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    fireEvent.click(screen.getByRole('tab', { name: 'Visszajelzések' }))
    expect(await screen.findByText('ki van kapcsolva')).toBeInTheDocument()
  })

  // Fix round 1 (Finding 1): with no `:id` in the route, `useAdminUserDetail`'s query is
  // `enabled: false` and (in real mode, no cache) never leaves `isPending` — a `notFound` that
  // waited on `!isPending` could never fire. Assert the message renders instead of hanging.
  it('shows the not-found message when the route has no id, without waiting on a query that never resolves', async () => {
    renderPageWithoutId()
    expect(await screen.findByText('Ez a user nem található.')).toBeInTheDocument()
  })

  // Fix round 1 (Finding 2): the brief's Step 5 deliverable — the row browser embedded in the
  // Adatok tab — was previously never mounted by any test. The prior "switches the rendered
  // panel when a tab is clicked" test only clicks the Adatok TAB and asserts the inventory
  // table renders; it never clicks an inventory ROW, so <DataTable>/useAdminRows inside this
  // page were never exercised, and the report's "transitively covers it" claim was false (now
  // corrected there too). This clicks a row and proves the embedded browser actually mounts,
  // is bound to that table, and — the whole point of embedding it here rather than sending the
  // owner to the standalone /admin/data — is scoped to the CURRENT route user's id.
  it('clicking an inventory row mounts the embedded row browser scoped to this user', async () => {
    let seen = ''
    server.use(http.get(`${API_BASE}/api/admin/data/tables/:table/rows`, ({ request }) => {
      seen = new URL(request.url).search
      return HttpResponse.json(ADMIN_ROWS_MOCK.train_session)
    }))
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    fireEvent.click(screen.getByRole('tab', { name: 'Adatok' }))

    const tableName = ADMIN_USER_DETAIL_MOCK.inventory[0].table // 'train_session'
    fireEvent.click(await screen.findByText(tableName))

    // Bound to the selected table (eyebrow echoes `{table} · {total} sor`, DataTable renders
    // that table's own columns) — not some other/unfiltered surface.
    expect(await screen.findByText(`${tableName} · 2 sor`)).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /created_by/ })).toBeInTheDocument()

    // Scoped to the route's user, not the whole table.
    await waitFor(() => expect(seen).toContain(`userId=${ADMIN_USER_DETAIL_MOCK.user.id}`))
  })
})
