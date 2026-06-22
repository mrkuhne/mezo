---
title: Insights
type: feature-domain
status: mock-only
updated: 2026-06-22
tags: [insights, frontend, data-layer]
key_files:
  - frontend/src/features/insights
  - frontend/src/data/insights.ts
  - frontend/src/data/knowledge.ts
  - frontend/src/data/chat.ts
  - frontend/src/data/hooks.ts
  - frontend/src/features/today/components/InsightsTeaser.tsx
related: [_platform-data-layer, _platform-design-system, today, me]
---

# Insights — Feature Documentation

> One-line: the **pattern/companion "AI brain" surface** — where mezo reflects back what it has *learned* about the user (detected patterns, weekly review, memoir, knowledge base, chat, predictions, experiments). **Status: 🔶 mock-only** (Phase-1 frontend; designated **🟣 Phase-3 landing zone**). Lives under the **`/insights`** tab (4th in `TabBar`, between Fuel and Me).

---

## 1. Summary

Insights is the user-facing window onto mezo's N=1 self-model: it presents the behavioral patterns the (future) AI has inferred, a weekly score review, a literary "memoir," an editable knowledge base of facts, a chat companion, predictions, and self-experiments. Every surface today renders **hand-authored Hungarian mock copy** that *simulates* what the Phase-3 AI will eventually generate.

**Status per layer:**

| Layer | Status | Notes |
|---|---|---|
| FE mock | ✅ done | 7 sub-tabs, all views + tests present |
| FE real-mode | ❌ none | No `isMockMode()` / `apiFetch` / `*Api` path exists for any Insights surface (verified: `data/insights.ts`, `data/knowledge.ts`, `data/chat.ts` are **pure static modules**) |
| Backend (Java) | ❌ none | No `api/feature/insights`, no entity, no Liquibase changeset |

This is **intentional**. Insights is the Phase-3 "AI brain" surface; the single FE↔data boundary (`frontend/src/data/hooks.ts`) is pre-built so the real-mode swap is mechanical, exactly as already proven for biometrics/Train. There are **two distinct roadmap stages** the doc keeps separate:
- **Phase-2 Slice D — "Insights seed-only"**: create `pattern` / `knowledge_fact` / `ai_conversation` tables with seed rows, **no AI** — `docs/superpowers/specs/2026-06-10-phase2-backend-design.md:126`; status ⏳ remaining (`docs/milestones/roadmap.md:12`).
- **Phase 3 — the actual AI**: Spring AI + pgvector + RAG + pattern/companion pipeline (`docs/milestones/roadmap.md:13`).

Driving specs: `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (Slice D §126; Phase-3 out of scope §6) · `docs/milestones/roadmap.md:12-13`.

---

## 2. User-facing behavior

**Route:** `/insights` (`frontend/src/app/TabBar.tsx:10`, icon `insights`). Shell + 7 sub-tabs wired in `frontend/src/app/router.tsx:76-87` from `INSIGHTS_TABS` (`frontend/src/features/insights/tabs.ts`):

| Sub-tab | Route | Label (verbatim) | View |
|---|---|---|---|
| patterns | `/insights` (index) | `Patterns` | `PatternsView` |
| weekly | `/insights/weekly` | `Weekly` | `WeeklyView` |
| memoir | `/insights/memoir` | `Memoir` | `MemoirView` |
| knowledge | `/insights/knowledge` | `Knowledge` | `KnowledgeListView` |
| chat | `/insights/chat` | `Chat` | `ChatView` |
| predictions | `/insights/predictions` | `Predictions` | `PredictionsView` |
| experiments | `/insights/experiments` | `Experiments` | `ExperimentsView` |

The shell `InsightsScreen` (`frontend/src/features/insights/InsightsScreen.tsx`) renders a `page-header` (`Eyebrow brand "Insights"` + `PageTitle` tracking the active tab's label, derived from `pathname.split('/')[2]`), a **decorative, handler-less** settings `chip` (`aria-label="Insights beállítások"`), the sticky `InsightsSubNav` (`aria-label="Insights alnavigáció"`), and an `<Outlet/>`.

### 2.1 Patterns (`views/PatternsView.tsx`)
Default tab. Filters `patterns` to `confidence >= MIN_PATTERN_CONFIDENCE` (`0.65`) and renders a `PatternCard` per pattern. Header: `Új minták · {count}` + `min. 65% conf`. Empty-state card ("Csak alacsonyabb confidence minták vannak."). Below: a "Recently confirmed · L3" card listing `recentlyConfirmed` strings.

**`PatternCard`** (`components/PatternCard.tsx`) is the richest component: left accent bar in the category color (`patternCategoryColor(cat)` → `var(--cat-{cat})`), category chip + `conf NN%`, Antonio display title, mechanism paragraph, and a **4-row "critique grid"** (`Statistical / Confounders / L3 align / Actionability`), each a labeled progress `bar` colored by confidence band. Evidence string chips. An expandable **"AI gondolatmenete"** disclosure (local `useState`, shown only if `pattern.thinking` present) revealing the model's reasoning. Footer: three mutually-exclusive **Confirm / Monitor / Reject** buttons setting local `status` state (`PatternStatus`) — **local-only, no persistence** (the would-be human-in-the-loop accept/reject gate).

### 2.2 Weekly (`views/WeeklyView.tsx`)
A big `score` `/100` with `delta` vs "hét 20", a bordered list of `weekly.items` (label · value · trend arrow `↗/↘/→`), then a "Mezo · heti tervjavaslat" card showing `weeklySuggestion` with inert **"Elfogad" / "Hangoljuk"** buttons.

### 2.3 Memoir (`views/MemoirView.tsx`)
A literary weekly narrative. `memoir-card` with radial glow, bookmark eyebrow + `memoir.week`, display title, long `body` prose, an **Anchors** row rendering `RefTag` per `memoir.anchor` (`[kind] label`). Four reaction toggles (👍 Like / Love / Save / Dismiss) backed by a local `Record<ReactionKey, boolean>` — **local-only**. Below: an "Évforduló · 1 hónap" card (`anniversaryNote`) and a static "Memoir archive · 17 darab →" footer (inert).

### 2.4 Knowledge (`views/KnowledgeListView.tsx`)
Lists `facts` (from `useKnowledge`) as cards with left accent bar (`factCategoryColor`), text, `category` mono label, `×N reinforced`, and a per-fact **`Toggle`** (the "active in prompt" switch). Toggle state is **local `useState`** seeded from `f.active` — flipping changes the header's "`{activeCount} aktív promptban`" count but **does not persist**. Footer: *"Az aktív tények minden chat-fordulóba bekerülnek a system promptba. A graph nézethez · Me → Knowledge."* — explicitly routing the user to the richer graph view in the Me tab (see §5).

### 2.5 Chat (`views/ChatView.tsx`)
The companion conversation. Seeds from `initialChat` into local `useState<ChatMessageT[]>`. Header: "Mezo · társ", "`23 facts active · Gemini 3.1 Pro`" (hard-coded mono string), and an "L4 aktív" status chip. **Send flow is fully simulated**: `send()` appends the user message, sets `thinking=true` (animated `pulse-soft` 3-dot indicator), then after `setTimeout(…, 1200)` appends a **canned assistant reply** that branches on whether the input contains `"fáradt"`, with fabricated `tools`/`refs`. No network, no real LLM. Composer: mic button (inert), controlled `<input>` (Enter-to-send), send button. **`ChatMessage`** (`components/ChatMessage.tsx`): user bubbles right-aligned; assistant bubbles left, preceded by a `ToolChipRow` (tool transparency) and followed by a "Hivatkozott · L3" footer of `RefTag`s when `refs` present.

### 2.6 Predictions (`views/PredictionsView.tsx`)
Header "Aktív predikciók" + hard-coded "`2 validated · 60-day acc 68%`". Each `Prediction` card: status chip (`✓ Validated` / `◐ Pending`), date, display title, confidence `bar-fill glow` + `NN%`, optional `basis` paragraph, and (when validated) an `actual` outcome line.

### 2.7 Experiments (`views/ExperimentsView.tsx`)
"N=1 kísérletek · {count}". Each `Experiment` card: status chip (active→"◐ Aktív"; completed+good→"✓ Megerősítve"; else "◯ Lezárva"), `day/total nap`, display title, `hypothesis`, a progress `bar-fill glow` = `day/total`, optional `outcome` line. Footer: inert **"+ Új kísérlet javasol Mezo"** button.

---

## 3. Architecture & data flow

The Insights data flow is a **degenerate (truncated) version** of mezo's standard `view → hook → mock/real → api → backend → db` pipeline — it stops at the hook:

```
View (PatternsView, WeeklyView, …)
  → hook (useInsights / useKnowledge / useChat — frontend/src/data/hooks.ts:127-135)
    → static module import (data/insights.ts, data/knowledge.ts, data/chat.ts)
      → [PHASE-3 GAP: no api client, no apiFetch, no backend, no db]
```

Contrast with a real-mode feature (e.g. `useWeight` in `weightHooks.ts` / `useSleep` in `hooks.ts:79`) which switches on `isMockMode()` between static `initialData` and a real `*Api` call over `apiFetch`. The Insights hooks have **none of that machinery** — no TanStack Query, no `initialData`, no mutation, no mode switch:

- `useInsights()` (`hooks.ts:131-133`) → `{ patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments }` — direct static re-exports.
- `useKnowledge()` (`hooks.ts:127-129`) → `{ facts, edges, activeCount: facts.filter(f => f.active).length }`.
- `useChat()` (`hooks.ts:135-137`) → `{ initialChat }`.

All "interactivity" (pattern Confirm/Monitor/Reject, knowledge Toggle, memoir reactions, chat send) lives in **component-local `useState`** and evaporates on unmount. The single FE↔data boundary (`hooks.ts`) is intact and ready — when Phase 3 lands, these three hooks are the **exact swap points**, by design.

---

## 4. Data model & API

> **No backend, no API contract, no DB.** Everything below is the **mock data shape** (the contract the views and tests pin). All types live in `frontend/src/data/types.ts:349-418` ("--- Tudás (knowledge) ---" + "--- Insights (AI-memory surface) ---"). Instances in `data/insights.ts` / `data/knowledge.ts` / `data/chat.ts`.

**Knowledge** (`types.ts:350-352`):
- `FactCategory = 'physiology' | 'preference' | 'trigger' | 'tendency' | 'goal_state'`
- `KnowledgeFact { id; text; category: FactCategory; active: boolean; reinforced: number }` — 15 facts (`f1`–`f15`, `knowledge.ts`)
- `KnowledgeEdge { from; to; type: 'reinforces' | 'context' | 'causes' }` — 13 edges, a directed graph over fact ids
- Helpers in `knowledge.ts`: `FACT_CATEGORIES` (ordered `[id,label]`), `factCategoryColor()`

**Patterns** (`types.ts:355-373`):
- `PatternCategory = 'physiology' | 'trigger' | 'response'` (NB: distinct from `FactCategory`)
- `PatternStatus = 'confirm' | 'monitor' | 'reject'` (UI-local only, never on the data)
- `PatternCritique { statistical; confounders; l3align; actionability }` — four 0–1 scores
- `Pattern { id; category; categoryLabel; confidence; title; mechanism; evidence: string[]; critique; thinking? }` — 3 patterns `p1`–`p3` (`insights.ts`)
- `MIN_PATTERN_CONFIDENCE = 0.65` and `patternCategoryColor()` (`insights.ts:10-14`)

**Memoir** (`types.ts:375-381`): `MemoirAnchor { kind; label }`, `Memoir { week; title; body; anchors }` — single `memoir` + `anniversaryNote` string.

**Weekly** (`types.ts:406-408`): `WeeklyTrend = 'up'|'down'|'flat'`, `WeeklyItem { label; value; trend }`, `WeeklyReview { title; score; delta; items }` — single `weekly` + `weeklySuggestion`.

**Predictions** (`types.ts:383-392`): `PredictionStatus = 'pending'|'validated'`, `Prediction { id; title; confidence; status; date; basis?; actual? }` — 4 instances.

**Experiments** (`types.ts:394-404`): `ExperimentStatus = 'active'|'completed'`, `Experiment { id; title; status; day; total; hypothesis; outcome?; outcomeGood? }` — 2 instances.

**Chat** (`types.ts:410-418`): `ChatRole = 'user'|'assistant'`, `ChatRef { kind; id }`, `ChatMessage { role; ts; text; tools?: Tool[]; refs?: ChatRef[] }`. `Tool` is imported from `@/components/ui/ToolChip` (`{ type: ToolType; name; args? }`, `ToolType = 'read'|'compute'|'write'`). `initialChat` = 3 messages (assistant → user → assistant).

**Endpoints / contract: NONE.** `api/feature/` contains only `auth/checkin/sleep/train/weight/goal/biometrics-profile` (no `insights`/`knowledge`/`chat`). The `ChatView` mock copy *names* fictional tool calls (`get_recent_workouts(days=3)`, `get_sleep(days=7)`, `get_reta_phase()`, `predictAppetiteCurve()`, `recallSharedMemory(theme=…)`) — these are **UI-transparency theater**, not real endpoints, but they sketch the Phase-3 tool surface. The planned Slice-D tables are `pattern` / `knowledge_fact` / `ai_conversation` (seed-only, no AI). **Where the backend plugs in:** rewrite the three hooks in `hooks.ts:127-137` to dual-mode on `isMockMode()` — see §7.

---

## 5. Integrations

Insights is the **hub the other tabs point *toward*** and is itself **fed conceptually by a cross-system "pattern engine."** Today these are **mock-level cross-references** (shared copy / shared data module), not live data flows — but they define the contracts Phase 3 must honor.

### 5.1 `useKnowledge` is shared by THREE views across TWO features — co-design any backend
`useKnowledge()` (`hooks.ts:127`) backs the Insights `KnowledgeListView` **and** the Me-tab `KnowledgeView` (`frontend/src/features/me/views/KnowledgeView.tsx:20`) **and** `ProfileView` (`frontend/src/features/me/views/ProfileView.tsx:18`). Responsibility splits:
- **Insights/Knowledge** = flat editable list with prompt-active toggles (consumes `facts`).
- **Me/Knowledge** = the "Knowledge graph" / "Élő mindmap" view (consumes `facts` **and** `edges` + `activeCount`; the graph render itself "deferred to Slice 4", `KnowledgeView.tsx:62`; the placeholder reads "Gráf nézet · hamarosan (Slice 4)", `:74`).
- The Insights footer literally routes across: *"A graph nézethez · Me → Knowledge."* (`KnowledgeListView.tsx`).

**Crossing type:** `KnowledgeFact[]` + `KnowledgeEdge[]` (`types.ts:350-352`). Any Phase-3 knowledge backend serves **both tabs at once** — they must stay co-designed; do not build a knowledge backend that is Insights-local.

### 5.2 Today → Insights (teaser deep-link)
`frontend/src/features/today/components/InsightsTeaser.tsx` is a Today-tab card that **mirrors pattern `p1` verbatim** ("Reta beadás + 36h ablakban étvágy lefulladás", `Eyebrow "Új minta · 0.85 konfidencia"`) and shows an `Insights → Patterns` chip — a hand-wired teaser into the Insights/Patterns surface. **Contract today:** a *copy* of the mock pattern, not a live read of `useInsights`. Phase 3 should make this a real read of the top pattern.

### 5.3 Me-tab `InsightCard` + `TrendInsight` — a parallel, lighter "insight" type
`frontend/src/features/me/components/InsightCard.tsx` renders a **different** type: `TrendInsight { type: 'milestone'|'pattern'|'warning'; text }` (`types.ts:157-158`). `TrendInsight[]` arrays are embedded in **Goals** (`data/goals.ts`, `insights` field on the goal aggregate, `types.ts:186,218`) and **Sleep**. So the *insight concept leaks into Me/Goals/Sleep* via a lighter inline type. The `pattern` icon in `InsightCard` is literally `'insights'`. **Phase-3 reconciliation needed:** rich `Pattern` (Insights tab) vs lightweight `TrendInsight` (embedded) — decide whether to unify or keep two tiers.

### 5.4 The cross-system "pattern engine" — the conceptual feeder (most important seam)
Multiple features narrate an off-screen **"pattern engine"** that Insights surfaces, and **reference the same pattern IDs (`P2`/`P3`) by hand in mock copy**:
- **Train** (`data/train.ts`): `volumeRecompute.trigger = 'Heti pattern engine batch'` (`train.ts:57`), framing the MEV/MAV/MRV auto-recompute as driven by the same weekly batch that produces Insights patterns. Volume `source.adjustments` carry `{ kind: 'pattern', label, delta }` entries (pattern-derived volume nudges). The Train tab map even has an `Insights` entry (`label: 'Patterns'`, icon `insights`).
- **Sleep** (`data/sleep.ts:25-33`): insight rows cite `"P2 pattern"` (`evidence: '8/10 nap megerősítve · P2 pattern'`) and `"Pattern P3 megerősítve"` — the **same IDs** as `insights.ts` patterns `p2`/`p3` (Mg-stack→quality, caffeine→onset).
- **Fuel/Week** (`data/fuelWeek.ts:55,151,156`): `"Pattern P2 megerősítve"`, `"Pattern P2 megfigyelve"`, and a reasoning tool `get_pattern_correlation(P2)`.
- **Goals** (`data/goals.ts:50`): a warning insight cites `"Pattern P2 alapján …"`.

**Takeaway:** Insights/Patterns is the *read surface* of a **cross-domain inference layer** that today exists only as coordinated mock copy referencing shared `P2`/`P3` identifiers. Phase 3 makes the engine real; the patterns/IDs must then be **stable, shared identifiers** across Train/Sleep/Fuel/Goals/Insights — build the pattern engine as a shared service, not an Insights-local feature.

### 5.5 Chat ↔ everything (the tool/ref graph)
`ChatMessage.refs` point at cross-domain entities by `kind` (`Workout`, `PR`, `Pattern`, `SleepLog`, `CheckIn`); the fabricated tool calls read across Train/Sleep/biometrics. This sketches the **Phase-3 RAG retrieval surface** (the companion pulls from every domain). `RefTag` (`frontend/src/components/ui/RefTag.tsx`) is the **shared rendering** of these cross-feature references; `ToolChipRow`/`ToolChip` render the tool-transparency row.

### 5.6 Shared design primitives
`Icon`, `Eyebrow`, `PageTitle`, `Toggle`, `RefTag`, `ToolChipRow`/`ToolChip` (UI primitives). **Category palette tokens** `--cat-physiology/-preference/-trigger/-response/-tendency/-goal-state` (`frontend/src/styles/prototype.css:36-41` light, `115-120` dark) — Insights is the only place all six are exercised.

---

## 6. How to use it (consume)

Import the three hooks from the boundary — **never** from `@/data/insights` directly (except the stateless helpers below):

```ts
import { useInsights, useKnowledge, useChat } from '@/data/hooks'

const { patterns, recentlyConfirmed, weekly, weeklySuggestion,
        memoir, anniversaryNote, predictions, experiments } = useInsights()
const { facts, edges, activeCount } = useKnowledge()
const { initialChat } = useChat()
```

Two pure helpers may be imported straight from the data module (stateless constants/utils, not data): `MIN_PATTERN_CONFIDENCE` and `patternCategoryColor` from `@/data/insights`; `factCategoryColor` and `FACT_CATEGORIES` from `@/data/knowledge`.

Today these return **synchronous static data** (safe to read in render with no loading/null guard). **When Phase 3 lands they may become async** — write new consumers defensively now (ghost-guard for null), matching the real-mode convention used by biometrics/Train. To render a full sub-tab, mount the corresponding `views/*View.tsx` under a child route of `/insights` (see `router.tsx:76-87` + `tabs.ts`).

---

## 7. How to extend it

### 7.1 Add a sub-tab or field while still mock-only (cheap)
1. Add/extend the type in `frontend/src/data/types.ts` (Insights/Knowledge region).
2. Add mock instances in `data/insights.ts` (or `knowledge.ts`/`chat.ts`).
3. Surface via the relevant hook in `hooks.ts` — **keep the returned object's shape stable** so the Phase-3 swap stays mechanical.
4. New sub-tab: add to `INSIGHTS_TABS` (`tabs.ts`) + a child route in `router.tsx:78-86` + a view in `views/`.
5. Add a Vitest test mirroring the existing per-view + per-data tests (§8).

### 7.2 Make it real (Phase 3 / Slice D) — the recipe
The boundary is **engineered for this swap**: rewrite `useInsights`/`useKnowledge`/`useChat` to dual-mode on `isMockMode()` exactly like `useWeight` (`weightHooks.ts:11`) / `useSleep` (`hooks.ts:79`) — `initialData: mock ? <static> : undefined`, `queryFn: mock ? async()=>static : insightsApi.list`. Follow, in order, the house standards (do **not** duplicate them here):

- **`docs/references/api_contract_conventions.md`** — contract-first: write `api/feature/insights/insights.yml` (+ `knowledge`, `chat`/`conversation`) **before** code, merge via `api/generate`, regenerate FE types (`frontend/src/lib/api.gen.ts`) + BE `*Api` interfaces.
- **`docs/references/liquibase_conventions.md`** — create `pattern` / `knowledge_fact` / `knowledge_edge` / `ai_conversation` tables; changeset `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`; UUID PKs; seed in Java `@Profile("demodata")` (never SQL).
- **`docs/references/java_package_structure.md` + `spring_patterns.md`** — `feature/insights/{controller,service,repository,entity,dto,mapper}`; constructor DI; method-level `@Transactional`; UUID PKs; `OwnedEntity` + `CurrentUserId` (single-user ownership), soft delete via `@SQLDelete`/`@SQLRestriction`.
- **`docs/references/error_handling.md`**, **`configuration_conventions.md`** (e.g. a `mezo.feature.ai.enabled` flag; promote `MIN_PATTERN_CONFIDENCE` — currently a hard-coded FE constant — to a `@Validated *Properties` value), **`testing_standards.md` / `integration_test_framework.md`** (new tables → add to `ResetDatabase` TRUNCATE list, add populators, write an ownership-isolation test).
- **Phase-3 AI substrate:** Spring AI + pgvector + RAG (`docs/milestones/roadmap.md:13`). `knowledge_fact.active` is the "in system prompt" toggle; `KnowledgeEdge` is the graph the companion traverses; `ai_conversation` backs Chat. The `confidence`/`critique` scores and human-in-the-loop **Confirm/Monitor/Reject** are the pattern-validation pipeline — **persist these** (currently UI-local).

**Hard constraints (both non-negotiable):**
- **Contract-first + dual-mode + both test modes:** every boundary DTO comes from the OpenAPI contract; the hook must keep working in mock mode; ship both `pnpm test` and `VITE_USE_MOCK=true pnpm test` green.
- **Shared pattern IDs:** patterns must become **stable cross-domain identifiers** (Train volume engine, Sleep factors, Fuel-week, Goals all reference `P2`/`P3` by ID today, §5.4). Build the pattern engine as a **shared service**, not Insights-local.
- **Co-design knowledge for two tabs:** any knowledge backend serves Insights/Knowledge **and** Me/Knowledge simultaneously (§5.1).

---

## 8. Testing

All tests are **frontend Vitest** (no backend tests exist). They assert **verbatim Hungarian copy + mock counts + local interactivity** — i.e. they pin the mock as a contract.

- **Data-layer:** `frontend/src/data/insightsData.test.tsx` (3 patterns all ≥ floor; `p1` critique; weekly score / 4 items; memoir title + 3 anchors; `recentlyConfirmed`×3; 4 predictions w/ validated `actual`; active experiment; `patternCategoryColor('response')`). `frontend/src/data/chatData.test.tsx` (3 msgs assistant→user→assistant; tool/ref shapes). *(Knowledge has no dedicated `data/` test.)*
- **Views:** `views/{PatternsView,WeeklyView,MemoirView,KnowledgeListView,ChatView,PredictionsView,ExperimentsView}.test.tsx`, plus `components/PatternCard.test.tsx`.
- **`ChatView.test` gotcha** (documented in-file): `userEvent.type` deadlocks under `vi.useFakeTimers()`; the test uses `fireEvent.change` + `fireEvent.keyDown` and `vi.advanceTimersByTime(1300)` to exercise the 1200 ms canned-reply timer.
- **Nav/shell:** `insights.nav.test.tsx` (lands on Patterns; title tracks the tab; Memoir/Chat navigation), `InsightsSubNav.test.tsx`; plus app-level `src/app/navigation.test.tsx` / `TabBar.test.tsx` assert the Insights tab + `aria-label="Insights alnavigáció"` landmark.

**Commands** (run from `frontend/`):
```bash
pnpm test                         # vitest run (REAL mode default — Insights is static, so identical to mock)
VITE_USE_MOCK=true pnpm test      # mock mode — both must be green
pnpm build                        # tsc -b && vite build
```
When Phase 3 makes the hooks real, add backend ITs (`AbstractIntegrationTest`/`ApiIntegrationTest` + Postgres + populators) and MSW handlers for the real-mode FE path, then keep **both** FE modes green.

---

## 9. Decisions, gotchas & deferred

- **Mock-only, intentionally** — Insights is the Phase-3 brain surface; the FE↔data boundary (`hooks.ts`) is pre-built for a mechanical real-mode swap, matching biometrics/Train.
- **Two roadmap stages, do not conflate:** (a) Phase-2 **Slice D "Insights seed-only"** = tables + seed rows, *no AI* (`design spec:126`; ⏳ `roadmap.md:12`); (b) Phase-3 = the actual AI (Spring AI/pgvector/RAG, `roadmap.md:13`).
- **All interactivity is local/ephemeral:** pattern Confirm/Monitor/Reject, knowledge Toggle, memoir reactions, chat send — none persist. These are the **validation/feedback loops to wire to the backend** in Phase 3.
- **Chat is fully faked:** `setTimeout` + keyword branch on `"fáradt"`; `"Gemini 3.1 Pro"`, `"23 facts active"`, `"L4 aktív"`, `"60-day acc 68%"` are **hard-coded strings**, not derived. The named tool calls are illustrative, not real endpoints.
- **Two overlapping "insight" types:** rich `Pattern` (Insights tab) vs lightweight `TrendInsight` (`InsightCard`, embedded in Goals/Sleep, `types.ts:157-158`). And **two category enums** that overlap but differ: `PatternCategory` (`physiology|trigger|response`) vs `FactCategory` (`physiology|preference|trigger|tendency|goal_state`). Phase 3 must decide whether to unify.
- **`MIN_PATTERN_CONFIDENCE = 0.65`** is a hard-coded FE constant — should become backend config (`configuration_conventions.md`) when the engine is real.
- **`useKnowledge` is shared across Insights + Me tabs** (§5.1) — co-design any knowledge backend for both.
- **Cross-domain pattern IDs** (`P2`/`P3`) are referenced as mock copy in Sleep/Fuel/Train/Goals — making them real requires a shared pattern-engine service with stable IDs (§5.4).
- **Inert affordances:** the settings chip, "Memoir archive →", "+ Új kísérlet javasol Mezo", "Elfogad/Hangoljuk", "Elfogad/Hangoljuk", mic button — all handler-less.

---

## 10. Key files

**Feature (`frontend/src/features/insights/`):**
- `InsightsScreen.tsx` — shell (header + subnav + outlet)
- `InsightsSubNav.tsx` — sticky 7-tab nav (`NavLink`)
- `tabs.ts` — `INSIGHTS_TABS` (id/to/label/end)
- `views/PatternsView.tsx · WeeklyView.tsx · MemoirView.tsx · KnowledgeListView.tsx · ChatView.tsx · PredictionsView.tsx · ExperimentsView.tsx` — the 7 sub-tabs
- `components/PatternCard.tsx` — critique grid + thinking disclosure + confirm/monitor/reject
- `components/ChatMessage.tsx` — chat bubble + tool/ref rows
- Tests: `views/*.test.tsx`, `components/PatternCard.test.tsx`, `InsightsSubNav.test.tsx`, `insights.nav.test.tsx`

**Data layer (`frontend/src/data/`):**
- `insights.ts` — patterns, weekly, memoir, predictions, experiments + `MIN_PATTERN_CONFIDENCE`, `patternCategoryColor`
- `knowledge.ts` — facts, edges, `FACT_CATEGORIES`, `factCategoryColor`
- `chat.ts` — `initialChat`
- `hooks.ts:127-137` — `useKnowledge`, `useInsights`, `useChat` (the boundary / Phase-3 swap point)
- `types.ts:349-418` — all Insights/Knowledge/Chat types
- Tests: `insightsData.test.tsx`, `chatData.test.tsx`

**Cross-feature seams:**
- `frontend/src/app/router.tsx:76-87` — route wiring · `frontend/src/app/TabBar.tsx:10`
- `frontend/src/features/today/components/InsightsTeaser.tsx` — Today→Patterns teaser (mirrors `p1`)
- `frontend/src/features/me/views/KnowledgeView.tsx` + `ProfileView.tsx` — share `useKnowledge`
- `frontend/src/features/me/components/InsightCard.tsx` — `TrendInsight` (lightweight insight, used by Goals/Sleep)
- `frontend/src/data/train.ts:57` · `sleep.ts:25-33` · `fuelWeek.ts:55,151,156` · `goals.ts:50` — "pattern engine" references (shared `P2`/`P3` IDs)
- `frontend/src/components/ui/RefTag.tsx · ToolChip.tsx` — chat tool/ref rendering
- `frontend/src/styles/prototype.css:36-41,115-120` — `--cat-*` tokens

**Docs (link, don't duplicate):**
- `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (Slice D §126; Phase-3 out-of-scope §6)
- `docs/milestones/roadmap.md:12-13` (Slice D remaining; Phase-3 AI brain)
- House standards: `docs/references/{api_contract_conventions,liquibase_conventions,java_package_structure,spring_patterns,error_handling,configuration_conventions,testing_standards,integration_test_framework}.md`

**Confirmed absent (Phase-3 gap):** no `api/feature/insights|knowledge|chat`, no `backend/**` Java for any Insights domain, no Liquibase changeset, no real-mode hook path.
