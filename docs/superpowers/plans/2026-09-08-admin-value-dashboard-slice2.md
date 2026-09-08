# Admin value dashboard — Slice 2: Pulzus UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/admin` into the approved "Pulzus" landing: status band (alerts) → 4 KPI posters → 2 trends with per-domain/per-feature legends → 3 top-N tiles with "összes →" drill links.

**Architecture:** Frontend-only. `AdminOverviewPage` is rebuilt as `Pulzus` using the slice-1 `useAdminAlerts()` hook, the already-returned-but-unrendered `overview.domainSeries`/`loggedToday`, and the existing cost-matrix endpoint (7d for top lists, 30d for the cost trend legend). New shared components (`AdminStatusBand`, `TopListTile`) live in `features/admin/components/` for reuse by slices 4–6. All keys render through the slice-0 label dictionary (`featureLabel`), and alert `subject` values are labelled client-side. Approved visual reference: the "A irány — Pulzus" frame of the accepted mockup (scratchpad `admin-redesign-iranyok.html`, structure mirrored in this plan); CSS goes into the `.ad-*` namespace of `frontend/src/styles/prototype.css`.

**Tech Stack:** React 19 + TS, TanStack Query via `useDualQuery`, hand-rolled SVG (existing `Sparkline`, `.ad-ring` idiom), vitest + testing-library, MSW.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-value-dashboard-design.md` §1 Pulzus. Epic **mezo-l096**.

## Global Constraints

- Hungarian copy only; every feature/table/screen key through `featureLabel`/`tableLabel` (slice 0) — raw keys only via the honest `missing` fallback ("nincs címke" marker).
- Per-tile error isolation via the existing `AdminTile query={...}` wrapper — a failing endpoint degrades one tile, never the page.
- Alerts band states: alerts → amber band with clickable chips (navigate to `alert.link`); empty → green "Minden rendben"; query error → grey "Az ellenőrzés most nem fut" (never fake green).
- Both-mode tests (`pnpm vitest run …` and `VITE_USE_MOCK=false …` from `frontend/`); NEVER the full frontend suite locally (mezo-c4ib pre-existing failures); no backend commands.
- Admin lazy-chunk discipline (only admin + shared kit imports); entrance choreography stays inside `ArrivalProvider` (`AdminLayout` provides it — new components must not re-trigger).
- Mock seeds + MSW handlers for anything new; mock queries follow the `realStaleTime` idiom.
- Conventional commits with the slice id from Task 0.
- Branch `feat/admin-slice2-pulzus` off main AFTER slice 1 is merged.

## Data honesty rulings (bind the implementer)

- **Rendszer KPI**: derived from the alerts response (ring = green/full when 0 warn/bad alerts; otherwise shows the count with a warn tag). There is NO install-wide job registry — do not invent "17/18 folyamat" numbers; the poster shows "riasztás: n" semantics honestly.
- **Memória KPI**: `overview.vectorCount` + `memoryItemCount` plus a badge derived from a `memory_stuck` alert if present. The healthy-share ring needs an install-wide health endpoint that does not exist yet — deferred to slice 7; do NOT fake a percentage.
- **Költés ma Δ**: computed client-side from the 30-day cost series (yesterday-relative 7-day average), pure function unit-tested.

---

### Task 0: Branch + bd bookkeeping

- [ ] **Step 1:** `bd create --title="admin slice 2: Pulzus UI — status band, KPI posters, trends, top lists" --type=task --priority=1` → `<ID>`; `bd update <ID> --claim`.
- [ ] **Step 2:** `git checkout main && git pull --rebase && git checkout -b feat/admin-slice2-pulzus`.

### Task 1: Status band component

**Files:**
- Create: `frontend/src/features/admin/components/AdminStatusBand.tsx`
- Test: `frontend/src/features/admin/components/AdminStatusBand.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (append `.ad-status*` block)

**Interfaces:**
- Consumes: `useAdminAlerts()` (slice 1), `featureLabel` (slice 0), `useNavigate`.
- Produces: `<AdminStatusBand />` — self-contained (calls the hook itself), rendered at the top of the Pulzus mosaic spanning 12 columns.

- [ ] **Step 1: Failing tests** (render with the file-local QueryClient/provider harness the sibling component tests use — read `AdminTile.test.tsx` first and copy its setup):

```tsx
it('lists clickable alert chips when alerts exist (mock seed has 2)', async () => {
  renderBand()
  expect(await screen.findByText('Tegnapi AI-költés kiugróan magas')).toBeInTheDocument()
  expect(screen.getByText('Elakadt emlék-feldolgozás')).toBeInTheDocument()
  expect(screen.getByText(/figyelmet kér/)).toBeInTheDocument() // "Két dolog figyelmet kér"
})

it('navigates to the alert link on chip click', async () => {
  renderBand()
  fireEvent.click(await screen.findByText('Tegnapi AI-költés kiugróan magas'))
  expect(mockedNavigate).toHaveBeenCalledWith('/admin/cost?day=2026-09-07')
})

it('renders the green all-good state on empty alerts', async () => {
  // override the MSW handler / mock to return { generatedAt, alerts: [] } the way sibling tests override responses
  renderBand()
  expect(await screen.findByText('Minden rendben')).toBeInTheDocument()
})

it('renders the grey unavailable state on error, never green', async () => {
  // error override
  renderBand()
  expect(await screen.findByText('Az ellenőrzés most nem fut')).toBeInTheDocument()
  expect(screen.queryByText('Minden rendben')).not.toBeInTheDocument()
})

it('labels the subject via the dictionary when present', async () => {
  // seed an llm_errors alert with subject 'companion_chat' in the override
  renderBand()
  expect(await screen.findByText(/Beszélgetés a társsal/)).toBeInTheDocument()
})
```

- [ ] **Step 2:** Run `pnpm vitest run src/features/admin/components/AdminStatusBand.test.tsx` → RED.
- [ ] **Step 3: Implement.** Structure (port the approved mockup's band; severity → wash):

```tsx
// Status band (mezo-l096 §1): the ONE place the admin says "baj van" / "minden rendben".
// Error state is grey and explicit — a failed check must never look like a green all-clear.
export function AdminStatusBand() {
  const alerts = useAdminAlerts()
  const navigate = useNavigate()
  if (alerts.isError) return <div className="ad-status off">…Az ellenőrzés most nem fut…</div>
  if (!alerts.data) return <div className="ad-status off" aria-busy="true" />
  const items = alerts.data.alerts
  if (items.length === 0) return (
    <div className="ad-status allok"><span className="ico ok" aria-hidden />…<h3>Minden rendben</h3>…</div>
  )
  const headline = items.length === 1 ? 'Egy dolog figyelmet kér' : `${HUN_COUNT[items.length] ?? items.length} dolog figyelmet kér`
  return (
    <div className="ad-status">
      …headline + per-alert chip:
      <button className={cn('ad-alert', a.severity)} onClick={() => navigate(a.link)}>
        <i aria-hidden />
        {a.subject ? `${featureLabel(a.subject).label}: ` : ''}{a.title}
        <span className="go">Megnézem →</span>
      </button>
      …title/detail: chip shows title; `title` attribute (tooltip) carries detail…
    </div>
  )
}
```

`HUN_COUNT`: `{1:'Egy',2:'Két',3:'Három',4:'Négy',5:'Öt'}` — beyond 5 the numeral is fine. CSS: port `.ad-status`, `.ad-status.allok`, `.ad-alert` from the approved mockup into `prototype.css` (`.ad-status.off` = grey variant: `background: rgba(43,33,24,.05)`, muted text).

- [ ] **Step 4:** Component tests both modes → GREEN. Commit: `feat(admin): Pulzus status band — alerts, all-good and unavailable states (<ID>)`.

### Task 2: Top-list tile component + viz helpers

**Files:**
- Create: `frontend/src/features/admin/components/TopListTile.tsx`
- Modify: `frontend/src/features/admin/lib/adminViz.ts` (+ its test file)
- Test: `frontend/src/features/admin/components/TopListTile.test.tsx`, `frontend/src/features/admin/lib/adminViz.test.ts` (extend existing if present, else create)

**Interfaces:**
- Produces: `<TopListTile title eyebrow rows={TopRow[]} moreLabel moreTo unit? />` with `type TopRow = { key: string; label: string; sub?: string; value: string; share: number /* 0..1 bar width */; to?: string }`; helpers `sumMatrixByUser(matrix): TopRow[]`-shaped aggregation utilities in `adminViz.ts`: `topNFromEntries(entries: Array<{key,label,value:number}>, n, fmt): TopRow[]` and `costMatrixTotals(matrix, axis: 'user'|'feature'): Array<{key,label,value}>` (labels resolved via `featureLabel` for the feature axis, user names from the matrix's user list, null created_by bucket labelled 'Háttér' with sub 'rendszer').
- Consumes: cost-matrix response type from `api.gen.ts` (the existing endpoint's schema — read it in `adminInsightsApi.ts`/`api.gen.ts` first and adapt the helper signatures to the REAL shape; the names above are binding, the parameter types follow the schema).

- [ ] **Step 1: Failing unit tests** for the helpers (pure functions): totals per axis from a 2-user × 2-feature fixture incl. a null-user cell → 'Háttér' bucket; `topNFromEntries` sorts desc, computes `share` relative to max, formats values, truncates to n.
- [ ] **Step 2:** RED run (the two new test files).
- [ ] **Step 3:** Implement helpers + the tile (rank number, label+sub, share bar, right-aligned value, `moreTo` link rendered via `Link` with the `ad-more` class — port row markup/CSS from the approved mockup's `.ad-top` block into `prototype.css`).
- [ ] **Step 4:** GREEN both modes. Commit: `feat(admin): TopListTile + cost-matrix aggregation helpers (<ID>)`.

### Task 3: Rebuild AdminOverviewPage as Pulzus

**Files:**
- Modify: `frontend/src/features/admin/pages/AdminOverviewPage.tsx` (full rebuild inside; export name stays `AdminOverviewPage` — routing untouched)
- Modify: `frontend/src/features/admin/AdminRail.tsx` (label `Áttekintés` → `Pulzus`, icon stays)
- Modify: `frontend/src/features/admin/pages/AdminOverviewPage.test.tsx` (rewrite assertions)
- Modify: `frontend/src/data/admin/adminInsightsHooks.ts` ONLY IF the cost-matrix hook is missing a 7d variant (check first — the endpoint takes `period`; a parameterised hook may already exist).

**Layout (12-col mosaic, in order):**
1. `<AdminStatusBand />` (sp12)
2. KPI posters (4 × sp3), per the Data honesty rulings: **Rendszer** (ring: full sage when 0 alerts; else count + `ad-tag warn/bad`), **Költés ma** (`overview.costTodayUsd` big numeral + Δ chip vs trailing 7-day avg — pure fn `deltaVsTrailingAvg(series, days=7)` added to `adminViz.ts` with unit test: returns {pct, direction} and handles zero-avg → 'új költés' copy), **Aktív ma** (`activeToday`/`userCount`), **Memória** (`memoryItemCount` + `vectorCount`, badge from a `memory_stuck` alert when present).
3. Trends (2 × sp6): **Költés 30 nap** — existing sp12 cost sparkline becomes sp6; legend = top 3 features by 30d cost (`costMatrixTotals(matrix30d,'feature')` top 3 + 'Egyéb' remainder) with `featureLabel` names; **Aktivitás 30 nap** — sparkline of summed `domainSeries` per day, legend = per-domain 30d totals (labels via `featureLabel` on the domain keys: Edzés, Étkezés, Alvás, Napló…).
4. Top-N tiles (3 × sp4): **Kik viszik a költést · 7 nap** (`costMatrixTotals(matrix7d,'user')` → `TopListTile`, moreTo `/admin/users`), **Mire megy a pénz · 7 nap** (`'feature'` axis, moreTo `/admin/cost`), **Csendes tesztelők** (from the existing users-list hook: non-owner users sorted by `lastActivityAt` asc, rows "X napja", only those ≥3 days quiet; empty state "Mindenki járt itt mostanában 🎉" — NO, no emoji: "Mindenki járt itt mostanában." plain; moreTo `/admin/users`, moreLabel `Minden tesztelő aktivitása →`).

- [ ] **Step 1: Rewrite the page test first** (both modes): asserts — status band present; 'Pulzus' heading; the four KPI eyebrows (RENDSZER/KÖLTÉS MA/AKTÍV MA/MEMÓRIA); legend shows a Hungarian feature label from the mock cost matrix (e.g. the seed's top feature name via `featureLabel`); the three top-list titles; a "Kik viszik a költést" row navigates/links to `/admin/users`; rail shows 'Pulzus'. RED.
- [ ] **Step 2:** Implement the rebuild. Keep `AdminTile query={...}` isolation per tile group (alerts band handles itself; KPI row bound to the overview query; each top-list bound to its own query). Entrance delays via the existing `--d` pattern.
- [ ] **Step 3:** GREEN both modes: `pnpm vitest run src/features/admin` and real-mode equivalent. Update any other test asserting the old 'Áttekintés' rail label.
- [ ] **Step 4:** Commit: `feat(admin): Pulzus landing — KPI posters, trend legends, top lists (<ID>)`.

### Task 4: Gates + visual check + ship

- [ ] **Step 1:** `pnpm vitest run src/features/admin src/data/admin` both modes; `pnpm build`; `node scripts/gen-codemap.mjs --check` (regenerate + commit if stale).
- [ ] **Step 2:** Controller visual check (not the implementer): mock-mode dev server, screenshot `/admin` at 1440px, compare against the approved mockup frame — band, posters, trends, top lists, legends all present and Hungarian.
- [ ] **Step 3:** Ship per house flow (push, self-PR, CI, premerge, `--no-ff` merge, push, delete branch, `bd close <ID>`).

## Self-review notes

- Spec §1 Pulzus fully covered except the memory healthy-share ring (deferred to slice 7 by the honesty ruling, recorded above).
- Component names bind later slices: `AdminStatusBand`, `TopListTile`, `topNFromEntries`, `costMatrixTotals`, `deltaVsTrailingAvg`.
- The cost-matrix response shape is read from `api.gen.ts` at implementation time — helper signatures adapt to the real schema, names stay.
