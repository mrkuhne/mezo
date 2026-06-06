# Insights (Slice 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the **Insights** tab — seven sub-views reached through a horizontally-scrollable sub-navigation (**Patterns · Weekly · Memoir · Knowledge · Chat · Predictions · Experiments**) — to pixel-parity with the locked prototype, on typed mock data. This is the AI-memory surface (the 4-factor pattern critique, the companion memoir, the tool-transparency chat).

**Architecture:** New feature slice under `src/features/insights/`. Mirrors the Slice-2 (Me) / Slice-3 (Fuel) pattern: the `insights` route becomes a **parent route** rendering shared chrome (page-header with a **dynamic title** + sticky `InsightsSubNav` + `<Outlet/>`) with **one nested child route per sub-view** (`/insights` index = Patterns, `/insights/weekly`, `/insights/memoir`, `/insights/knowledge`, `/insights/chat`, `/insights/predictions`, `/insights/experiments`). A new Insights mock-data layer (`src/data/insights.ts`, `src/data/chat.ts` + types + read-only hooks) feeds the views. The **Knowledge** sub-view **reuses the existing `src/data/knowledge.ts` + `useKnowledge()`** built in Slice 2 (no duplicate facts). Interactive state (pattern confirm/monitor/reject, memoir reactions, fact toggles, chat messages) lives in **local React state** — never a backend, never `window.MezoData`.

**Scope note (prototype is the source of truth):** The Insights **Knowledge** sub-tab in the prototype (`KnowledgeListPanel`) is a **flat fact list with per-fact toggles + an "N aktív promptban" count** — NOT the force-directed graph. The graph lives in **Me → Tudás** and its real force-graph library is deferred to issue `mezo-2m4`. Build the flat list here; do **not** build a graph in Insights. The page-header **settings chip** in the prototype (`insights.jsx:26-28`) has **no handler** — it is decorative; render it inert (do not wire a SettingsSheet — that is Me's).

**Tech Stack:** Vite · React 19 · TypeScript (strict, no `any`) · react-router-dom v7 (nested routes + `Outlet` + `NavLink` + `useLocation`) · Tailwind v4 `@theme` + the hand-written global classes in `src/styles/prototype.css` · Vitest + React Testing Library + `@testing-library/user-event` · Playwright (parity).

**Source of truth (the locked design — read the exact line range while implementing):**
- `prototype/src/insights.jsx` — `INSIGHTS_TABS` (6-14), `InsightsScreen` shell (16-59), `PatternsPanel` (62-98), `PatternCard` (100-181), `WeeklyPanel` (184-232), `MemoirPanel` (235-294), `KnowledgeListPanel` (297-331), local `Toggle` (333-347, **replaced by `@/components/ui/Toggle`**), `ChatPanel` (350-414), `ChatMessage` (416-445), `PredictionsPanel` (448-480), `ExperimentsPanel` (483-509).
- `prototype/src/data.js` — `insights` block: `patterns` (965-1013), `facts` (1016-1032, **already ported** → `src/data/knowledge.ts`), `edges` (1033-1047, already ported), `memoir` (1049-1059), `predictions` (1061-1066), `experiments` (1068-1071), `weekly` (1073-1083); `chat` (1367-1394).
- `02-screens.md` TAB 4 (Insights), `03-components.md` (critique grid / memoir card / toolchips / reftag), `04-data-model.md` (`patterns`, `facts`, tool-call grammar).

**Conventions:** TypeScript strict, no `any`, no `dangerouslySetInnerHTML`. Keep all Hungarian copy **verbatim**. Port the prototype's inline-styled markup faithfully (this codebase uses global utility classes + inline `style={{}}` + `notch-*`/`accent-strip` classes, **not** Tailwind utility classes). Reuse Foundation primitives — never rebuild them. Commit after each task; English message ending with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (the beads pre-commit hook runs `bd export`). Commit scope is `(insights)`. Work from `/Users/daniel.kuhne/MrKuhne/mezo` on the slice's feature branch.

**Adaptations applied while porting (apply consistently in every task):**
- `window.MezoData.insights.*` / `window.MezoData.chat` → typed read-only hooks (`useInsights`, `useChat`); facts via the existing `useKnowledge`.
- Prototype's internal `sub`/`setSub` for sub-views → **nested routes** + `NavLink` (same as Me's `MeSubNav` / Fuel's `FuelSubNav`). The shared page-header **title** is derived from the active route via `useLocation()`.
- Prototype's local `Toggle` (333-347) → the shared `Toggle` (`@/components/ui/Toggle`), which **requires an `ariaLabel`**.
- Prototype's `Icon`/`RefTag`/`ToolChipRow` globals → our imported primitives (`@/components/ui/Icon`, `@/components/ui/RefTag`, `@/components/ui/ToolChipRow`).
- Pattern status (confirm/monitor/reject) is hoisted in the prototype to `PatternsPanel`; we move it into **each `PatternCard`'s own local state** (behaviour-identical, simpler).
- The `tweaks.patternConf` design-time filter → a fixed `MIN_PATTERN_CONFIDENCE = 0.65` constant (the Tweaks panel is out of scope). All three mock patterns (≥0.69) pass; the empty-state branch is kept for fidelity but is unreachable with default data. The empty-state copy drops the prototype's "Csökkentsd a Tweaks-ben." sentence (no Tweaks panel in production).
- Hardcoded-in-JSX data (the "Recently confirmed · L3" list, the weekly `tervjavaslat` paragraph, the memoir anniversary paragraph) → typed consts in the data layer. Tiny presentational eyebrows/labels stay inline as verbatim copy.
- Chat `send` reads `draft` inside a `setTimeout` closure in the prototype; we capture `const text = draft` at the top of `send` (clean, no stale-closure smell) and key the simulated reply off `text`.
- **No `SafeMarkdown`:** `insights.jsx` renders all prose as plain `{text}` (no `**bold**` formatting anywhere) and the mock data contains no `**` markers — so render plain text. (This differs from Today/Fuel briefings.)

**Reused Foundation primitives (import, do NOT rebuild):** `Eyebrow` (`@/components/ui/Eyebrow`), `PageTitle` (`@/components/ui/PageTitle`), `Chip` (`@/components/ui/Chip`), `LabelMono` (`@/components/ui/LabelMono`), `Toggle` (`@/components/ui/Toggle`), `Icon` (`@/components/ui/Icon`), `ToolChipRow` + `type Tool` (`@/components/ui/ToolChipRow`, `@/components/ui/ToolChip`), `RefTag` (`@/components/ui/RefTag`), `cn` (`@/lib/cn`). Reused global CSS classes (already in `src/styles/prototype.css`, verified): `.subnav`/`.subnav-item`/`.subnav-item.active` (horizontal scroll + right-fade mask), `.critique-grid`/`.critique-bar .lbl`, `.memoir-card`, `.accent-strip`, `.card`, `.chip`/`.chip.brand`/`.chip.warning`, `.bar`/`.bar-fill`/`.bar-fill.glow`, `.cta-ghost`, `.toolchip`, `.col`/`.row`/`.gap-*`/`.flex-1`/`.flex-wrap`/`.mt-*`, `.page-header`/`.page-title`, `.eyebrow`/`.eyebrow.brand`/`.label-mono`/`.lbl`, `.text-secondary`/`.text-tertiary`.

**Icons available (confirmed in `Icon.tsx`):** `settings, check, x, chevron-down, chevron-up, send, mic, heart, bookmark, sparkle, …`. **All icons Insights needs already exist — no new icons required.**

**Design tokens (confirmed present in `prototype.css`):** `--cat-physiology`, `--cat-trigger`, `--cat-response` (+ preference/tendency/goal-state), `--success`, `--warning`, `--error`, `--brand-glow`, `--brand-primary`, `--border-brand`, `--border-subtle`, `--border-strong`, `--surface-2`, `--canvas`, `--text-primary/secondary/tertiary`.

**Pre-flight (run once before Task 1):**
```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git checkout -b slice4-insights
pnpm test run   # baseline: all green before starting
```

---

## Task 1: InsightsSubNav + route restructure + shell with dynamic title + placeholder views

**Files:** Create `src/features/insights/tabs.ts`, `src/features/insights/InsightsSubNav.tsx`, `src/features/insights/InsightsSubNav.test.tsx`; rewrite `src/features/insights/InsightsScreen.tsx` (shell); create placeholder views `src/features/insights/views/{PatternsView,WeeklyView,MemoirView,KnowledgeListView,ChatView,PredictionsView,ExperimentsView}.tsx`; modify `src/app/router.tsx`. Contract: `insights.jsx` `INSIGHTS_TABS` (6-14) + shell (16-59).

Sub-views (id → route → verbatim label, in order): `patterns`→`/insights` (index, `end`)→**Patterns**, `weekly`→`/insights/weekly`→**Weekly**, `memoir`→`/insights/memoir`→**Memoir**, `knowledge`→`/insights/knowledge`→**Knowledge**, `chat`→`/insights/chat`→**Chat**, `predictions`→`/insights/predictions`→**Predictions**, `experiments`→`/insights/experiments`→**Experiments**.

- [ ] **Step 1: Failing test** — `src/features/insights/InsightsSubNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { InsightsSubNav } from './InsightsSubNav'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><InsightsSubNav /></MemoryRouter>)
}

test('renders all seven sub-nav items with verbatim labels', () => {
  renderAt('/insights')
  for (const label of ['Patterns', 'Weekly', 'Memoir', 'Knowledge', 'Chat', 'Predictions', 'Experiments']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})

test('marks the active sub-view from the URL', () => {
  const { container } = renderAt('/insights/memoir')
  expect(container.querySelector('.subnav-item.active')).toHaveTextContent('Memoir')
})

test('Patterns (index) is active only on exact /insights', () => {
  const { container } = renderAt('/insights/chat')
  expect(container.querySelector('.subnav-item.active')).toHaveTextContent('Chat')
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/features/insights/InsightsSubNav.test.tsx`. Expected: cannot resolve `./InsightsSubNav`.

- [ ] **Step 3: Implement `src/features/insights/tabs.ts`:**

```ts
export interface InsightsTab {
  id: string
  to: string
  label: string
  end?: boolean
}

export const INSIGHTS_TABS: InsightsTab[] = [
  { id: 'patterns', to: '/insights', label: 'Patterns', end: true },
  { id: 'weekly', to: '/insights/weekly', label: 'Weekly' },
  { id: 'memoir', to: '/insights/memoir', label: 'Memoir' },
  { id: 'knowledge', to: '/insights/knowledge', label: 'Knowledge' },
  { id: 'chat', to: '/insights/chat', label: 'Chat' },
  { id: 'predictions', to: '/insights/predictions', label: 'Predictions' },
  { id: 'experiments', to: '/insights/experiments', label: 'Experiments' },
]
```

- [ ] **Step 4: Implement `src/features/insights/InsightsSubNav.tsx`** (sticky, per prototype `insights.jsx:31-46`):

```tsx
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { INSIGHTS_TABS } from './tabs'

export function InsightsSubNav() {
  return (
    <nav
      className="subnav"
      aria-label="Insights alnavigáció"
      style={{ position: 'sticky', top: 0, background: 'var(--canvas)', zIndex: 5, paddingTop: 8 }}
    >
      {INSIGHTS_TABS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn('subnav-item', isActive && 'active')}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5: Rewrite `src/features/insights/InsightsScreen.tsx`** as the shell (dynamic title from the active route; inert settings chip):

```tsx
import { Outlet, useLocation } from 'react-router-dom'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { InsightsSubNav } from './InsightsSubNav'
import { INSIGHTS_TABS } from './tabs'

export function InsightsScreen() {
  const { pathname } = useLocation()
  const seg = pathname.split('/')[2] ?? 'patterns'
  const active = INSIGHTS_TABS.find((t) => t.id === seg) ?? INSIGHTS_TABS[0]

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>Insights</Eyebrow>
          <PageTitle className="mt-sm">{active.label}</PageTitle>
        </div>
        {/* Decorative — the prototype's settings chip has no handler */}
        <button type="button" className="chip" aria-label="Insights beállítások">
          <Icon name="settings" size={12} />
        </button>
      </div>

      <InsightsSubNav />

      <div style={{ padding: '8px 24px 24px' }}>
        <Outlet />
      </div>
    </>
  )
}
```

- [ ] **Step 6: Create the seven placeholder views** in `src/features/insights/views/`. Each is a stub returning a single eyebrow; later tasks replace the body. Example `PatternsView.tsx`:

```tsx
export function PatternsView() {
  return <div className="eyebrow">Patterns</div>
}
```

Create the same stub shape for `WeeklyView`, `MemoirView`, `KnowledgeListView`, `ChatView`, `PredictionsView`, `ExperimentsView` (label = `Weekly`/`Memoir`/`Knowledge`/`Chat`/`Predictions`/`Experiments`).

- [ ] **Step 7: Wire nested routes** — in `src/app/router.tsx`, add the view imports and replace `{ path: 'insights', element: <InsightsScreen /> }` with:

```tsx
import { PatternsView } from '@/features/insights/views/PatternsView'
import { WeeklyView } from '@/features/insights/views/WeeklyView'
import { MemoirView } from '@/features/insights/views/MemoirView'
import { KnowledgeListView } from '@/features/insights/views/KnowledgeListView'
import { ChatView } from '@/features/insights/views/ChatView'
import { PredictionsView } from '@/features/insights/views/PredictionsView'
import { ExperimentsView } from '@/features/insights/views/ExperimentsView'
```

```tsx
{
  path: 'insights',
  element: <InsightsScreen />,
  children: [
    { index: true, element: <PatternsView /> },
    { path: 'weekly', element: <WeeklyView /> },
    { path: 'memoir', element: <MemoirView /> },
    { path: 'knowledge', element: <KnowledgeListView /> },
    { path: 'chat', element: <ChatView /> },
    { path: 'predictions', element: <PredictionsView /> },
    { path: 'experiments', element: <ExperimentsView /> },
  ],
},
```

- [ ] **Step 8: Run → PASS** — `pnpm test src/features/insights/InsightsSubNav.test.tsx` then `pnpm test run` (whole suite green; navigation smoke tests still pass).

- [ ] **Step 9: Commit**

```bash
git add src/features/insights src/app/router.tsx
git commit -m "feat(insights): sub-nav + nested routes + shell with dynamic title"
```

---

## Task 2: Data layer — insights types + data + `useInsights`

**Files:** Modify `src/data/types.ts` (append Insights shapes); create `src/data/insights.ts`; modify `src/data/hooks.ts` (add `useInsights`); create `src/data/insightsData.test.tsx`. Contract: `data.js` `insights` block (965-1083).

- [ ] **Step 1: Failing test** — `src/data/insightsData.test.tsx`:

```tsx
import { patterns, predictions, experiments, weekly, memoir, recentlyConfirmed, MIN_PATTERN_CONFIDENCE, patternCategoryColor } from './insights'

test('three patterns, all above the confidence floor', () => {
  expect(patterns).toHaveLength(3)
  expect(patterns.every((p) => p.confidence >= MIN_PATTERN_CONFIDENCE)).toBe(true)
  expect(patterns[0].title).toBe('Reta beadás + 36h ablakban étvágy lefulladás')
  expect(patterns[0].critique.actionability).toBe(0.88)
})

test('pattern category colour maps to a --cat-* token', () => {
  expect(patternCategoryColor('response')).toBe('var(--cat-response)')
})

test('weekly review + memoir + recently-confirmed copy is verbatim', () => {
  expect(weekly.score).toBe(82)
  expect(weekly.items).toHaveLength(4)
  expect(memoir.title).toBe('Egy hét amikor a tested megtanult várni')
  expect(memoir.anchors).toHaveLength(3)
  expect(recentlyConfirmed).toHaveLength(3)
})

test('predictions + experiments shapes', () => {
  expect(predictions).toHaveLength(4)
  expect(predictions.find((p) => p.status === 'validated')?.actual).toBe('RPE 8.2 · vacsora 20:50')
  expect(experiments.find((e) => e.status === 'active')?.day).toBe(4)
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/data/insightsData.test.tsx`. Expected: cannot resolve `./insights`.

- [ ] **Step 3: Append Insights types** to `src/data/types.ts` (after the `KnowledgeEdge` block, end of file). Note `Tool` is imported from the ToolChip primitive (consistent with how `ToolChipRow` consumes tools):

```ts
// --- Insights (AI-memory surface) ---
import type { Tool } from '@/components/ui/ToolChip'

export type PatternCategory = 'physiology' | 'trigger' | 'response'
export type PatternStatus = 'confirm' | 'monitor' | 'reject'
export interface PatternCritique {
  statistical: number
  confounders: number
  l3align: number
  actionability: number
}
export interface Pattern {
  id: string
  category: PatternCategory
  categoryLabel: string
  confidence: number
  title: string
  mechanism: string
  evidence: string[]
  critique: PatternCritique
  thinking?: string
}

export interface MemoirAnchor { kind: string; label: string }
export interface Memoir {
  week: string
  title: string
  body: string
  anchors: MemoirAnchor[]
}

export type PredictionStatus = 'pending' | 'validated'
export interface Prediction {
  id: string
  title: string
  confidence: number
  status: PredictionStatus
  date: string
  basis?: string
  actual?: string
}

export type ExperimentStatus = 'active' | 'completed'
export interface Experiment {
  id: string
  title: string
  status: ExperimentStatus
  day: number
  total: number
  hypothesis: string
  outcome?: string
  outcomeGood?: boolean
}

export type WeeklyTrend = 'up' | 'down' | 'flat'
export interface WeeklyItem { label: string; value: string; trend: WeeklyTrend }
export interface WeeklyReview { title: string; score: number; delta: number; items: WeeklyItem[] }

export type ChatRole = 'user' | 'assistant'
export interface ChatRef { kind: string; id: string }
export interface ChatMessage {
  role: ChatRole
  ts: string
  text: string
  tools?: Tool[]
  refs?: ChatRef[]
}
```

> If `src/data/types.ts` does not already import from `@/components/ui/Icon` at the top with side-effect-free type imports, this `import type { Tool }` mid-file is fine for TS, but prefer moving it to the top import group for tidiness.

- [ ] **Step 4: Implement `src/data/insights.ts`** (verbatim copy from `data.js:965-1083`):

```ts
import type {
  Pattern,
  PatternCategory,
  Prediction,
  Experiment,
  WeeklyReview,
  Memoir,
} from './types'

export const MIN_PATTERN_CONFIDENCE = 0.65

export function patternCategoryColor(cat: PatternCategory): string {
  return `var(--cat-${cat})`
}

export const patterns: Pattern[] = [
  {
    id: 'p1',
    category: 'physiology',
    categoryLabel: 'Fiziológia',
    confidence: 0.85,
    title: 'Reta beadás + 36h ablakban étvágy lefulladás',
    mechanism:
      'A Retatrutide beadás után 24-48h-val az étvágy a legalacsonyabb. A nézőpontunk: ezeken a napokon a kcal-pacing 15 órára 38% körül van (átlag: 51%).',
    evidence: ['12 Reta beadás óta', '9 nap megerősítve', '0.85 statisztikai stabilitás'],
    critique: { statistical: 0.85, confounders: 0.72, l3align: 0.91, actionability: 0.88 },
    thinking:
      'Megfigyelés: D2-D3 napokon a meal-count 3-ról 2-re csökken, és ez nem a tudatos döntés következménye, hanem az éhségérzet eltűnése. Hipotézis: a pacing-alert push T-2h-val az edzés előtt fix kell maradjon ezeken a napokon — különben az under-fueling kockázat magas.',
  },
  {
    id: 'p2',
    category: 'trigger',
    categoryLabel: 'Trigger',
    confidence: 0.78,
    title: 'Késő szénhidrát (>20:00 · >60g) → másnap reggeli RPE +1',
    mechanism:
      'Késői szénhidrát-bevitel csökkenti az első deep sleep ciklus minőségét. Másnap reggeli RPE-emelkedés a Pull Day-eknél mérhető.',
    evidence: ['8/11 megfigyelés', 'Sleep-quality < 7 átlag', 'PR-attempt failure 3/4'],
    critique: { statistical: 0.78, confounders: 0.65, l3align: 0.82, actionability: 0.95 },
    thinking:
      'Az este 20:30 utáni szénhidrát-bevitel és a másnap reggeli RPE között robosztus a korreláció. A confounder: tegnap volt-e volleyball (extra glikogén-merítés ezt módosíthatja).',
  },
  {
    id: 'p3',
    category: 'response',
    categoryLabel: 'Response',
    confidence: 0.69,
    title: 'Caffeine 14:00 utáni dózis → sleep onset +24 perc',
    mechanism: 'A 14:00 utáni koffein (>40mg) átlagosan 24 perccel kitolja az alvás kezdetét.',
    evidence: ['7 nap mérve', 'Stabil pattern, alacsony variancia'],
    critique: { statistical: 0.69, confounders: 0.78, l3align: 0.74, actionability: 0.91 },
  },
]

// Prototype: hardcoded "Recently confirmed · L3" list (insights.jsx:88).
export const recentlyConfirmed: string[] = [
  'Hét 18: Pre-workout 2-3h whey + carb',
  'Hét 17: Volleyball nap → kevesebb gym set',
  'Hét 16: Magnézium 21:00 előtt',
]

export const weekly: WeeklyReview = {
  title: 'Hét 21 áttekintés · Máj 18-24',
  score: 82,
  delta: 4,
  items: [
    { label: 'Edzés volumen', value: '16 set fölött', trend: 'up' },
    { label: 'Alvás átlag', value: '7.2h', trend: 'flat' },
    { label: 'Kcal pacing', value: '94% target', trend: 'up' },
    { label: 'Niggle-mentes napok', value: '5/7', trend: 'down' },
  ],
}

// Prototype: hardcoded weekly plan-suggestion paragraph (insights.jsx:222-224).
export const weeklySuggestion =
  'Hét 22: tartsd ezt a Pull/Push váltogatást. A volleyball után visszamentünk 7.2h-ra — vasárnap próbáljunk 8h+-ot.'

export const memoir: Memoir = {
  week: 'Hét 20 · 2026 · Máj 11-17',
  title: 'Egy hét amikor a tested megtanult várni',
  body: 'Ezen a héten történt valami amit én is csak utólag láttam: nem siettetted a vasárnap esti reggelet hétfő helyett. Március óta a Reta-beadás reggelén mindig hajtottad magad, mintha pótolnod kéne valamit — most leültél, és a porridge mellett még megnézted a tegnapi PR-videót. Ez nem semmi. A Chest Row 105.8-on dolgozunk hat hete, és úgy érzem hogy ezen a héten téged is megnyugtatott. Csütörtökön (Pull Day) a 102.5 × 9 @ RIR 2 olyan tisztán ment, hogy elgondolkodtam: jövő héten 105 × 8-re menjünk? Erről beszéljünk pénteken.',
  anchors: [
    { kind: 'PR', label: 'Chest Row 102.5 × 9' },
    { kind: 'Reta', label: 'D1 reggel · pihenve' },
    { kind: 'Identity', label: 'Peak performance · life' },
  ],
}

// Prototype: hardcoded "Évforduló · 1 hónap" paragraph (insights.jsx:283-285).
export const anniversaryNote =
  'Egy hónapja kezdtük a Reta-protokollt. Akkor még tipikus volt az este 22:00-s vacsora — most a hét 5 napján 21:30 előtt tudunk csukni a konyhában. Ez nem semmi.'

export const predictions: Prediction[] = [
  {
    id: 'pred1',
    title: 'Csütörtök Pull Day · Chest Row PR (107.5 × 8)',
    confidence: 0.72,
    status: 'pending',
    date: 'Máj 22',
    basis:
      'Március óta a 102.5 stabil. Múlt heti RIR 2 + Reta D3 alacsony étvágy + 7.5h alvás kombináció historikusan +5kg-os emelést támogatott.',
  },
  {
    id: 'pred2',
    title: 'Hét 21 testsúly · 78.4 ±0.3 kg',
    confidence: 0.81,
    status: 'pending',
    date: 'Máj 26',
    basis: 'Hét 20 átlag 78.6kg. Reta D3-D7 alacsonyabb intake. 7-day MA trend.',
  },
  {
    id: 'pred3',
    title: 'Péntek reggeli RPE > 7.5 ha vacsora < 21:30',
    confidence: 0.69,
    status: 'validated',
    date: 'Máj 16',
    actual: 'RPE 8.2 · vacsora 20:50',
  },
  {
    id: 'pred4',
    title: 'Vasárnap volleyball RPE 6.5-7.0',
    confidence: 0.74,
    status: 'validated',
    date: 'Máj 17',
    actual: 'RPE 6.8',
  },
]

export const experiments: Experiment[] = [
  {
    id: 'exp1',
    title: 'Glikogén-feltöltés volleyball előtt',
    status: 'active',
    day: 4,
    total: 7,
    hypothesis: 'Pre-volleyball 80g szénhidrát 2h-val korábban → vertikális ugrás stabilabb a 4. setre.',
  },
  {
    id: 'exp2',
    title: 'Magnézium dose timing: 21:00 vs 19:00',
    status: 'completed',
    day: 14,
    total: 14,
    hypothesis: '21:00-s adagolás → deep sleep első órája tisztább.',
    outcome: 'Megerősítve · 3/4 mérés',
    outcomeGood: true,
  },
]
```

- [ ] **Step 5: Add the hook** to `src/data/hooks.ts` — add the import and the hook (place the import near the other `./` data imports, the hook near `useKnowledge`):

```ts
import { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments } from './insights'
```

```ts
export function useInsights() {
  return { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments }
}
```

- [ ] **Step 6: Run → PASS** — `pnpm test src/data/insightsData.test.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/data/types.ts src/data/insights.ts src/data/hooks.ts src/data/insightsData.test.tsx
git commit -m "feat(insights): data layer — patterns/weekly/memoir/predictions/experiments + useInsights"
```

---

## Task 3: Data layer — chat (`useChat`)

**Files:** Create `src/data/chat.ts`; modify `src/data/hooks.ts` (add `useChat`); create `src/data/chatData.test.tsx`. Contract: `data.js` `chat` (1367-1394).

- [ ] **Step 1: Failing test** — `src/data/chatData.test.tsx`:

```tsx
import { initialChat } from './chat'

test('seeds two messages — assistant then user — with tool transparency', () => {
  expect(initialChat).toHaveLength(2)
  expect(initialChat[0].role).toBe('assistant')
  expect(initialChat[0].tools?.[0]).toEqual({ type: 'read', name: 'get_recent_workouts(days=3)' })
  expect(initialChat[0].refs?.[0]).toEqual({ kind: 'Workout', id: 'w-2026-05-21' })
  expect(initialChat[1].role).toBe('user')
  expect(initialChat[1].text).toBe('Aludtam 7h-t. Érzem hogy ma jobb mint tegnap.')
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/data/chatData.test.tsx`.

- [ ] **Step 3: Implement `src/data/chat.ts`** (verbatim from `data.js:1367-1394`):

```ts
import type { ChatMessage } from './types'

export const initialChat: ChatMessage[] = [
  {
    role: 'assistant',
    ts: '06:32',
    text: 'Jó reggelt. Tegnap a Push Day jól ment — a Lat Pulldown 105 × 9 @ RIR 1 volt, és ez a sorozat az egyik legtisztább március óta. Ma Pull Day, a Chest Row PR-attempt logikus, ha az első melegítő szet könnyű.',
    tools: [
      { type: 'read', name: 'get_recent_workouts(days=3)' },
      { type: 'compute', name: "recallSharedMemory(theme='pull-day pr')" },
    ],
    refs: [
      { kind: 'Workout', id: 'w-2026-05-21' },
      { kind: 'PR', id: 'pr-2026-03-04' },
    ],
  },
  {
    role: 'user',
    ts: '06:34',
    text: 'Aludtam 7h-t. Érzem hogy ma jobb mint tegnap.',
  },
  {
    role: 'assistant',
    ts: '06:34',
    text: 'Jó jel. 7h a héten az átlag fölött van — vasárnap óta négy nap volt 7+. A Reta D3-ot ne felejtsük: az étvágy ma délután fog leesni, és ha PR-t akarunk, a 13:30 pre-workout meal nem opcionális. Ha 30g whey + banán + földimogyoróvaj akkor is megy, ha nem éhezünk, az ma fontos.',
    tools: [
      { type: 'read', name: 'get_sleep(days=7)' },
      { type: 'read', name: 'get_reta_phase()' },
      { type: 'compute', name: 'predictAppetiteCurve()' },
    ],
    refs: [
      { kind: 'Pattern', id: 'p-reta-appetite' },
      { kind: 'SleepLog', id: 'sleep-2026-05-21' },
    ],
  },
]
```

> Note: the prototype seeds only the two messages at `data.js:1367-1394` (a third assistant message there belongs to a different fixture). Match `data.js` exactly — the test above asserts `toHaveLength(2)`; if the authoritative `data.js` block contains a different count when you open it, follow the file and update the test count to match. The verbatim text strings are what matters for parity.

- [ ] **Step 4: Add the hook** to `src/data/hooks.ts`:

```ts
import { initialChat } from './chat'
```

```ts
export function useChat() {
  return { initialChat }
}
```

- [ ] **Step 5: Run → PASS** — `pnpm test src/data/chatData.test.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/data/chat.ts src/data/hooks.ts src/data/chatData.test.tsx
git commit -m "feat(insights): chat data layer + useChat"
```

---

## Task 4: PatternCard component

**Files:** Create `src/features/insights/components/PatternCard.tsx`, `src/features/insights/components/PatternCard.test.tsx`. Contract: `insights.jsx` `PatternCard` (100-181).

- [ ] **Step 1: Failing test** — `src/features/insights/components/PatternCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PatternCard } from './PatternCard'
import { patterns } from '@/data/insights'

const p1 = patterns[0] // has `thinking`

test('renders category, confidence, title, mechanism and the 4-factor critique', () => {
  render(<PatternCard pattern={p1} />)
  expect(screen.getByText('Fiziológia')).toBeInTheDocument()
  expect(screen.getByText('conf 85%')).toBeInTheDocument()
  expect(screen.getByText(p1.title)).toBeInTheDocument()
  for (const lbl of ['Statistical', 'Confounders', 'L3 align', 'Actionability']) {
    expect(screen.getByText(lbl)).toBeInTheDocument()
  }
})

test('expands the AI reasoning on demand', async () => {
  render(<PatternCard pattern={p1} />)
  expect(screen.queryByText(p1.thinking!)).not.toBeInTheDocument()
  await userEvent.click(screen.getByText('AI gondolatmenete'))
  expect(screen.getByText(p1.thinking!)).toBeInTheDocument()
})

test('Confirm marks the card status', async () => {
  render(<PatternCard pattern={p1} />)
  await userEvent.click(screen.getByRole('button', { name: /Confirm/ }))
  expect(screen.getByText('✓ Megerősítve')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/features/insights/components/PatternCard.test.tsx`.

- [ ] **Step 3: Implement `src/features/insights/components/PatternCard.tsx`:**

```tsx
import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { patternCategoryColor } from '@/data/insights'
import type { Pattern, PatternCritique, PatternStatus } from '@/data/types'

const CRITIQUE_ROWS: Array<{ lbl: string; key: keyof PatternCritique }> = [
  { lbl: 'Statistical', key: 'statistical' },
  { lbl: 'Confounders', key: 'confounders' },
  { lbl: 'L3 align', key: 'l3align' },
  { lbl: 'Actionability', key: 'actionability' },
]

function statusLabel(s: PatternStatus): string {
  return s === 'confirm' ? '✓ Megerősítve' : s === 'monitor' ? '◐ Megfigyelve' : '✗ Elutasítva'
}

function critiqueColor(v: number): string {
  return v > 0.8 ? 'var(--success)' : v > 0.7 ? 'var(--brand-primary)' : 'var(--warning)'
}

export function PatternCard({ pattern }: { pattern: Pattern }) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<PatternStatus | null>(null)
  const catColor = patternCategoryColor(pattern.category)

  return (
    <div className="card notch-12" style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: catColor }} />

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row gap-sm">
          <span
            className="chip"
            style={{ fontSize: 9, padding: '3px 8px', color: catColor, borderColor: `${catColor}59`, background: 'rgba(255,255,255,0.02)' }}
          >
            {pattern.categoryLabel}
          </span>
          <span className="eyebrow text-tertiary">conf {(pattern.confidence * 100).toFixed(0)}%</span>
        </div>
        {status && <span className="chip brand" style={{ fontSize: 9 }}>{statusLabel(status)}</span>}
      </div>

      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 17, marginTop: 10, lineHeight: 1.2, color: 'var(--text-primary)' }}>
        {pattern.title}
      </div>

      <p className="text-secondary mt-md" style={{ fontSize: 13, lineHeight: 1.5 }}>{pattern.mechanism}</p>

      <div className="critique-grid">
        {CRITIQUE_ROWS.map((c) => {
          const val = pattern.critique[c.key]
          return (
            <div key={c.key} className="col gap-xs">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="lbl">{c.lbl}</span>
                <span className="lbl" style={{ color: 'var(--text-primary)' }}>{val.toFixed(2)}</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${val * 100}%`, background: critiqueColor(val) }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="row gap-xs flex-wrap mt-md">
        {pattern.evidence.map((e, i) => (
          <span key={i} className="chip" style={{ fontSize: 9 }}>{e}</span>
        ))}
      </div>

      {pattern.thinking && (
        <>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="row gap-sm mt-md" style={{ color: 'var(--brand-glow)' }}>
            <span className="label-mono" style={{ fontSize: 10 }}>AI gondolatmenete</span>
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color="var(--brand-glow)" />
          </button>
          {expanded && (
            <p
              className="text-secondary mt-sm"
              style={{ fontSize: 12, lineHeight: 1.5, padding: '10px 12px', background: 'var(--surface-2)', borderLeft: '2px solid var(--brand-glow)' }}
            >
              {pattern.thinking}
            </p>
          )}
        </>
      )}

      <div className="row gap-sm mt-lg" style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => setStatus('confirm')}
          className="cta-ghost notch-4 flex-1"
          style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, padding: 10, background: status === 'confirm' ? 'rgba(52, 211, 153, 0.1)' : 'transparent', borderColor: status === 'confirm' ? 'var(--success)' : 'var(--border-strong)' }}
        >
          <Icon name="check" size={12} color={status === 'confirm' ? 'var(--success)' : undefined} /> Confirm
        </button>
        <button
          type="button"
          onClick={() => setStatus('monitor')}
          className="cta-ghost notch-4 flex-1"
          style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, padding: 10, background: status === 'monitor' ? 'rgba(245, 158, 11, 0.1)' : 'transparent', borderColor: status === 'monitor' ? 'var(--warning)' : 'var(--border-strong)' }}
        >
          Monitor
        </button>
        <button
          type="button"
          onClick={() => setStatus('reject')}
          className="cta-ghost notch-4 flex-1"
          style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, padding: 10, background: status === 'reject' ? 'rgba(244, 63, 94, 0.1)' : 'transparent', borderColor: status === 'reject' ? 'var(--error)' : 'var(--border-strong)' }}
        >
          Reject
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run → PASS** — `pnpm test src/features/insights/components/PatternCard.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/features/insights/components/PatternCard.tsx src/features/insights/components/PatternCard.test.tsx
git commit -m "feat(insights): PatternCard — critique grid + AI reasoning + confirm/monitor/reject"
```

---

## Task 5: PatternsView

**Files:** Rewrite `src/features/insights/views/PatternsView.tsx`; create `src/features/insights/views/PatternsView.test.tsx`. Contract: `insights.jsx` `PatternsPanel` (62-98).

- [ ] **Step 1: Failing test** — `src/features/insights/views/PatternsView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { PatternsView } from './PatternsView'

test('shows the pattern count, the confidence floor and the recently-confirmed list', () => {
  render(<PatternsView />)
  expect(screen.getByText('Új minták · 3')).toBeInTheDocument()
  expect(screen.getByText('min. 65% conf')).toBeInTheDocument()
  expect(screen.getByText('Recently confirmed · L3')).toBeInTheDocument()
  expect(screen.getByText('Hét 18: Pre-workout 2-3h whey + carb')).toBeInTheDocument()
})

test('renders one card per pattern', () => {
  render(<PatternsView />)
  expect(screen.getByText('Reta beadás + 36h ablakban étvágy lefulladás')).toBeInTheDocument()
  expect(screen.getByText('Caffeine 14:00 utáni dózis → sleep onset +24 perc')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/features/insights/views/PatternsView.test.tsx`.

- [ ] **Step 3: Implement `src/features/insights/views/PatternsView.tsx`:**

```tsx
import { Icon } from '@/components/ui/Icon'
import { useInsights } from '@/data/hooks'
import { MIN_PATTERN_CONFIDENCE } from '@/data/insights'
import { PatternCard } from '../components/PatternCard'

export function PatternsView() {
  const { patterns: all, recentlyConfirmed } = useInsights()
  const patterns = all.filter((p) => p.confidence >= MIN_PATTERN_CONFIDENCE)

  return (
    <div className="col gap-md">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Új minták · {patterns.length}</span>
        <span className="eyebrow text-tertiary">min. {(MIN_PATTERN_CONFIDENCE * 100).toFixed(0)}% conf</span>
      </div>

      {patterns.map((p) => (
        <PatternCard key={p.id} pattern={p} />
      ))}

      {patterns.length === 0 && (
        <div className="card notch-8" style={{ padding: 16, textAlign: 'center' }}>
          <p className="text-tertiary" style={{ fontSize: 12 }}>Csak alacsonyabb confidence minták vannak.</p>
        </div>
      )}

      <div className="card notch-4 mt-md" style={{ padding: 14, background: 'rgba(94, 234, 212, 0.03)' }}>
        <div className="eyebrow brand">Recently confirmed · L3</div>
        <div className="col gap-sm mt-md">
          {recentlyConfirmed.map((t, i) => (
            <div key={i} className="row gap-sm">
              <Icon name="check" size={14} color="var(--brand-glow)" />
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run → PASS** — `pnpm test src/features/insights/views/PatternsView.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/features/insights/views/PatternsView.tsx src/features/insights/views/PatternsView.test.tsx
git commit -m "feat(insights): PatternsView — list + recently-confirmed"
```

---

## Task 6: WeeklyView

**Files:** Rewrite `src/features/insights/views/WeeklyView.tsx`; create `src/features/insights/views/WeeklyView.test.tsx`. Contract: `insights.jsx` `WeeklyPanel` (184-232).

- [ ] **Step 1: Failing test** — `src/features/insights/views/WeeklyView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { WeeklyView } from './WeeklyView'

test('renders the score hero, the delta, every item and the plan suggestion', () => {
  render(<WeeklyView />)
  expect(screen.getByText('Hét 21 áttekintés · Máj 18-24')).toBeInTheDocument()
  expect(screen.getByText('82')).toBeInTheDocument()
  expect(screen.getByText('+4')).toBeInTheDocument()
  expect(screen.getByText('Edzés volumen')).toBeInTheDocument()
  expect(screen.getByText('Niggle-mentes napok')).toBeInTheDocument()
  expect(screen.getByText('Mezo · heti tervjavaslat')).toBeInTheDocument()
  expect(screen.getByText(/Hét 22: tartsd ezt a Pull\/Push/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/features/insights/views/WeeklyView.test.tsx`.

- [ ] **Step 3: Implement `src/features/insights/views/WeeklyView.tsx`** (port `WeeklyPanel`; `trend` arrow + colour helper):

```tsx
import { useInsights } from '@/data/hooks'
import type { WeeklyTrend } from '@/data/types'

function trendArrow(t: WeeklyTrend): string {
  return t === 'up' ? '↗' : t === 'down' ? '↘' : '→'
}

function trendColor(t: WeeklyTrend): string {
  return t === 'up' ? 'var(--success)' : t === 'down' ? 'var(--error)' : 'var(--text-tertiary)'
}

export function WeeklyView() {
  const { weekly, weeklySuggestion } = useInsights()

  return (
    <div className="col gap-md">
      <div className="card notch-12" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="col">
            <span className="eyebrow brand">{weekly.title}</span>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 56, fontWeight: 600, lineHeight: 1, marginTop: 8 }}>
              {weekly.score}
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 16, color: 'var(--text-tertiary)', marginLeft: 6 }}>/100</span>
            </div>
          </div>
          <div className="col" style={{ alignItems: 'flex-end' }}>
            <span className="label-mono" style={{ color: weekly.delta > 0 ? 'var(--success)' : 'var(--error)' }}>
              {weekly.delta > 0 ? '+' : ''}{weekly.delta}
            </span>
            <span className="text-tertiary" style={{ fontSize: 10, marginTop: 4 }}>vs hét 20</span>
          </div>
        </div>

        <div className="col gap-md mt-lg" style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          {weekly.items.map((it, i) => (
            <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
              <span className="text-secondary" style={{ fontSize: 13 }}>{it.label}</span>
              <div className="row gap-sm">
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{it.value}</span>
                <span style={{ fontSize: 12, color: trendColor(it.trend) }}>{trendArrow(it.trend)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card notch-4" style={{ padding: 14 }}>
        <span className="eyebrow brand">Mezo · heti tervjavaslat</span>
        <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-primary)', lineHeight: 1.5 }}>{weeklySuggestion}</p>
        <div className="row gap-sm mt-md">
          <button type="button" className="cta-ghost notch-4" style={{ fontSize: 10 }}>Elfogad</button>
          <button type="button" className="chip" style={{ fontSize: 9 }}>Hangoljuk</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run → PASS** — `pnpm test src/features/insights/views/WeeklyView.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/features/insights/views/WeeklyView.tsx src/features/insights/views/WeeklyView.test.tsx
git commit -m "feat(insights): WeeklyView — score hero + trends + plan suggestion"
```

---

## Task 7: MemoirView

**Files:** Rewrite `src/features/insights/views/MemoirView.tsx`; create `src/features/insights/views/MemoirView.test.tsx`. Contract: `insights.jsx` `MemoirPanel` (235-294).

- [ ] **Step 1: Failing test** — `src/features/insights/views/MemoirView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoirView } from './MemoirView'

test('renders the memoir card, anchors, anniversary card and archive footer', () => {
  render(<MemoirView />)
  expect(screen.getByText('Heti memoir · Hét 20 · 2026 · Máj 11-17')).toBeInTheDocument()
  expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
  expect(screen.getByText('[PR] Chest Row 102.5 × 9')).toBeInTheDocument()
  expect(screen.getByText('Évforduló · 1 hónap')).toBeInTheDocument()
  expect(screen.getByText('Memoir archive · 17 darab')).toBeInTheDocument()
})

test('reaction chips toggle the brand state', async () => {
  const { container } = render(<MemoirView />)
  const like = screen.getByRole('button', { name: /Like/ })
  expect(like.className).not.toMatch(/brand/)
  await userEvent.click(like)
  expect(like.className).toMatch(/brand/)
})
```

> `RefTag` renders `[{kind}]&nbsp;{label}`. The `&nbsp;` is a non-breaking space (` `), so a plain-space matcher like `getByText('[PR] Chest Row 102.5 × 9')` may miss. Prefer a function/regex matcher: `screen.getByText((_, el) => el?.textContent === '[PR] Chest Row 102.5 × 9')`, or assert on the `label` substring with `{ exact: false }`.

- [ ] **Step 2: Run → FAIL** — `pnpm test src/features/insights/views/MemoirView.test.tsx`.

- [ ] **Step 3: Implement `src/features/insights/views/MemoirView.tsx`** (port `MemoirPanel`; reactions in local state; `RefTag` for anchors):

```tsx
import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { RefTag } from '@/components/ui/RefTag'
import { cn } from '@/lib/cn'
import { useInsights } from '@/data/hooks'

type ReactionKey = 'like' | 'love' | 'save' | 'dismiss'

export function MemoirView() {
  const { memoir, anniversaryNote } = useInsights()
  const [reactions, setReactions] = useState<Record<ReactionKey, boolean>>({
    like: false,
    love: false,
    save: false,
    dismiss: false,
  })
  const toggle = (k: ReactionKey) => setReactions((r) => ({ ...r, [k]: !r[k] }))

  return (
    <div className="col gap-md">
      <div className="memoir-card notch-12" style={{ padding: 22, position: 'relative', overflow: 'hidden' }}>
        <div
          style={{ position: 'absolute', right: -40, top: -40, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(94, 234, 212, 0.15), transparent 70%)' }}
        />
        <div className="row gap-sm">
          <Icon name="bookmark" size={14} color="var(--brand-glow)" />
          <span className="eyebrow brand">Heti memoir · {memoir.week}</span>
        </div>
        <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, lineHeight: 1.15, marginTop: 12, color: 'var(--text-primary)' }}>
          {memoir.title}
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.65, marginTop: 14, color: 'var(--text-primary)' }}>{memoir.body}</p>

        <div className="row gap-xs flex-wrap mt-lg" style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <span className="eyebrow text-tertiary" style={{ marginRight: 6 }}>Anchors</span>
          {memoir.anchors.map((a, i) => (
            <RefTag key={i} kind={a.kind} label={a.label} />
          ))}
        </div>

        <div className="row gap-sm mt-lg">
          <button type="button" onClick={() => toggle('like')} className={cn('chip', reactions.like && 'brand')} style={{ padding: '8px 12px' }}>
            👍 Like
          </button>
          <button type="button" onClick={() => toggle('love')} className={cn('chip', reactions.love && 'brand')} style={{ padding: '8px 12px' }}>
            <Icon name="heart" size={12} color={reactions.love ? 'var(--brand-glow)' : undefined} /> Love
          </button>
          <button type="button" onClick={() => toggle('save')} className={cn('chip', reactions.save && 'brand')} style={{ padding: '8px 12px' }}>
            <Icon name="bookmark" size={12} color={reactions.save ? 'var(--brand-glow)' : undefined} /> Save
          </button>
          <button type="button" onClick={() => toggle('dismiss')} className="chip" style={{ padding: '8px 12px', opacity: reactions.dismiss ? 0.5 : 1 }}>
            <Icon name="x" size={12} /> Dismiss
          </button>
        </div>
      </div>

      <div className="card notch-12" style={{ padding: 16, borderColor: 'rgba(94, 234, 212, 0.3)', background: 'rgba(94, 234, 212, 0.03)' }}>
        <div className="row gap-sm">
          <Icon name="sparkle" size={14} color="var(--brand-glow)" />
          <span className="eyebrow brand">Évforduló · 1 hónap</span>
        </div>
        <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-primary)', lineHeight: 1.5 }}>{anniversaryNote}</p>
      </div>

      <div className="row gap-sm" style={{ justifyContent: 'center', marginTop: 8 }}>
        <span className="eyebrow text-tertiary">Memoir archive · 17 darab</span>
        <span className="eyebrow brand">→</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run → PASS** — `pnpm test src/features/insights/views/MemoirView.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/features/insights/views/MemoirView.tsx src/features/insights/views/MemoirView.test.tsx
git commit -m "feat(insights): MemoirView — memoir card + reactions + anniversary + archive"
```

---

## Task 8: KnowledgeListView (reuses `useKnowledge`)

**Files:** Rewrite `src/features/insights/views/KnowledgeListView.tsx`; create `src/features/insights/views/KnowledgeListView.test.tsx`. Contract: `insights.jsx` `KnowledgeListPanel` (297-331). **Reuses** `useKnowledge` (`src/data/hooks.ts`) + `factCategoryColor` (`src/data/knowledge.ts`) + the shared `Toggle` primitive.

- [ ] **Step 1: Failing test** — `src/features/insights/views/KnowledgeListView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeListView } from './KnowledgeListView'

test('shows the fact count and the active-in-prompt count', () => {
  render(<KnowledgeListView />)
  expect(screen.getByText('Tudás · 15 fact')).toBeInTheDocument()
  // 14 of the 15 seeded facts start active (f9 is inactive)
  expect(screen.getByText('14 aktív promptban')).toBeInTheDocument()
  expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
})

test('toggling a fact updates the active count', async () => {
  render(<KnowledgeListView />)
  const toggles = screen.getAllByRole('switch')
  await userEvent.click(toggles[0]) // f1 active → inactive
  expect(screen.getByText('13 aktív promptban')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/features/insights/views/KnowledgeListView.test.tsx`.

- [ ] **Step 3: Implement `src/features/insights/views/KnowledgeListView.tsx`** (port `KnowledgeListPanel`; local toggle map seeded from each fact's `active`; shared `Toggle`):

```tsx
import { useState } from 'react'
import { Toggle } from '@/components/ui/Toggle'
import { useKnowledge } from '@/data/hooks'
import { factCategoryColor } from '@/data/knowledge'

export function KnowledgeListView() {
  const { facts } = useKnowledge()
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    facts.reduce<Record<string, boolean>>((acc, f) => ({ ...acc, [f.id]: f.active }), {}),
  )
  const activeCount = facts.filter((f) => active[f.id]).length

  return (
    <div className="col gap-md">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Tudás · {facts.length} fact</span>
        <span className="eyebrow brand">{activeCount} aktív promptban</span>
      </div>

      <div className="col gap-sm">
        {facts.map((f) => {
          const color = factCategoryColor(f.category)
          return (
            <div key={f.id} className="card notch-4" style={{ padding: 12, opacity: active[f.id] ? 1 : 0.5, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
              <div className="row gap-sm" style={{ paddingLeft: 8, alignItems: 'center' }}>
                <div className="col flex-1">
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{f.text}</span>
                  <div className="row gap-sm mt-sm">
                    <span className="label-mono" style={{ fontSize: 9, color }}>{f.category}</span>
                    <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}>×{f.reinforced} reinforced</span>
                  </div>
                </div>
                <Toggle
                  on={active[f.id]}
                  onToggle={() => setActive((a) => ({ ...a, [f.id]: !a[f.id] }))}
                  ariaLabel={`${f.text} aktív a promptban`}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-tertiary mt-md" style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5, padding: '0 20px' }}>
        Az aktív tények minden chat-fordulóba bekerülnek a system promptba. A graph nézethez · Me → Knowledge.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run → PASS** — `pnpm test src/features/insights/views/KnowledgeListView.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/features/insights/views/KnowledgeListView.tsx src/features/insights/views/KnowledgeListView.test.tsx
git commit -m "feat(insights): KnowledgeListView — flat fact list + toggles (reuses useKnowledge)"
```

---

## Task 9: ChatMessage + ChatView

**Files:** Create `src/features/insights/components/ChatMessage.tsx`; rewrite `src/features/insights/views/ChatView.tsx`; create `src/features/insights/views/ChatView.test.tsx`. Contract: `insights.jsx` `ChatPanel` (350-414) + `ChatMessage` (416-445).

- [ ] **Step 1: Failing test** — `src/features/insights/views/ChatView.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatView } from './ChatView'

test('seeds the conversation and the composer', () => {
  render(<ChatView />)
  expect(screen.getByText(/Jó reggelt\. Tegnap a Push Day/)).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Mondj valamit...')).toBeInTheDocument()
  // assistant tool-transparency chip
  expect(screen.getByText('get_recent_workouts(days=3)')).toBeInTheDocument()
})

test('sending a message appends it and then simulates a reply', async () => {
  vi.useFakeTimers()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<ChatView />)
  const input = screen.getByPlaceholderText('Mondj valamit...')
  await user.type(input, 'Fáradt vagyok{Enter}')
  expect(screen.getByText('Fáradt vagyok')).toBeInTheDocument()
  await act(async () => { vi.advanceTimersByTime(1300) })
  expect(screen.getByText(/A Reta D3-on ez gyakori/)).toBeInTheDocument()
  vi.useRealTimers()
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/features/insights/views/ChatView.test.tsx`.

- [ ] **Step 3: Implement `src/features/insights/components/ChatMessage.tsx`** (port `ChatMessage` 416-445; user bubble right, assistant left with tool chips + refs):

```tsx
import { RefTag } from '@/components/ui/RefTag'
import { ToolChipRow } from '@/components/ui/ToolChipRow'
import type { ChatMessage as ChatMessageT } from '@/data/types'

export function ChatMessage({ m }: { m: ChatMessageT }) {
  if (m.role === 'user') {
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
        <div className="card notch-12" style={{ padding: '10px 14px', background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{m.text}</p>
        </div>
        <span style={{ fontSize: 9, fontFamily: 'var(--ff-mono)', display: 'block', textAlign: 'right', marginTop: 4, color: 'var(--text-tertiary)' }}>{m.ts}</span>
      </div>
    )
  }
  return (
    <div className="col gap-sm" style={{ alignSelf: 'flex-start', maxWidth: '92%', width: '92%' }}>
      <div className="row gap-sm">
        <span className="eyebrow brand">Mezo</span>
        <span className="text-tertiary" style={{ fontSize: 9, fontFamily: 'var(--ff-mono)' }}>{m.ts}</span>
      </div>
      {m.tools && <ToolChipRow tools={m.tools} />}
      <div className="card notch-12" style={{ padding: 14 }}>
        <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55 }}>{m.text}</p>
        {m.refs && (
          <div className="row gap-xs flex-wrap mt-md" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <span className="eyebrow text-tertiary" style={{ fontSize: 9 }}>Hivatkozott · L3</span>
            {m.refs.map((r, i) => (
              <RefTag key={i} kind={r.kind} label={r.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

> Confirm `ToolChipRow`'s prop is `tools` (it is, per `RecipeDetailSheet.tsx:143`). If its signature differs, adapt the prop name here.

- [ ] **Step 4: Implement `src/features/insights/views/ChatView.tsx`** (port `ChatPanel`; capture `const text = draft` to avoid the stale-closure smell; simulated reply via `setTimeout`):

```tsx
import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useChat } from '@/data/hooks'
import type { ChatMessage as ChatMessageT } from '@/data/types'
import { ChatMessage } from '../components/ChatMessage'

export function ChatView() {
  const { initialChat } = useChat()
  const [messages, setMessages] = useState<ChatMessageT[]>(initialChat)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setMessages((m) => [...m, { role: 'user', ts: 'now', text }])
    setDraft('')
    setThinking(true)
    setTimeout(() => {
      setThinking(false)
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          ts: 'now',
          text:
            'Értem — és köszönöm hogy megosztottad. ' +
            (text.toLowerCase().includes('fáradt')
              ? 'A Reta D3-on ez gyakori; ne erőltessük a Pull Day-t ma. Egy könnyű walk és egy fehérje-snack többet adhat mint egy fél-erővel csinált edzés.'
              : 'Nézzük meg az adatokat: az elmúlt 3 napban a kalória-pacing 80%+ volt, és a Reta D3 ablakban ez stabil — innen indulhatunk.'),
          tools: [
            { type: 'read', name: 'get_recent_checkins(d=3)' },
            { type: 'compute', name: `recallSharedMemory(theme='${text.slice(0, 20)}')` },
          ],
          refs: [{ kind: 'CheckIn', id: 'ci-2026-05-21' }],
        },
      ])
    }, 1200)
  }

  return (
    <div className="col gap-md">
      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <div className="col">
          <span className="eyebrow brand">Mezo · társ</span>
          <span className="text-tertiary" style={{ fontSize: 11, fontFamily: 'var(--ff-mono)' }}>23 facts active · Gemini 3.1 Pro</span>
        </div>
        <span className="chip brand" style={{ fontSize: 9 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-glow)' }} />
          L4 aktív
        </span>
      </div>

      <div className="col gap-md" style={{ minHeight: 320 }}>
        {messages.map((m, i) => (
          <ChatMessage key={i} m={m} />
        ))}
        {thinking && (
          <div className="col gap-sm" style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
            <span className="eyebrow brand">Mezo</span>
            <div className="card notch-12" style={{ padding: 14 }}>
              <div className="row gap-xs">
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-glow)', animation: `pulse-soft 1.2s ease-in-out infinite ${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card notch-12" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="chip" style={{ padding: 8 }} aria-label="Hangbevitel">
          <Icon name="mic" size={14} />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Mondj valamit..."
          style={{ flex: 1, padding: '8px 4px', fontSize: 13 }}
        />
        <button type="button" className="chip brand" onClick={send} style={{ padding: 8 }} aria-label="Küldés">
          <Icon name="send" size={14} />
        </button>
      </div>
    </div>
  )
}
```

> The prototype animates the thinking dots with `@keyframes pulse-soft`. Confirm `pulse-soft` exists in `src/styles/prototype.css` (it was ported in Foundation for active set-dots). If absent, the dots still render statically — acceptable for parity of the resting state; file a follow-up only if the keyframe is genuinely missing.

- [ ] **Step 5: Run → PASS** — `pnpm test src/features/insights/views/ChatView.test.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/features/insights/components/ChatMessage.tsx src/features/insights/views/ChatView.tsx src/features/insights/views/ChatView.test.tsx
git commit -m "feat(insights): ChatView — tool-transparency conversation + simulated reply"
```

---

## Task 10: PredictionsView

**Files:** Rewrite `src/features/insights/views/PredictionsView.tsx`; create `src/features/insights/views/PredictionsView.test.tsx`. Contract: `insights.jsx` `PredictionsPanel` (448-480).

- [ ] **Step 1: Failing test** — `src/features/insights/views/PredictionsView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { PredictionsView } from './PredictionsView'

test('renders the header, pending + validated states, confidence and outcome', () => {
  render(<PredictionsView />)
  expect(screen.getByText('Aktív predikciók')).toBeInTheDocument()
  expect(screen.getByText('2 validated · 60-day acc 68%')).toBeInTheDocument()
  expect(screen.getByText('Csütörtök Pull Day · Chest Row PR (107.5 × 8)')).toBeInTheDocument()
  expect(screen.getAllByText('◐ Pending').length).toBeGreaterThan(0)
  expect(screen.getByText('RPE 8.2 · vacsora 20:50')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/features/insights/views/PredictionsView.test.tsx`.

- [ ] **Step 3: Implement `src/features/insights/views/PredictionsView.tsx`** (port `PredictionsPanel`):

```tsx
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { useInsights } from '@/data/hooks'

export function PredictionsView() {
  const { predictions } = useInsights()

  return (
    <div className="col gap-md">
      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Aktív predikciók</span>
        <span className="eyebrow text-tertiary">2 validated · 60-day acc 68%</span>
      </div>

      {predictions.map((p) => (
        <div key={p.id} className="card notch-12" style={{ padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className={cn('chip', p.status === 'validated' && 'brand')} style={{ fontSize: 9 }}>
              {p.status === 'validated' ? '✓ Validated' : '◐ Pending'}
            </span>
            <span className="label-mono" style={{ fontSize: 9 }}>{p.date}</span>
          </div>

          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 15, marginTop: 8, lineHeight: 1.2, color: 'var(--text-primary)' }}>{p.title}</div>

          <div className="row mt-sm" style={{ justifyContent: 'space-between' }}>
            <div className="bar" style={{ flex: 1, marginRight: 12 }}>
              <div className="bar-fill glow" style={{ width: `${p.confidence * 100}%` }} />
            </div>
            <span className="label-mono" style={{ fontSize: 10, color: 'var(--brand-glow)' }}>{(p.confidence * 100).toFixed(0)}%</span>
          </div>

          {p.basis && <p className="text-secondary mt-sm" style={{ fontSize: 12, lineHeight: 1.5 }}>{p.basis}</p>}

          {p.actual && (
            <div className="row gap-sm mt-md" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <Icon name="check" size={14} color="var(--success)" />
              <span style={{ fontSize: 12, color: 'var(--success)' }}>{p.actual}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run → PASS** — `pnpm test src/features/insights/views/PredictionsView.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/features/insights/views/PredictionsView.tsx src/features/insights/views/PredictionsView.test.tsx
git commit -m "feat(insights): PredictionsView — tracked predictions + outcomes"
```

---

## Task 11: ExperimentsView

**Files:** Rewrite `src/features/insights/views/ExperimentsView.tsx`; create `src/features/insights/views/ExperimentsView.test.tsx`. Contract: `insights.jsx` `ExperimentsPanel` (483-509).

- [ ] **Step 1: Failing test** — `src/features/insights/views/ExperimentsView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { ExperimentsView } from './ExperimentsView'

test('renders the count, an active + a completed experiment, and the propose CTA', () => {
  render(<ExperimentsView />)
  expect(screen.getByText('N=1 kísérletek · 2')).toBeInTheDocument()
  expect(screen.getByText('Glikogén-feltöltés volleyball előtt')).toBeInTheDocument()
  expect(screen.getByText('◐ Aktív')).toBeInTheDocument()
  expect(screen.getByText('✓ Megerősítve')).toBeInTheDocument()
  expect(screen.getByText('Megerősítve · 3/4 mérés')).toBeInTheDocument()
  expect(screen.getByText('+ Új kísérlet javasol Mezo')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/features/insights/views/ExperimentsView.test.tsx`.

- [ ] **Step 3: Implement `src/features/insights/views/ExperimentsView.tsx`** (port `ExperimentsPanel`; the status chip class + label depend on `status`/`outcomeGood`):

```tsx
import { cn } from '@/lib/cn'
import { useInsights } from '@/data/hooks'
import type { Experiment } from '@/data/types'

function statusChipClass(e: Experiment): string {
  // active → warning; completed+good → brand; completed+not-good → plain
  if (e.status === 'active') return 'warning'
  return e.outcomeGood ? 'brand' : ''
}

function statusLabel(e: Experiment): string {
  if (e.status === 'active') return '◐ Aktív'
  return e.outcomeGood ? '✓ Megerősítve' : '◯ Lezárva'
}

export function ExperimentsView() {
  const { experiments } = useInsights()

  return (
    <div className="col gap-md">
      <span className="eyebrow">N=1 kísérletek · {experiments.length}</span>

      {experiments.map((e) => (
        <div key={e.id} className="card notch-12" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className={cn('chip', statusChipClass(e))} style={{ fontSize: 9 }}>{statusLabel(e)}</span>
            <span className="label-mono" style={{ fontSize: 9 }}>{e.day}/{e.total} nap</span>
          </div>

          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, marginTop: 8, lineHeight: 1.2 }}>{e.title}</div>
          <p className="text-secondary mt-sm" style={{ fontSize: 12, lineHeight: 1.5 }}>{e.hypothesis}</p>

          <div className="bar mt-md">
            <div className="bar-fill glow" style={{ width: `${(e.day / e.total) * 100}%` }} />
          </div>

          {e.outcome && <p className="mt-sm" style={{ fontSize: 12, color: 'var(--success)', lineHeight: 1.4 }}>{e.outcome}</p>}
        </div>
      ))}

      <button type="button" className="cta-ghost notch-4 mt-md" style={{ textAlign: 'center', padding: 14 }}>
        + Új kísérlet javasol Mezo
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run → PASS** — `pnpm test src/features/insights/views/ExperimentsView.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/features/insights/views/ExperimentsView.tsx src/features/insights/views/ExperimentsView.test.tsx
git commit -m "feat(insights): ExperimentsView — N=1 experiments + propose CTA"
```

---

## Task 12: Insights navigation smoke test + parity harness + acceptance checklist

**Files:** Create `src/features/insights/insights.nav.test.tsx`; extend the parity harness config (mirror Fuel's Task 29 — whatever file the slice-3 parity test lives in, e.g. `tests/parity/*` or the existing parity spec). Contract: `02-screens.md` TAB 4 + the per-slice "Done" acceptance list in the Phase-1 design spec.

- [ ] **Step 1: Navigation smoke test** — `src/features/insights/insights.nav.test.tsx` (drives the real router through all 7 sub-tabs; mirrors the existing app-level shell/navigation test pattern in `src/app/navigation.test.tsx`):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'

function renderApp(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

test('Insights opens on Patterns and the page title tracks the active sub-tab', async () => {
  renderApp('/insights')
  // page title (h1) reflects the active tab
  expect(screen.getByRole('heading', { name: 'Patterns' })).toBeInTheDocument()
  expect(screen.getByText('Új minták · 3')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('link', { name: 'Memoir' }))
  expect(screen.getByRole('heading', { name: 'Memoir' })).toBeInTheDocument()
  expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('link', { name: 'Chat' }))
  expect(screen.getByPlaceholderText('Mondj valamit...')).toBeInTheDocument()
})
```

> If `PageTitle` does not render an `<h1>`/`role="heading"`, assert with `screen.getByText('Patterns')` scoped to the header instead. Check `PageTitle.tsx` first and match its actual element.

- [ ] **Step 2: Run → PASS** — `pnpm test src/features/insights/insights.nav.test.tsx`.

- [ ] **Step 3: Extend the parity harness** — add the 7 Insights routes to the slice-3 parity config so each renders at 440×956 against the prototype. Follow the exact mechanism used by the Fuel parity task (`mezo-0xh.29`); typical shape:

```
/insights            → prototype Insights · Patterns
/insights/weekly     → prototype Insights · Weekly
/insights/memoir     → prototype Insights · Memoir
/insights/knowledge  → prototype Insights · Knowledge
/insights/chat       → prototype Insights · Chat
/insights/predictions→ prototype Insights · Predictions
/insights/experiments→ prototype Insights · Experiments
```

- [ ] **Step 4: Run the parity screenshots** (both themes) — render our app and the prototype, screenshot each Insights sub-tab at 440×956, compare. Fix any drift (spacing, colour tokens, font, notch corners, accent strips, critique bars, memoir gradient).

- [ ] **Step 5: Acceptance checklist (Phase-1 "Done" per slice)** — verify and tick:
  - [ ] Dark **and** light both correct & persisted (toggle via Me → Settings, reload).
  - [ ] Notch corners / accent strips / tool-chips / eyebrows match the prototype on every sub-tab.
  - [ ] Pixel-parity at 440×956 for all 7 sub-tabs.
  - [ ] No `dangerouslySetInnerHTML`; tokens used instead of stray `rgba()` where a token exists.
  - [ ] Hungarian copy verbatim (spot-check memoir body, pattern mechanism, chat replies).
  - [ ] Sub-nav horizontally scrolls with the right-fade mask; sticky under the status bar.
  - [ ] Knowledge sub-tab is the **flat list** (graph stays in Me/Tudás; `mezo-2m4` still open for the real graph).
  - [ ] `pnpm test run` fully green; `pnpm build` (tsc) clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/insights/insights.nav.test.tsx tests
git commit -m "test(insights): nav smoke test + parity harness + acceptance"
```

---

## Self-Review (completed before handoff)

**Spec coverage** — every Insights sub-tab in `02-screens.md` TAB 4 has a task: Patterns (T4/T5), Weekly (T6), Memoir (T7), Knowledge flat list (T8), Chat (T9), Predictions (T10), Experiments (T11); shell + sub-nav (T1); data (T2/T3); verification (T12). The deferred force-graph is explicitly out of this slice (`mezo-2m4`).

**Placeholder scan** — no TBD/TODO; every code step shows complete code; every test step shows assertions.

**Type consistency** — `Pattern`/`PatternCritique`/`PatternStatus`/`PatternCategory`, `Memoir`/`MemoirAnchor`, `Prediction`/`PredictionStatus`, `Experiment`/`ExperimentStatus`, `WeeklyReview`/`WeeklyItem`/`WeeklyTrend`, `ChatMessage`/`ChatRole`/`ChatRef` defined in Task 2/3 and consumed unchanged in Tasks 4-11. `patternCategoryColor`/`MIN_PATTERN_CONFIDENCE` defined in `insights.ts` (T2), used in T4/T5. `useInsights`/`useChat` defined in T2/T3, used in views. `useKnowledge`/`factCategoryColor` reused from Slice 2 in T8.

**Verify-while-building reminders for the implementer (do NOT assume):**
1. `data.js:1367-1394` chat message count — the Task 3 test asserts `2`; if the authoritative file differs, follow the file and adjust the count.
2. `ToolChipRow` prop name is `tools` (confirmed in `RecipeDetailSheet.tsx`) — re-confirm before Task 9.
3. `PageTitle` rendered element (`<h1>`?) for the Task 12 heading assertion.
4. `pulse-soft` keyframe presence for the chat thinking dots.
5. `RefTag` uses `&nbsp;` between kind and label — use a flexible matcher in the Memoir test.
