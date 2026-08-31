# Tudásgráf Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat, full-card node lists on `/me/knowledge` with an overview-first layout: a 6-tile kind grid, a `?kind=` filtered category view of compact rows, and a node-detail bottom sheet — so the page stays ~1 screen at any node count.

**Architecture:** `KnowledgePage` owns the view switch (grid ⇄ category via `useSearchParams`) and the selected-node sheet state. Three new focused components under `features/me/`: `KindTileGrid` (Mozaik `Mosaic`+`Tile` grid), `KindNodeList` (category header + compact rows), `NodeDetailSheet` (rides the shared `Sheet`). Data layer untouched.

**Tech Stack:** React 18 + TypeScript, react-router-dom (`useSearchParams`), vitest + @testing-library/react, Mozaik UI kit (`@/shared/ui/mozaik`), shared `Sheet` primitive.

**Spec:** `docs/superpowers/specs/2026-08-31-tudasgraf-page-redesign-design.md` · **Issue:** mezo-2243

## Global Constraints

- All commits: conventional subject carrying `(mezo-2243)`, and end the message body with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Run all commands from the worktree root `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/tudasgraf-page-redesign-81b55c`; frontend commands from its `frontend/` subdir. Never `cd` to the primary repo.
- Focused test run: `cd frontend && pnpm vitest run <paths>` (vitest defaults to mock mode when `VITE_USE_MOCK` is unset — fine for these UI tests, they stub it themselves).
- Copy is Hungarian; reuse the exact strings given in each task (e.g. `‹ Kategóriák`, `{n} kapcsolat`, `Archivál`).
- The Tudástár boundary (mezo-0ap9): facts stay on Mezo → Tudástár; this page only shows graph nodes/connections. Do not touch `frontend/src/features/insights/` or the data layer (`@/data/*`).
- Mock seed reference (`frontend/src/data/insights/graph.ts` `graphNodeSeed`): PATTERN `Késői evés rontja az alvást` (2 topEdges), PREFERENCE `Niggle-aware exercise substitution preferred` (0 edges), GOAL `Identity goal: peak performance every life domain` (1 edge), LIFE_EVENT `Új munkahely első hete` (1 edge, has summary), profile node `Rólad tanultam` (sourceKind `'profile'`). SEASON and INSIGHT are empty in the seed.

---

### Task 1: NodeDetailSheet

**Files:**
- Create: `frontend/src/features/me/sheets/NodeDetailSheet.tsx`
- Test: `frontend/src/features/me/sheets/NodeDetailSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet` from `@/shared/ui/Sheet` (render-function child receives animated `close()`); `ClayIcon` from `@/shared/ui/clay`; `KIND_ICON` from `@/features/me/logic/knowledgeNodeVisuals`; `KnowledgeGraphNode` from `@/data/types`.
- Produces: `NodeDetailSheet({ node, onArchive, onClose }: { node: KnowledgeGraphNode; onArchive: () => void; onClose: () => void })` — later tasks import it by this exact signature.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/me/sheets/NodeDetailSheet.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeDetailSheet } from '@/features/me/sheets/NodeDetailSheet'
import type { KnowledgeGraphNode } from '@/data/types'

const node: KnowledgeGraphNode = {
  id: 'gn-4',
  kind: 'LIFE_EVENT',
  title: 'Új munkahely első hete',
  summary: 'Hétfőn kezdtél az új helyen, és a hét végére kimerültél.',
  topEdges: ['Új munkahely első hete → kiváltja → Megnövekedett stressz · közepes'],
  sourceKind: null,
}

test('renders title, summary, edge lines and the archive footnote', () => {
  render(<NodeDetailSheet node={node} onArchive={() => {}} onClose={() => {}} />)
  expect(screen.getByText('Új munkahely első hete')).toBeInTheDocument()
  expect(screen.getByText(/Hétfőn kezdtél az új helyen/)).toBeInTheDocument()
  expect(screen.getByText(/Megnövekedett stressz · közepes/)).toBeInTheDocument()
  expect(screen.getByText(/Archiválás után a következő heti összegzésig/)).toBeInTheDocument()
})

test('summary and edges are optional', () => {
  render(
    <NodeDetailSheet
      node={{ ...node, summary: null, topEdges: [] }}
      onArchive={() => {}}
      onClose={() => {}}
    />,
  )
  expect(screen.getByText('Új munkahely első hete')).toBeInTheDocument()
  expect(screen.queryByText(/Hétfőn kezdtél/)).not.toBeInTheDocument()
})

test('Archivál calls onArchive and dismisses the sheet', () => {
  const onArchive = vi.fn()
  const onClose = vi.fn()
  render(<NodeDetailSheet node={node} onArchive={onArchive} onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: 'Archivál' }))
  expect(onArchive).toHaveBeenCalledTimes(1)
  // the shared Sheet's animated close ends in onClose; under jsdom the
  // transitionend fallback timer fires, so wait for it
  return vi.waitFor(() => expect(onClose).toHaveBeenCalled())
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/me/sheets/NodeDetailSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/features/me/sheets/NodeDetailSheet.tsx
// ============================================================
// Mezo · NodeDetailSheet (mezo-2243) — the Tudásgráf node detail: the compact
// category rows carry only icon+title, so the summary, the backend-rendered HU
// edge lines and the L2 archive action live here. Riding the shared Sheet keeps
// dismissal identical to every other bottom sheet. The opener owns the data
// layer (`archive`) and wires it into `onArchive` — no `@/data/*` action import.
// Design: docs/superpowers/specs/2026-08-31-tudasgraf-page-redesign-design.md §3.
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { ClayIcon } from '@/shared/ui/clay'
import { KIND_ICON } from '@/features/me/logic/knowledgeNodeVisuals'
import type { KnowledgeGraphNode } from '@/data/types'

export function NodeDetailSheet({ node, onArchive, onClose }: {
  node: KnowledgeGraphNode
  onArchive: () => void
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} labelledBy="node-detail-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div className="mz-fic"><ClayIcon name={KIND_ICON[node.kind]} size={20} /></div>
            <h2 id="node-detail-title" className="h-display size-md">{node.title}</h2>
          </div>
          {node.summary && (
            <p className="mz-fact-tx" style={{ marginTop: 10 }}>{node.summary}</p>
          )}
          {node.topEdges.length > 0 && (
            <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none' }}>
              {node.topEdges.map((line) => (
                <li key={line} className="mz-fact-sb">{line}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="mz-decbtn"
            style={{ marginTop: 16, alignSelf: 'flex-start' }}
            onClick={() => { onArchive(); close() }}
          >
            Archivál
          </button>
          <p className="mz-fact-origin" style={{ marginTop: 8 }}>
            Archiválás után a következő heti összegzésig nem kerül a beszélgetésbe.
          </p>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/me/sheets/NodeDetailSheet.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/sheets/NodeDetailSheet.tsx frontend/src/features/me/sheets/NodeDetailSheet.test.tsx
git commit -m "feat(me): NodeDetailSheet for Tudásgráf node details (mezo-2243)"
```

---

### Task 2: KindTileGrid

**Files:**
- Create: `frontend/src/features/me/components/KindTileGrid.tsx`
- Test: `frontend/src/features/me/components/KindTileGrid.test.tsx`

**Interfaces:**
- Consumes: `Mosaic`, `Tile` from `@/shared/ui/mozaik` (`Tile` renders a `<button>` when `onClick` is given, a `<div>` otherwise; props `wash`, `icon`, `eyebrow`, `badge`, `line`, `delayMs`, `aria-label`); `GRAPH_KIND_GROUPS` from `@/data/insights/graph`; `KIND_ICON`, `KIND_WASH` from `@/features/me/logic/knowledgeNodeVisuals`.
- Produces: `KindTileGrid({ nodes, onOpenKind, baseDelayMs }: { nodes: KnowledgeGraphNode[]; onOpenKind: (kind: GraphNodeKind) => void; baseDelayMs?: number })` — `nodes` are the NON-profile graph nodes; `baseDelayMs` (default 90) is the entrance-stagger start, tiles step +30ms each.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/me/components/KindTileGrid.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { KindTileGrid } from '@/features/me/components/KindTileGrid'
import type { KnowledgeGraphNode } from '@/data/types'

const mk = (id: string, kind: KnowledgeGraphNode['kind'], title: string): KnowledgeGraphNode =>
  ({ id, kind, title, summary: null, topEdges: [], sourceKind: null })

const nodes = [
  mk('n1', 'PATTERN', 'Késői evés rontja az alvást'),
  mk('n2', 'PATTERN', 'Futás-napokon jobban alszol'),
  mk('n3', 'GOAL', 'Nyári forma'),
]

test('renders all six kind tiles with counts and the first node title as sample', () => {
  render(<KindTileGrid nodes={nodes} onOpenKind={() => {}} />)
  const pattern = screen.getByRole('button', { name: 'Minták' })
  expect(pattern).toHaveTextContent('2')
  expect(pattern).toHaveTextContent('Késői evés rontja az alvást')
  // empty kinds render as dimmed, non-interactive tiles (stable grid)
  expect(screen.queryByRole('button', { name: 'Szezonok' })).not.toBeInTheDocument()
  expect(screen.getByText('Szezonok')).toBeInTheDocument()
})

test('tapping a populated tile reports its kind', () => {
  const onOpenKind = vi.fn()
  render(<KindTileGrid nodes={nodes} onOpenKind={onOpenKind} />)
  fireEvent.click(screen.getByRole('button', { name: 'Célok' }))
  expect(onOpenKind).toHaveBeenCalledWith('GOAL')
})

test('populated tiles wear the kind wash, empty ones are dimmed', () => {
  render(<KindTileGrid nodes={nodes} onOpenKind={() => {}} />)
  expect(screen.getByRole('button', { name: 'Minták' })).toHaveClass('mz-w-sage')
  const seasonWrap = screen.getByText('Szezonok').closest('.tud-kind-empty')
  expect(seasonWrap).not.toBeNull()
  expect(seasonWrap).toHaveStyle({ opacity: '0.45' })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/me/components/KindTileGrid.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/features/me/components/KindTileGrid.tsx
// ============================================================
// Mezo · KindTileGrid (mezo-2243) — the Tudásgráf overview: one Mozaik tile per
// graph-node kind (GRAPH_KIND_GROUPS order) with the node count and the first
// node's title as a sample line. Empty kinds stay IN the grid, dimmed and inert
// — the mosaic never reflows when a new kind gains its first node. The wire
// model carries no timestamps, so the sample is "first in hook order", not
// "latest" (spec §1). Scroll problem this solves: the old flat card lists grew
// linearly with node count; this grid is constant-height.
// ============================================================
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { GRAPH_KIND_GROUPS } from '@/data/insights/graph'
import { KIND_ICON, KIND_WASH } from '@/features/me/logic/knowledgeNodeVisuals'
import type { GraphNodeKind, KnowledgeGraphNode } from '@/data/types'

export function KindTileGrid({ nodes, onOpenKind, baseDelayMs = 90 }: {
  nodes: KnowledgeGraphNode[]
  onOpenKind: (kind: GraphNodeKind) => void
  baseDelayMs?: number
}) {
  return (
    <Mosaic>
      {GRAPH_KIND_GROUPS.map(([kind, label], i) => {
        const items = nodes.filter(n => n.kind === kind)
        const delay = baseDelayMs + i * 30
        if (items.length === 0) {
          // Dimmed, inert placeholder — the grid never reflows when a kind
          // gains its first node. Tile has no style prop, hence the wrapper.
          return (
            <div key={kind} className="tud-kind-empty" style={{ opacity: 0.45 }}>
              <Tile wash={KIND_WASH[kind]} icon={KIND_ICON[kind]} iconSize={38}
                eyebrow={label} line="—" delayMs={delay} />
            </div>
          )
        }
        return (
          <Tile key={kind} wash={KIND_WASH[kind]} icon={KIND_ICON[kind]} iconSize={38}
            eyebrow={label} badge={items.length} line={items[0].title}
            delayMs={delay} onClick={() => onOpenKind(kind)} />
        )
      })}
    </Mosaic>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/me/components/KindTileGrid.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/components/KindTileGrid.tsx frontend/src/features/me/components/KindTileGrid.test.tsx
git commit -m "feat(me): KindTileGrid overview grid for the Tudásgráf (mezo-2243)"
```

---

### Task 3: KindNodeList (category view)

**Files:**
- Create: `frontend/src/features/me/components/KindNodeList.tsx`
- Test: `frontend/src/features/me/components/KindNodeList.test.tsx`

**Interfaces:**
- Consumes: `CategoryHeader` from `@/features/me/components/CategoryHeader` (`{ label, color, count }`); `ClayIcon` from `@/shared/ui/clay`; `KIND_ICON`, `KIND_INK`, `KIND_WASH` from `@/features/me/logic/knowledgeNodeVisuals`.
- Produces: `KindNodeList({ kind, label, nodes, onBack, onOpenNode }: { kind: GraphNodeKind; label: string; nodes: KnowledgeGraphNode[]; onBack: () => void; onOpenNode: (node: KnowledgeGraphNode) => void })`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/me/components/KindNodeList.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { KindNodeList } from '@/features/me/components/KindNodeList'
import type { KnowledgeGraphNode } from '@/data/types'

const nodes: KnowledgeGraphNode[] = [
  { id: 'n1', kind: 'PATTERN', title: 'Késői evés rontja az alvást', summary: null,
    topEdges: ['a → b · erős', 'b → c · közepes'], sourceKind: null },
  { id: 'n2', kind: 'PATTERN', title: 'Futás-napokon jobban alszol', summary: null,
    topEdges: [], sourceKind: null },
]

const setup = (over: Partial<Parameters<typeof KindNodeList>[0]> = {}) => {
  const onBack = vi.fn(); const onOpenNode = vi.fn()
  render(<KindNodeList kind="PATTERN" label="Minták" nodes={nodes}
    onBack={onBack} onOpenNode={onOpenNode} {...over} />)
  return { onBack, onOpenNode }
}

test('renders the category header, the back chip and one compact row per node', () => {
  setup()
  expect(screen.getByText('Minták · 2')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '‹ Kategóriák' })).toBeInTheDocument()
  expect(screen.getByText('Késői evés rontja az alvást')).toBeInTheDocument()
  // edge count rides the row; zero-edge rows omit it
  expect(screen.getByText('2 kapcsolat')).toBeInTheDocument()
  expect(screen.queryByText('0 kapcsolat')).not.toBeInTheDocument()
  // compact rows: no summary, no edge lines, no archive button
  expect(screen.queryByText('a → b · erős')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archivál' })).not.toBeInTheDocument()
})

test('back chip and row taps report up', () => {
  const { onBack, onOpenNode } = setup()
  fireEvent.click(screen.getByRole('button', { name: '‹ Kategóriák' }))
  expect(onBack).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Futás-napokon jobban alszol' }))
  expect(onOpenNode).toHaveBeenCalledWith(nodes[1])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/me/components/KindNodeList.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/features/me/components/KindNodeList.tsx
// ============================================================
// Mezo · KindNodeList (mezo-2243) — the Tudásgráf category view behind a
// KindTileGrid tile: back chip + CategoryHeader + one COMPACT row per node
// (icon disc, title, edge count). Summary/edges/archive moved to the
// NodeDetailSheet — that is what keeps the rows one line tall, so a category
// stays scannable even at dozens of nodes.
// ============================================================
import { CategoryHeader } from '@/features/me/components/CategoryHeader'
import { ClayIcon } from '@/shared/ui/clay'
import { KIND_ICON, KIND_INK, KIND_WASH } from '@/features/me/logic/knowledgeNodeVisuals'
import type { GraphNodeKind, KnowledgeGraphNode } from '@/data/types'

export function KindNodeList({ kind, label, nodes, onBack, onOpenNode }: {
  kind: GraphNodeKind
  label: string
  nodes: KnowledgeGraphNode[]
  onBack: () => void
  onOpenNode: (node: KnowledgeGraphNode) => void
}) {
  return (
    <div className="col gap-xs">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="chip" onClick={onBack}>‹ Kategóriák</button>
      </div>
      <CategoryHeader label={label} color={KIND_INK[kind]} count={nodes.length} />
      <div className="col gap-xs">
        {nodes.map(n => (
          <button
            key={n.id}
            type="button"
            data-kind-node-row
            className={`mz-facttile mz-w-${KIND_WASH[kind]}`}
            style={{ textAlign: 'left', cursor: 'pointer' }}
            onClick={() => onOpenNode(n)}
          >
            <div className="mz-fic"><ClayIcon name={KIND_ICON[kind]} size={20} /></div>
            <div className="mz-fact-grow">
              <span className="mz-fact-tx">{n.title}</span>
              {n.topEdges.length > 0 && (
                <span className="mz-fact-sb" style={{ display: 'block', marginTop: 2 }}>
                  {n.topEdges.length} kapcsolat
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/me/components/KindNodeList.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/components/KindNodeList.tsx frontend/src/features/me/components/KindNodeList.test.tsx
git commit -m "feat(me): KindNodeList compact category view for the Tudásgráf (mezo-2243)"
```

---

### Task 4: Rewire KnowledgePage (view switch + sheet) and update its tests

**Files:**
- Modify: `frontend/src/features/me/pages/KnowledgePage.tsx` (full rewrite of the body below the summary tile)
- Modify: `frontend/src/features/me/pages/KnowledgePage.test.tsx`
- Delete: `frontend/src/features/me/components/KnowledgeGraphNodeCard.tsx` (only consumer was this page — verify with `grep -rn "KnowledgeGraphNodeCard" frontend/src` first; if another consumer appeared, keep it)

**Interfaces:**
- Consumes: `KindTileGrid` (Task 2), `KindNodeList` (Task 3), `NodeDetailSheet` (Task 1) with the exact signatures produced there; `useSearchParams` from react-router-dom; existing `useKnowledge`, `useKnowledgeGraphNodes`, `useKnowledgeGraphActions`, `GRAPH_KIND_GROUPS`, `PROFILE_SOURCE_KIND`, `ProfileNodeCard`, Mozaik scaffold.
- Produces: the final page; no downstream consumers.

- [ ] **Step 1: Update the page tests to describe the new behavior**

Keep tests 1–4 and the profile tests from the current file unchanged (hero,
EntranceGroup, no fact list, Tudástár link, profile lifted out + its archive).
REPLACE the old grouped-list tests (`renders the Kapcsolatok section grouped by
kind…`, `archiving a graph node removes it…`, `the summary band and node tiles
wear the Mozaik wash tiles` — keep its `.tud-summary` assertion, move it) with:

```tsx
// helper: render with an initial URL
const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <KnowledgePage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

test('the base view is the kind grid — six tiles, counts, no node cards', () => {
  const { container } = renderPage()
  expect(container.querySelector('.tud-summary')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Minták' })).toHaveTextContent('1')
  expect(screen.getByText('Szezonok')).toBeInTheDocument() // empty kind still present
  // the flat card list is gone
  expect(container.querySelectorAll('[data-graph-node-card]')).toHaveLength(0)
  expect(screen.queryByText('Késői evés → kiváltja → Rossz alvás · erős')).not.toBeInTheDocument()
})

test('tapping a kind tile opens the category view and sets ?kind=', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Minták' }))
  expect(await screen.findByText('Minták · 1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Késői evés rontja az alvást' })).toBeInTheDocument()
  expect(screen.getByText('2 kapcsolat')).toBeInTheDocument()
  // grid + profile are replaced in this view
  expect(screen.queryByRole('button', { name: 'Célok' })).not.toBeInTheDocument()
  expect(screen.queryByText('Rólad tanultam')).not.toBeInTheDocument()
})

test('?kind= deep link lands in the category view; invalid kind falls back to the grid', () => {
  renderAt('/?kind=PATTERN')
  expect(screen.getByText('Minták · 1')).toBeInTheDocument()
  cleanup()
  renderAt('/?kind=NOPE')
  expect(screen.getByRole('button', { name: 'Minták' })).toBeInTheDocument()
})

test('back chip returns to the grid', async () => {
  renderAt('/?kind=PATTERN')
  fireEvent.click(screen.getByRole('button', { name: '‹ Kategóriák' }))
  expect(await screen.findByRole('button', { name: 'Minták' })).toBeInTheDocument()
})

test('node row opens the detail sheet; Archivál archives and the node disappears', async () => {
  renderAt('/?kind=PATTERN')
  fireEvent.click(screen.getByRole('button', { name: 'Késői evés rontja az alvást' }))
  // sheet content: edge lines now live HERE, not in the row
  expect(await screen.findByText('Késői evés → kiváltja → Rossz alvás · erős')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Archivál' }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Késői evés rontja az alvást' })).not.toBeInTheDocument())
})
```

Add `cleanup` to the `@testing-library/react` import. The old
`import { within }` may become unused — drop it if so. NOTE: `renderAt` needs the
page routed at `/` — `MemoryRouter initialEntries` with the query string works
because `KnowledgePage` reads only `useSearchParams`, not the path.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd frontend && pnpm vitest run src/features/me/pages/KnowledgePage.test.tsx`
Expected: the 5 new/changed tests FAIL; the kept ones still pass.

- [ ] **Step 3: Rewrite the page body**

Replace `KnowledgePage.tsx`'s body below the summary tile (keep header comment
block, extend it with a `mezo-2243` paragraph explaining the overview-first
switch). New body logic:

```tsx
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
// … existing imports minus CategoryHeader/KnowledgeGraphNodeCard, plus:
import { KindTileGrid } from '@/features/me/components/KindTileGrid'
import { KindNodeList } from '@/features/me/components/KindNodeList'
import { NodeDetailSheet } from '@/features/me/sheets/NodeDetailSheet'
import type { GraphNodeKind } from '@/data/types'

const KIND_LABELS = new Map(GRAPH_KIND_GROUPS)

export function KnowledgePage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { facts, edges, activeCount } = useKnowledge()
  const { nodes } = useKnowledgeGraphNodes()
  const { archive } = useKnowledgeGraphActions()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const profileNode = nodes.find(n => n.sourceKind === PROFILE_SOURCE_KIND) ?? null
  const graphNodes = nodes.filter(n => n.sourceKind !== PROFILE_SOURCE_KIND)

  const rawKind = params.get('kind')
  const kind = rawKind && KIND_LABELS.has(rawKind as GraphNodeKind) ? (rawKind as GraphNodeKind) : null
  const selected = selectedId ? graphNodes.find(n => n.id === selectedId) ?? null : null

  // …scaffold identical to today (MozaikPage/PageHead/PageHero + summary tile)…
  // then, instead of the grouped card lists:
  {kind === null ? (
    <>
      {profileNode && (/* the existing Profil eyebrow + ProfileNodeCard block, unchanged */)}
      <KindTileGrid nodes={graphNodes} onOpenKind={k => setParams({ kind: k })} />
    </>
  ) : (
    <div className="rise" style={{ '--d': '60ms' } as React.CSSProperties}>
      <KindNodeList
        kind={kind}
        label={KIND_LABELS.get(kind)!}
        nodes={graphNodes.filter(n => n.kind === kind)}
        onBack={() => setParams({})}
        onOpenNode={n => setSelectedId(n.id)}
      />
    </div>
  )}
  // footer .ntf-foot unchanged; after it:
  {selected && (
    <NodeDetailSheet
      node={selected}
      onArchive={() => archive(selected.id)}
      onClose={() => setSelectedId(null)}
    />
  )}
```

Key detail: `selected` is DERIVED (`graphNodes.find`) — after archiving, the
hook drops the node, `selected` becomes null and the sheet unmounts even before
`onClose` fires; no broken state (spec §3). Re-key the `EntranceGroup` by the
view (`<EntranceGroup key={kind ?? 'grid'}>`) so switching views replays the
entrance (spec §5).

Then delete `KnowledgeGraphNodeCard.tsx` (after the grep check in **Files**).

- [ ] **Step 4: Run the page + component tests**

Run: `cd frontend && pnpm vitest run src/features/me/pages/KnowledgePage.test.tsx src/features/me/components src/features/me/sheets/NodeDetailSheet.test.tsx`
Expected: ALL PASS.

- [ ] **Step 5: Typecheck + full frontend suite, both modes**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=false pnpm test`
Expected: build OK; both suites green (bare `pnpm test` is mock mode — the
real-mode gate needs the explicit `VITE_USE_MOCK=false` run).

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src/features/me
git commit -m "feat(me): overview-first Tudásgráf — kind grid, category view, node sheet (mezo-2243)"
```

---

### Task 5: CODEMAP regen + gates + close-out

**Files:**
- Modify: `docs/CODEMAP.md` (generated)

- [ ] **Step 1: Regenerate the codemap**

Run: `node scripts/gen-codemap.mjs`
Expected: writes `docs/CODEMAP.md` (new/deleted files under `features/me` show up). CI has a `--check` drift gate — skipping this fails the PR.

- [ ] **Step 2: Commit**

```bash
git add docs/CODEMAP.md
git commit -m "chore(docs): regenerate CODEMAP for Tudásgráf redesign (mezo-2243)"
```

- [ ] **Step 3: Final verification**

Run: `cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build`
Expected: all green. (Backend untouched — no backend gate needed; CI runs the full suite anyway.)
