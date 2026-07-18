---
title: Insights
type: feature-domain
status: mixed
updated: 2026-07-18
tags: [insights, frontend, data-layer]
key_files:
  - frontend/src/features/insights
  - frontend/src/data/insights/insights.ts
  - frontend/src/data/insights/knowledge.ts
  - frontend/src/data/insights/chat.ts
  - frontend/src/data/insights/chatHooks.ts
  - frontend/src/data/insights/weeklyHooks.ts
  - frontend/src/data/hooks.ts
related: [_platform-data-layer, _platform-design-system, today, me, companion]
---

# Insights — Feature Documentation

> One-line: the **pattern/companion "AI brain" surface** — where mezo reflects back what it has *learned* about the user (detected patterns, weekly review, memoir, knowledge base, chat, predictions, experiments). **Status: 🔶 mixed** — **Chat** (companion V0.4), **Patterns** (V3.1), **Knowledge** (V1.2) are ✅ real over the companion backend ([`companion.md`](companion.md)), and **Weekly** is ✅ real since **D′ (`mezo-t16y.1`)** by client-side composition (its „heti tervjavaslat" card now speaks too — the generated prose is live via **proactive W1 `mezo-h4wp.3`**); **Memoir** is ✅ real since **proactive W2 (`mezo-h4wp.4`)** — the tab un-ghosted, rendering the companion's generated weekly memoir (demo reactions/anniversary/archive stay mock-only); **Predictions** is ✅ real since **proactive P1 (`mezo-h4wp.7`)** — the tab un-ghosted, rendering pattern-grounded forecasts with deterministic validation („tanulom" on null confidence, honest accuracy header); and **Experiments** is ✅ real since **proactive P2 (`mezo-h4wp.8`)** — the last tab un-ghosted, rendering companion-proposed N=1 experiments with an L2 accept/dismiss write path + deterministic outcomes. **All seven Insights tabs are now real** (`PHASE3_TAB_IDS` is empty; the proactive epic is complete). **Phase-2 exit audit passed (mezo-t16y.4, 2026-07-05):** the sub-nav hiding + per-page `PhaseTeaserCard` guards re-verified; no fabricated Insights number reaches a live user. Lives under the **`/insights`** tab (4th in `TabBar`, between Fuel and Me).

---

## 1. Summary

Insights is the user-facing window onto mezo's N=1 self-model: it presents the behavioral patterns the (future) AI has inferred, a weekly score review, a literary "memoir," an editable knowledge base of facts, a chat companion, predictions, and self-experiments. Every surface today renders **hand-authored Hungarian mock copy** that *simulates* what the Phase-3 AI will eventually generate.

**Status per layer:**

| Layer | Status | Notes |
|---|---|---|
| FE mock | ✅ done | 7 sub-tabs, all views + tests present |
| FE real-mode | ✅ all 7 tabs (Chat + Patterns + Knowledge + Weekly + Memoir + Predictions + **Experiments**) | **Chat** real since companion V0.4 (`chatHooks.ts` + `chatApi.ts`, SSE — [`companion.md`](companion.md) §5.1); **Patterns** (V3.1) + **Knowledge** (V1.2) real over the companion backend; **Weekly** real since **D′ (`mezo-t16y.1`)** — `data/insights/weeklyHooks.ts` composes the review client-side from existing fuel/train/biometrics reads (no Insights backend); its „heti tervjavaslat" prose is live since **proactive W1 (`mezo-h4wp.3`)** off `GET /api/proactive/weekly-suggestion`; **Memoir** real since **proactive W2 (`mezo-h4wp.4`)** — `data/insights/memoirHooks.ts` reads `GET /api/proactive/memoir` (404→null→honest „készül" state), demo reactions/anniversary/archive mock-only; **Predictions** real since **proactive P1 (`mezo-h4wp.7`)** — `data/insights/predictionsHooks.ts` reads `GET /api/proactive/prediction` (list; `[]`→honest still-learning state, „tanulom" on null confidence); **Experiments** real since **proactive P2 (`mezo-h4wp.8`)** — `data/insights/experimentsHooks.ts` reads `GET /api/proactive/experiment` + `useExperimentActions` writes L2 decisions/propose. **No mock-only Insights tab remains** — all 7 are real (§2). |
| Backend (Java) | 🔶 companion only | `feature/companion` backs the chat (`ai_conversation`/`ai_message`); no `pattern`/`knowledge_fact` backend yet. |

This is **intentional**. Insights is the Phase-3 "AI brain" surface; the single FE↔data boundary (`frontend/src/data/hooks.ts`) is pre-built so the real-mode swap is mechanical, exactly as already proven for biometrics/Train. There are **two distinct roadmap stages** the doc keeps separate:
- **Phase-2 Slice D — "Insights seed-only"**: **DROPPED as superseded (2026-07-04 re-map)** — Phase 3 built the real `pattern`/`knowledge_fact`/`ai_conversation` stack, so seeding was never needed. What remains is **D′** (`mezo-t16y.1`): deterministic Weekly review + honest surface for Memoir/Predictions/Experiments — `docs/superpowers/plans/2026-07-04-phase2-completion-roadmap.md` §D′.
- **Phase 3 — the actual AI**: Spring AI + pgvector + RAG + pattern/companion pipeline (`docs/milestones/roadmap.md:13`).

Driving specs: `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (Slice D §126; Phase-3 out of scope §6) · `docs/milestones/roadmap.md:12-13`.

---

## 2. User-facing behavior

**Route:** `/insights` (`frontend/src/app/TabBar.tsx:10`, icon `insights`). Shell + 7 sub-tabs wired in `frontend/src/app/router.tsx:76-87` from `INSIGHTS_TABS` (`frontend/src/features/insights/pages/tabs.ts`):

| Sub-tab | Route | Pill label (verbatim) | h1 title | View | Real mode |
|---|---|---|---|---|---|
| patterns | `/insights` (index) | `Minták` | `Minták` | `PatternsPage` | shown |
| weekly | `/insights/weekly` | `Heti` | `Heti riport` | `WeeklyPage` | shown |
| memoir | `/insights/memoir` | `Memoár` | `Memoár` | `MemoirPage` | **shown** → real (W2) |
| knowledge | `/insights/knowledge` | `Tudástár` | `Tudástár` | `KnowledgeListPage` | shown |
| chat | `/insights/chat` | `Chat` | `Chat` | `ChatPage` | shown |
| predictions | `/insights/predictions` | `Előrejelzések` | `Előrejelzések` | `PredictionsPage` | **real** (P1) |
| experiments | `/insights/experiments` | `Kísérletek` | `Kísérletek` | `ExperimentsPage` | **real** (P2) |

**Honest surface (mezo-t16y.1 · proactive W2):** the Phase-3+ demo tabs carried only hand-authored demo fiction, so **in real mode the sub-nav hid them** (`visibleInsightsTabs()` in `tabs.ts` filters `PHASE3_TAB_IDS` when `!isMockMode()`; `InsightsSubNav` maps that instead of `INSIGHTS_TABS`). **Memoir left `PHASE3_TAB_IDS` at W2 (`mezo-h4wp.4`), Predictions at P1 (`mezo-h4wp.7`), and Experiments at P2 (`mezo-h4wp.8`)** — the set is now **EMPTY**, so `visibleInsightsTabs()` returns all seven tabs in both modes. No `PhaseTeaserCard` ghost is reachable any more; every tab renders real data or an honest null-state. (The `PhaseTeaserCard` component was **deleted** in the Napív S8 shell migration once it had no reachable consumer — the un-ghost/ghost-guard recipe lives on only in git history.)

The shell `InsightsSection` (`frontend/src/features/insights/pages/InsightsSection.tsx`) renders the Napív `.pghead-np.lav` page-head (over-line `Insights` + `h1` = the active tab's `title`, derived from `pathname.split('/')[2]`), then the sticky `InsightsSubNav` (`aria-label="Insights alnavigáció"`), then an `<Outlet/>` (padding unchanged). **Napív S8 (`mezo-8141`, `mezo-mifi`):** Insights was the last domain still on the legacy `.subnav` idiom — it migrated onto `.np-pills`/`.np-pill` with `--pill-accent: var(--lav)` + `--pill-accent-strong: var(--lav-deep)`, and the whole `.subnav`/`.subnav-item` CSS was retired. The prototype's **decorative, handler-less settings chip was dropped** (dead chrome with no handler, per the S6 PacingCard precedent).

### 2.1 Patterns (`pages/PatternsPage.tsx`) — **real dual-mode since companion V3.1**
Default tab — the pattern-engine Inbox ([`companion.md`](companion.md) §1 V3.1). Reads
`usePatterns()` (`data/insights/patternsHooks.ts`, `['patterns']` dual-read: `{patterns,
recentlyConfirmed, degraded, mode}` — real mode maps `GET /api/companion/pattern`, 404 ⇒ honest
degraded card; mock keeps the `insights.ts` seeds). Filter: rows with a `confidence` gate on
`MIN_PATTERN_CONFIDENCE` (`0.65`); **statistical rows (confidence null) always list** — they
passed the server-side n-gate. Header: `Új minták · {count}` + `min. 65% conf`; empty-state and
empty-confirmed copy. "Recently confirmed · L3" = confirmed rows' titles in real mode.

**`PatternCard`** (`components/PatternCard.tsx`): left accent bar in the category color
(`patternCategoryColor(cat)` → `var(--cat-{cat})`), category chip + `conf NN%` **or „tanulom"**
(null confidence — honest small-n), Antonio display title, mechanism paragraph, a **conditional
4-row "critique grid"** (only when `critique` present — V3.2 hypotheses), evidence string chips
(statistical rows carry `r=… / n=… nap / p=…`), the expandable **"AI gondolatmenete"** disclosure
(`pattern.thinking`). Footer: **Confirm / Monitor / Reject** call `onDecide` →
`usePatternActions().decide(id, decision)` (real: `POST /api/companion/pattern/{id}/decision` +
invalidate — **repeatable transitions**; mock: cache mutation) — the badge renders from the
PERSISTED `pattern.status`, no local decision state.

### 2.2 Weekly (`pages/WeeklyPage.tsx`) — **REAL dual-mode since D′ (`mezo-t16y.1`)**
A big `score` `/100` with a `delta` label, a bordered list of `weekly.items` (label · value · trend arrow `↗/↘/→`), then a "Mezo · heti tervjavaslat" card, and (E3 `mezo-6ng8`) a **"Growth — heti" `GrowthWeekCard`** last. Reads `useWeekly()` (`data/insights/weeklyHooks.ts`, exported via the `hooks.ts` barrel) → `{ weekly:{title,score,delta,items}, deltaLabel, weeklySuggestion, growthWeek, mode }`.
- **Growth-week card (E3):** `<GrowthWeekCard growth={growthWeek} />` (`components/GrowthWeekCard.tsx`) renders the week's **Küldetések** `{completed}/{closed}`, **LIFE XP** `+N`, **Tevékenységek** count, and a **Megtakarítás** `{amount} Ft` row (only when > 0). Empty/zero week (or a null on error) → the honest line *"Még nincs growth-adat ezen a héten."* This is the growth domain's *weekly* Insights surface; the growth domain's dedicated home is the separate **`/me/growth` page** (all-band skills + a 30-day journal + badges/perks, `mezo-rmhr`) — the domain (quests, activity log, savings, adaptive difficulty, flavor copy) lives in [`growth.md`](growth.md).
- **Mock:** byte-parity with the Phase-1 seed — `mockWeekly` + `deltaLabel 'vs hét 20'` + the seed `weeklySuggestion` prose with inert **"Elfogad" / "Hangoljuk"** buttons.
- **Real:** the review is **composed client-side** from the user's own data (no Insights backend — see §3) with a **documented deterministic score** (§4 / the formula in `weeklyHooks.ts:146-154`). `deltaLabel` becomes `'vs előző hét'`; `title` date-derives (`Hét N áttekintés · …`). **Since proactive W1 (`mezo-h4wp.3`) the tervjavaslat card is LIVE:** `weeklySuggestion` fetches the generated plan prose from `GET /api/proactive/weekly-suggestion` (via `weeklySuggestionApi`, `['weeklySuggestion', start]`, `retry:false`); when present the card renders it, and the inert **"Elfogad" / "Hangoljuk"** buttons are **hidden** (`mode !== 'mock'`, `WeeklyPage.tsx:66-71` — false affordance). On the **404** (no prior-week narrative memory yet) `weeklySuggestion` is **null** → the card falls back to the honest placeholder *"A társ heti tervjavaslata hamarosan."* — the D′ null-path is now the **degraded** path, not the default. Details: [`proactive.md` §2/§5.5](proactive.md).
- **Honest null-state:** when no sub-score has data the `score` is **null** and the page renders the patterns-precedent **„tanulom"** placeholder (*"még gyűjtöm az adatokat a heti értékeléshez"*, `WeeklyPage.tsx:27-35`) instead of a fabricated number; `delta` is likewise null when either week's score is missing. The **Súly trend** row is trend-only (goal-ward arrow) and is **excluded from the score**.

### 2.3 Memoir (`pages/MemoirPage.tsx`) — **REAL dual-mode since proactive W2 (`mezo-h4wp.4`)**
The companion's literary weekly narrative. Reads `useMemoir()` (`data/insights/memoirHooks.ts`, exported via the `hooks.ts` barrel) → `{ memoir: Memoir | null; anniversaryNote: string | null; mode }`. The `PhaseTeaserCard` guard is **gone** — the page now renders on real data.
- **The memoir card** (both modes when a memoir exists): `memoir-card` with radial glow, bookmark eyebrow + `Heti memoár · {memoir.week}`, display title, long `body` prose, and an **Anchors** row rendering `RefTag` per `memoir.anchors` (`[kind] label`). Real mode's `memoir.week` is a **client-derived label** `Hét N · …` (from the server `weekStart` via `isoWeekNumber`/`deriveWeekTitle`); the anchors are the code-collected, model-selected `Memory`/`Pattern` refs off `GET /api/proactive/memoir` (owned by the proactive layer — [`proactive.md` §2/§5.6](proactive.md)).
- **Honest null-state (real mode):** on the **404** (no narrative memory in the last completed week) or while loading, `memoir` is **null** → the page renders an honest placeholder card (eyebrow `Heti memoár` + *"Az első memoár a hét zárásakor készül el."*), never demo fiction. Mock always has the seed, so a null memoir only ever occurs in live mode.
- **Mock-only demo extras:** the four reaction toggles (👍 Like / Love / Save / Dismiss, local `Record<ReactionKey, boolean>` — unpersisted), the "Évforduló · 1 hónap" card (`anniversaryNote`), and the static "Memoir archive · 17 darab →" footer all wrap in `mode === 'mock' ? (…) : null` — **hidden in live mode** (unpersisted interactivity / no backend = false affordance; the Weekly „Elfogad/Hangoljuk" precedent). Persisted reactions are a filed follow-up; anniversary + archive are a deferred epic ([`proactive.md` §9 decision o](proactive.md)). Mock render is byte-identical to Phase 1.

### 2.4 Knowledge (`pages/KnowledgeListPage.tsx`) — **real dual-mode since companion V1.2**
The L2 confirm surface of the companion's fact memory ([`companion.md`](companion.md) §4). Two sections:
- **„Jóváhagyásra vár · N"** — pending extraction candidates (`useKnowledge().candidates`) as accented cards with three explicit actions: **Elfogad** / **Pontosít** (inline input reveal → Mentés) / **Elvet** → `useKnowledgeActions().decide(id, decision, refinedText?)` (real: `POST /api/companion/fact/candidate/{id}/decision` + invalidate; mock: cache mutation). Confirm is never silent (IDENT-6).
- **Confirmed facts** — cards with left accent bar (`factCategoryColor`), text, Hungarian category label (`factCategoryLabel`), `×N reinforced`, since V3.3 a **`minta: {title}` evidence chip** on pattern-promoted facts (`patternTitle` on the wire), and a per-fact **`Toggle`** wired to `useKnowledgeActions().toggle(id, active)` (real: `PATCH /api/companion/fact/{id}` `includeInPrompt`; **persists** — the V1.1 prompt injection reads it). Opacity/header counts derive from hook data, no local state.

Real mode renders the honest degraded banner (*"A társ jelenleg nincs bekapcsolva…"*) on the companion switch-off 404. Footer keeps routing to the Me graph view: *"A graph nézethez · Me → Knowledge."* (see §5).

### 2.5 Chat (`pages/ChatPage.tsx`) — ✅ REAL since companion V0.4 (chips real since V0.5)
The companion conversation, **dual-mode** over `useChat()` + `useChatActions()` (from `@/data/hooks`; backend + hook details in [`companion.md`](companion.md) §3/§5.1). Header: "Mezo · társ" + an **honest mode subtitle** (`demo beszélgetés` / `Gemini · élő` / `a társ most nem elérhető`) — the Phase-1 fake "`23 facts active`" string and "L4 aktív" chip are gone. **Real mode:** bootstraps the newest conversation + history, `send()` renders the optimistic user bubble + thinking-dots, then the answer **streams in** (SSE deltas into a draft bubble) and the persisted pair lands in the `['chat']` cache; stream failure → inline error bubble + history refetch; companion switch off (404) → degraded banner (`A társ jelenleg nincs bekapcsolva…`) + disabled composer, no dead-end (IDENT-3). **Mock mode:** the Phase-1 demo — `initialChat` seed + the 1.2s `cannedReply` (branches on `"fáradt"`, fabricated `tools`/`refs`). Composer: mic button (inert), controlled `<input>` (Enter-to-send), send button. **`ChatMessage`** (`components/ChatMessage.tsx`, unchanged): user bubbles right-aligned; assistant bubbles left, preceded by a `ToolChipRow` and followed by a "Hivatkozott · L3" footer of `RefTag`s when `refs` present — **real data since companion V0.5**: tool-using turns arrive with `tools[]` (`{type:'read', name:'get_sleep(days=3)'}` — args baked into the name) and tool-contributed `refs[]` (kinds: `Workout`/`Sport`/`Run`/`WeightTrend`/`Sleep`/`FuelDay`/`Protocol`/`Goal`/`Medication`); chips render when the terminal `done` lands (the in-flight draft bubble stays chip-less). Since
**companion V1.3** an assistant bubble whose answer failed the backend advisor self-check even
after the corrective retry (`MessageResponse.degraded`) carries a subtle `nem ellenőrzött`
eyebrow next to the timestamp (tooltip; [`companion.md`](companion.md) §2) — mock mode never
shows it.

### 2.6 Predictions (`pages/PredictionsPage.tsx`) — **REAL dual-mode since proactive P1 (`mezo-h4wp.7`)**
The tab **un-ghosted at P1**: `usePredictions()` (`data/insights/predictionsHooks.ts`) reads `GET /api/proactive/prediction` (a list; `[]` on loading/error — never a 404) and returns `{predictions, mode}`. Each `Prediction` card renders a status chip (`✓ Validated` / `✗ Missed` / `◐ Pending`), the derived window-label date, the display title, the confidence `bar-fill glow` + `NN%` **only when confidence is present** — otherwise the honest **„tanulom"** chip (a statistical pattern carries no confidence, so most v1 rows read „tanulom", never a fabricated %) — the optional `basis` paragraph, and (once the validation job closed the window) the code-formatted `actual` outcome line. The header's right side is the **accuracy derived from CLOSED rows** (`validated / (validated+missed)`), shown only when at least one has closed. An empty live list renders the honest **still-learning null-state** *"Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul."*. **Mock mode** keeps the Phase-1 seed + the literal `2 validated · 60-day acc 68%` header (byte-parity). Behavior detail in [proactive.md §2](proactive.md).

### 2.7 Experiments (`pages/ExperimentsPage.tsx`) — **REAL dual-mode since proactive P2 (`mezo-h4wp.8`)**
The **last** tab un-ghosts, and it's the first Insights surface with a WRITE. `useExperiments()`
(`data/insights/experimentsHooks.ts`) reads `GET /api/proactive/experiment` (a list; `[]` on
loading/error — never 404), `useExperimentActions()` provides the L2 mutations. Each card renders a
status chip — `◇ Javaslat` (proposed) / `◐ Aktív` (active) / `✓ Megerősítve` / `◯ Nem igazolódott` /
`◌ Nem értékelhető` (completed, by `outcomeGood` true/false/undefined) — a `day/total nap` counter +
progress bar (active/completed only), the title/hypothesis, and the code-formatted `outcome` line.
**Proposed rows** render **Elfogadom / Elvetem** buttons that `POST …/decision` (accept → active,
dismiss → gone); the footer **„+ Új kísérlet javasol Mezo"** button really proposes (`POST …/propose`)
in live mode. An empty live list renders the honest null-state *"Az első N=1 kísérletet a megerősített
mintákból javasolja Mezo."*. **Mock mode** keeps the Phase-1 seed (active + completed cards, the inert
propose CTA — no proposed rows, so no accept/dismiss buttons). Behavior detail in [proactive.md §2](proactive.md).

---

## 3. Architecture & data flow

The Insights data flow is a **degenerate (truncated) version** of mezo's standard `view → hook → mock/real → api → backend → db` pipeline — it stops at the hook:

```
View (PatternsPage, WeeklyPage, …)
  → hook (useInsights / useKnowledge / useChat — frontend/src/data/hooks.ts:11-18)
    → static module import (data/insights/insights.ts, data/insights/knowledge.ts, data/insights/chat.ts)
      → [PHASE-3 GAP: no api client, no apiFetch, no backend, no db]
```

Contrast with a real-mode feature (e.g. `useWeight` in `weightHooks.ts` / `useSleep` in `hooks.ts:79`) which switches on `isMockMode()` between static `initialData` and a real `*Api` call over `apiFetch`. The Insights hooks have **none of that machinery** — no TanStack Query, no `initialData`, no mutation, no mode switch:

- `useInsights()` (`data/insights/insightsHooks.ts`) → `{ patterns, recentlyConfirmed, memoir, anniversaryNote, predictions, experiments }` — direct static re-exports. **Every page has now split out to its own dual-mode hook** (Weekly at D′, Memoir at W2, Predictions at P1, **Experiments at P2** → `useExperiments()`/`useExperimentActions()`). **`useInsights` has NO live consumers left** — `PatternsPage` uses `usePatterns` (V3.1). The `memoir`/`anniversaryNote`/`predictions`/`experiments` fields survive only because the dedicated hooks re-import the seed straight from `insights.ts` for their mock branch; `useInsights` itself is now effectively dead and can be removed in a cleanup pass.
- `useKnowledge()` (`data/insights/knowledgeHooks.ts` since V1.2) → dual-mode `{ facts, candidates, edges, activeCount, degraded, mode }` (`['knowledge']` `useDualQuery`; real fetches `GET /api/companion/fact` + `.../fact/candidate`, `edges` real-mode `[]`; mock = seed). Actions: `useKnowledgeActions()` → `{ toggle, decide, pending }`.

**Exception — Chat swapped at companion V0.4:** `useChat()` + `useChatActions()` moved to
`data/insights/chatHooks.ts` (re-exported from the `hooks.ts` barrel) and are **real dual-mode**
— `useChat` is a `useDualQuery` bootstrap (`{conversationId, messages, degraded, mode}`; mock =
`initialChat` seed, real = newest conversation + history via `chatApi`, 404 → degraded ghost),
`useChatActions` is the send/stream state machine over the SSE client (`chatApi.streamMessage`,
`apiSse` in `data/_client/api.ts`). Details: [`companion.md`](companion.md) §5.1.

**Exception — Weekly is REAL by CLIENT-SIDE COMPOSITION (D′, `mezo-t16y.1`):** `useWeekly()` (`data/insights/weeklyHooks.ts`, re-exported from the barrel) needs **no Insights backend** — real mode composes the review from reads the other features already expose, so the pipeline fans OUT instead of stopping at a single api client:

```
WeeklyPage → useWeekly()  (data/insights/weeklyHooks.ts)
  MOCK: { mockWeekly, deltaLabel 'vs hét 20', mockWeeklySuggestion }   (byte-parity seed)
  REAL: deterministic composition over the user's own reads —
    ├─ ['fuelWeek', start] ×2 weeks  → mealApi.getWeek(start)   (F-P4 aggregate GET /api/fuel/week/{start})
    ├─ ['insightsWeekly','workouts', start] ×2 → trainApi.listWorkouts(start, weekEnd)   (GET /api/train/workouts?from&to — completed workouts = "done" since mezo-cd8s)
    ├─ ['insightsWeekly','sportSessions'|'gymSchedule'|'sportSchedule'] → trainApi.*   (sessions "done" + schedules "planned")
    ├─ useSleep().sleepLog        (client-filtered per week via inWeek())
    ├─ useWeight().weightTrends   (EWMA last7d.weeklyRate — trend-only row)
    ├─ ['weeklySuggestion', start] → weeklySuggestionApi.get   (W1: GET /api/proactive/weekly-suggestion; 404→null)
    └─ ['insightsWeekly','growth', start] → growthWeekApi.get   (E3: GET /api/progression/growth-week/{start}; .catch→null)
      → deriveWeekMetrics() ×2 → deriveItems() + deriveScore()  (pure fns, weeklyHooks.ts:65-154)
```

The composition uses the `useRealQuery` idiom (the `fuelWeekHooks` pattern): mock resolves `null`, real fetches. Fuel rollups **share the F-P4 cache key** (`['fuelWeek', start]`); the raw train reads sit under an **own `['insightsWeekly',…]` namespace** so they don't collide with `trainHooks`' keys (which cache MAPPED domain shapes). The **`['weeklySuggestion', start]`** query (W1, proactive) and the **`['insightsWeekly','growth', start]`** query (E3, a Progression-backend read — the second backend-served field of `WeeklyView`, after W1's suggestion) are **bare `useQuery`** — `enabled: !mock`, `retry: false`, `weeklySuggestion` 404→null / `growthWeek` `.catch(()=>null)` — the rest are `useRealQuery`. **Known simplification:** `trainPlanned` uses the CURRENT gym+sport schedules for BOTH the current and previous week (no historical schedule read) — the schedule is treated as stable week-to-week (`weeklyHooks.ts:211`).

**Exception — Memoir is REAL by a PROACTIVE BACKEND READ (W2, `mezo-h4wp.4`):** `useMemoir()` (`data/insights/memoirHooks.ts`, re-exported from the barrel) is a dual-mode `['memoir']` `useQuery` (`retry: false`): mock returns the `insights.ts` seed + `anniversaryNote` synchronously (`initialData`, `staleTime: Infinity`, no fetch), real fetches `GET /api/proactive/memoir` via `memoirApi.latest` (`memoirApi.ts`, `toMemoir` wire→FE `Memoir` with the client-derived `Hét N …` label), 404→null. Returns `{ memoir: Memoir | null; anniversaryNote: string | null; mode }` — the note is always null in live mode. Unlike Weekly (composed client-side) the memoir is a single proactive-owned backend read; the endpoint + generator live in [`proactive.md`](proactive.md).

The remaining mock "interactivity" (pattern Confirm/Monitor/Reject, memoir reactions) lives in **component-local `useState`** and evaporates on unmount (in live mode the memoir reactions are hidden, not just ephemeral); the knowledge Toggle + candidate decisions are REAL since V1.2. The single FE↔data boundary (`hooks.ts`) is intact — chat (V0.4), knowledge (V1.2), patterns (V3.1), **weekly (D′)**, **memoir (W2)**, **predictions (P1)** and **experiments (P2, incl. the L2 write mutations)** all proved the swap; **no Insights tab is mock-only any more**.

---

## 4. Data model & API

> **No Insights-owned backend, contract, or DB.** Everything below is the **mock data shape** (the contract the views and tests pin). All types live in `frontend/src/data/types.ts:349-418` ("--- Tudás (knowledge) ---" + "--- Insights (AI-memory surface) ---"). Instances in `data/insights/insights.ts` / `data/insights/knowledge.ts` / `data/insights/chat.ts`. **Exception — Weekly (D′):** real mode is composed client-side over OTHER features' contracts (Fuel week, Train workouts/sport/schedules, biometrics) — no Insights endpoint; the one contract change D′ required is the new Train `listWorkouts` op (see below + `train.md` §4).

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

**Memoir** (`types.ts:375-381`): `MemoirAnchor { kind; label }`, `Memoir { week; title; body; anchors }` — single `memoir` + `anniversaryNote` string. **Real mode (W2)** maps the same `Memoir` shape from the proactive `GET /api/proactive/memoir` (`MemoirResponse {weekStart, title, body, anchors[], generatedAt}` → `toMemoir`, the `week` label derived client-side); the FE type is reused **unchanged**, `anniversaryNote` stays a mock-only seed. Owned by the proactive layer, not Insights ([`proactive.md` §4](proactive.md); `api/feature/proactive/proactive.yml`).

**Weekly** (`types.ts:406-408`): `WeeklyTrend = 'up'|'down'|'flat'`, `WeeklyItem { label; value; trend }`, `WeeklyReview { title; score; delta; items }` — mock `weekly` + `weeklySuggestion` seed. **Real mode (D′)** builds the same shape client-side in `useWeekly` (`weeklyHooks.ts`), returning `WeeklyView { weekly; deltaLabel; weeklySuggestion: string|null; growthWeek: WeeklyGrowth|null; mode }`. Two of its fields come from real backend reads (the rest stays client-composed): **`weeklySuggestion`** (W1 — the proactive `GET /api/proactive/weekly-suggestion` → `prose`, 404→null) and **`growthWeek`** (E3 `mezo-6ng8` — the Progression `GET /api/progression/growth-week/{start}`, `.catch(()=>null)`).

**WeeklyGrowth** (E3, `types.ts`): `WeeklyGrowth { weekStart; questCompleted; questClosed; lifeXp; activities; savingsHuf }` — mirrors the backend `GrowthWeekResponse` (owned by the **Progression** domain, [`growth.md` §4](growth.md)); mock seed `growthWeek` in `insights.ts`, MSW defaults to honest zeros (never 404). This is the first WeeklyView field fed by the Progression backend rather than proactive/Fuel/Train.

**Weekly score — the documented deterministic formula (D′, `weeklyHooks.ts:146-154`):** `score = round(100 × mean(available sub-scores))`, equal weights, only sub-scores with data participate; **no data → null → the „tanulom" null-state** (never a fabricated number). Sub-scores: **kcal** closeness-to-target inside a ±`KCAL_BAND` linear band · **protein** hit-days/7 · **sleep** avg/`SLEEP_TARGET_H` (capped) · **train** done/planned (capped, skipped when planned=0). **Weight is EXCLUDED from the score** — it is a trend-only row whose arrow maps goal-ward (`weightTrendOf`: losing = good = `up`, single-user cut) off the EWMA `weeklyRate`, gated by `WEIGHT_RATE_EPSILON`. Constants are **exported FE `const`s** — `SLEEP_TARGET_H=8`, `KCAL_BAND=0.25`, `WEIGHT_RATE_EPSILON=0.1` (`weeklyHooks.ts:22-24`); **promote to backend config with the proactive epic** (`configuration_conventions.md`), same trajectory as `MIN_PATTERN_CONFIDENCE`. "Done" = the same semantics as Train's `weekDoneDates` — **explicitly completed workouts** (`status='completed'`) since `mezo-cd8s`, no longer the old ≥1-logged-set count (a started-but-unclosed gym session no longer counts toward the weekly train sub-score); trend arrows compare the current vs previous week (`trendOf`, epsilon-tied → honest `flat`).

**Predictions** (`types.ts`): `PredictionStatus = 'pending'|'validated'|'missed'`, `Prediction { id; title; confidence: number | null; status; date; basis?; actual? }` — **`confidence` went nullable + the `missed` status at P1** (honest-state additions); real data comes from `GET /api/proactive/prediction` (`predictionsApi`/`predictionsHooks`), the mock seed stays in `insights.ts`.

**Experiments** (`types.ts`): `ExperimentStatus = 'proposed'|'active'|'completed'|'dismissed'`, `Experiment { id; title; status; day; total; hypothesis; outcome?; outcomeGood? }` — **`proposed`/`dismissed` added at P2**; real data comes from `GET /api/proactive/experiment` (`experimentsApi`/`experimentsHooks`), the mock seed stays in `insights.ts`. The `day` counter derives client-side from the wire `startDate`/`totalDays`.

**Chat** (`types.ts:410-418`): `ChatRole = 'user'|'assistant'`, `ChatRef { kind; id }`, `ChatMessage { role; ts; text; tools?: Tool[]; refs?: ChatRef[] }`. `Tool` is imported from `@/shared/ui/ToolChip` (`{ type: ToolType; name; args? }`, `ToolType = 'read'|'compute'|'write'`). `initialChat` = 3 messages (assistant → user → assistant).

**Endpoints / contract:** the **chat is contract-backed since companion V0.2/V0.4, tool-chips real since V0.5, knowledge facts + candidates since V1.1/V1.2** — `api/feature/companion/companion.yml` (conversations, messages, sync + SSE stream turn, fact CRUD, candidate inbox + decision; see [`companion.md`](companion.md) §4). The FE `FactCategory` is the backend enum (`train|fuel|health|life`) since V1.2. Patterns still have **no dedicated Insights contract** (served by the companion `pattern` endpoints). **Weekly's** deterministic review (D′) owns no endpoint — it composes over existing contracts, and the only new op it required is Train's **`GET /api/train/workouts?from&to`** → `WorkoutSummaryResponse {id, date, status}[]` (inclusive range, date-asc; **completed instances** (`status='completed'`) = "done", the same semantics as `weekDoneDates` since `mezo-cd8s` — was ≥1-non-skipped-set; `from>to` → 400 `TRAIN_INVALID_DATE_RANGE`) — documented in full in [`train.md`](train.md) §4 + `api/feature/train/train.yml`. **Its two backend-served fields** are `weeklySuggestion` (W1) and `growthWeek` (E3). **`weeklySuggestion`** — the proactive **`GET /api/proactive/weekly-suggestion?date=`** → `WeeklySuggestionResponse {weekStart, prose, generatedAt}` (lazy-generated smart-tier prose; **404** when the prior week has no `daily_summary`, which the FE reads as the honest placeholder), owned by the proactive layer ([`proactive.md` §4](proactive.md); `api/feature/proactive/proactive.yml`). **`growthWeek`** — the Progression **`GET /api/progression/growth-week/{date}`** → `GrowthWeekResponse {weekStart, questCompleted, questClosed, lifeXp, activities, savingsHuf}` (aggregates the ISO week; **honest zeros, never 404**), owned by the Progression/growth domain ([`growth.md` §4](growth.md); `api/feature/progression/progression.yml`) — the FE client is `data/insights/growthWeekApi.ts`. Both are single backend reads composed into the otherwise client-side Weekly. Real turns now carry the V0.5 read-tool calls (`get_recent_workouts`, `get_sport_sessions`, `get_weight_trend`, `get_recent_meals`, `get_sleep`, `get_protocol_adherence`, `get_goal_progress`, `get_reta_cycle` — [`companion.md`](companion.md) §4 catalog); only the MOCK seed's fancier names (`predictAppetiteCurve()`, `recallSharedMemory(theme=…)`) remain demo theater. **Where the rest of the backend plugs in:** rewrite `useInsights`/`useKnowledge` in `data/insights/insightsHooks.ts` (re-exported by the `hooks.ts` barrel) to dual-mode on `isMockMode()` — the chat swap (`chatHooks.ts`) is the worked example — see §7.

---

## 5. Integrations

Insights is the **hub the other tabs point *toward*** and is itself **fed conceptually by a cross-system "pattern engine."** Today these are **mock-level cross-references** (shared copy / shared data module), not live data flows — but they define the contracts Phase 3 must honor.

### 5.1 `useKnowledge` is shared by THREE views across TWO features — co-design any backend
`useKnowledge()` (`hooks.ts:127`) backs the Insights `KnowledgeListPage` **and** the Me-tab `KnowledgePage` (`frontend/src/features/me/pages/KnowledgePage.tsx:20`) **and** `ProfilePage` (`frontend/src/features/me/pages/ProfilePage.tsx:18`). Responsibility splits:
- **Insights/Knowledge** = flat editable list with prompt-active toggles (consumes `facts`).
- **Me/Knowledge** = the "Knowledge graph" / "Élő mindmap" view (consumes `facts` **and** `edges` + `activeCount`; the graph render itself "deferred to Slice 4", `KnowledgePage.tsx:62`; the placeholder reads "Gráf nézet · hamarosan (Slice 4)", `:74`).
- The Insights footer literally routes across: *"A graph nézethez · Me → Knowledge."* (`KnowledgeListPage.tsx`).

**Crossing type:** `KnowledgeFact[]` + `KnowledgeEdge[]`. Since V1.2 the backend IS live and serves both tabs through the same `useKnowledge()`: Insights/Knowledge consumes the real facts + candidates; Me/Knowledge keeps rendering the seed in mock mode and gets an honest `edges: []` in real mode (the graph/edges layer has no backend yet — a future slice).

### 5.2 Today → Insights (nav entry, no live teaser)
The `InsightsTeaser.tsx` Today-tab card (a real-mode `usePatterns()` teaser, per Today's `useInsightsTeaser` hook) was **removed** by the Napív S3 Today re-composition (`mezo-8141`, 2026-07-13 — spec §4.2: the Insights entry point is the ✨ icon, nothing else). Today's only remaining path into this tab is that plain `<Link to="/insights" aria-label="Insights">` — navigation only, no pattern preview. It originally lived in the now-deleted `BrandRow.tsx`; since the gamified-header slice (`mezo-k7rn`, 2026-07-18) it's one of the `utilities` Today passes into the shared `AppHero` header (see [today.md §2](today.md)) — same ✨ affordance, different carrier component. The orphaned `useInsightsTeaser` hook (+ `InsightsTeaserItem` type and its `data/hooks.ts` re-export) was DELETED in S8 (`mezo-mifi`) — see [today.md §9](today.md).

### 5.3 Me-tab `InsightCard` + `TrendInsight` — a parallel, lighter "insight" type
`frontend/src/features/me/components/InsightCard.tsx` renders a **different** type: `TrendInsight { type: 'milestone'|'pattern'|'warning'; text }` (`types.ts:157-158`). `TrendInsight[]` arrays are embedded in **Goals** (`data/me/goals.ts`, `insights` field on the goal aggregate, `types.ts:186,218`) and **Sleep**. So the *insight concept leaks into Me/Goals/Sleep* via a lighter inline type. The `pattern` icon in `InsightCard` is literally `'insights'`. **Phase-3 reconciliation needed:** rich `Pattern` (Insights tab) vs lightweight `TrendInsight` (embedded) — decide whether to unify or keep two tiers.

### 5.4 The cross-system "pattern engine" — the conceptual feeder (most important seam)
Multiple features narrate an off-screen **"pattern engine"** that Insights surfaces, and **reference the same pattern IDs (`P2`/`P3`) by hand in mock copy**:
- **Train** (`data/train/train.ts`): `volumeRecompute.trigger = 'Heti pattern engine batch'` (`train.ts:57`), framing the MEV/MAV/MRV auto-recompute as driven by the same weekly batch that produces Insights patterns. Volume `source.adjustments` carry `{ kind: 'pattern', label, delta }` entries (pattern-derived volume nudges). The Train tab map even has an `Insights` entry (`label: 'Patterns'`, icon `insights`).
- **Sleep** (`data/me/sleep.ts:25-33`): insight rows cite `"P2 pattern"` (`evidence: '8/10 nap megerősítve · P2 pattern'`) and `"Pattern P3 megerősítve"` — the **same IDs** as `insights.ts` patterns `p2`/`p3` (Mg-stack→quality, caffeine→onset).
- **Fuel/Week** (`data/fuel/fuelWeek.ts:55,151,156`): `"Pattern P2 megerősítve"`, `"Pattern P2 megfigyelve"`, and a reasoning tool `get_pattern_correlation(P2)`.
- **Goals** (`data/me/goals.ts:50`): a warning insight cites `"Pattern P2 alapján …"`.

**Takeaway:** Insights/Patterns is the *read surface* of a **cross-domain inference layer** that today exists only as coordinated mock copy referencing shared `P2`/`P3` identifiers. Phase 3 makes the engine real; the patterns/IDs must then be **stable, shared identifiers** across Train/Sleep/Fuel/Goals/Insights — build the pattern engine as a shared service, not an Insights-local feature.

### 5.5 Chat ↔ everything (the tool/ref graph)
`ChatMessage.refs` point at cross-domain entities by `kind` (`Workout`, `PR`, `Pattern`, `SleepLog`, `CheckIn`); the fabricated tool calls read across Train/Sleep/biometrics. This sketches the **Phase-3 RAG retrieval surface** (the companion pulls from every domain). `RefTag` (`frontend/src/shared/ui/RefTag.tsx`) is the **shared rendering** of these cross-feature references; `ToolChipRow`/`ToolChip` render the tool-transparency row.

### 5.6 Shared design primitives
`Icon`, `Eyebrow`, `PageTitle`, `Toggle`, `RefTag`, `ToolChipRow`/`ToolChip` (UI primitives). **Category palette tokens** `--cat-physiology/-preference/-trigger/-response/-tendency/-goal-state` — **since S8 (`mezo-mifi`) these are `var()` aliases re-pointed 1:1 onto the Napív domain accents** (`prototype.css:42–47`: physiology→sky, preference→lav-deep, trigger→amber-deep, response→sage-deep, tendency→rose, goal-state→coral-deep), so `PatternCard`'s `patternCategoryColor(cat)` now renders in-family Napív hues. There is **no separate `--cat-*` dark block any more** — each alias inherits its Napív accent's own light/dark value (see the §3 token cascade in [_platform-design-system.md](_platform-design-system.md)). Insights is the only place all six are exercised. Since the **Napív vocabulary retirement** (`mezo-x3x0`, 2026-07-16) the inline `--ff-mono` numeric readouts across `ChatMessage`/`ChatPage`/`WeeklyPage`/`KnowledgeListPage` inherit Jakarta with `font-variant-numeric: tabular-nums` instead — mono now survives only on the `.toolchip` debug/tool chips (which is what `RefTag`/`ToolChip` render).

---

## 6. How to use it (consume)

Import the three hooks from the boundary — **never** from `@/data/insights/insights` directly (except the stateless helpers below):

```ts
import { useInsights, useKnowledge, useChat, useWeekly, useMemoir } from '@/data/hooks'

const { patterns, recentlyConfirmed, predictions, experiments } = useInsights()  // memoir/anniversaryNote fields dead since W2
const { facts, edges, activeCount } = useKnowledge()
const { initialChat } = useChat()

// Weekly (D′) — dual-mode; score/delta may be null (render the „tanulom" null-state),
// weeklySuggestion is null in real mode (render the honest placeholder).
const { weekly, deltaLabel, weeklySuggestion } = useWeekly()

// Memoir (W2) — dual-mode; memoir is null in real mode on 404 (render the honest „készül" state),
// anniversaryNote is mock-only (always null in live mode).
const { memoir, anniversaryNote, mode } = useMemoir()
```

Two pure helpers may be imported straight from the data module (stateless constants/utils, not data): `MIN_PATTERN_CONFIDENCE` and `patternCategoryColor` from `@/data/insights/insights`; `factCategoryColor` and `FACT_CATEGORIES` from `@/data/insights/knowledge`.

Today these return **synchronous static data** (safe to read in render with no loading/null guard). **When Phase 3 lands they may become async** — write new consumers defensively now (ghost-guard for null), matching the real-mode convention used by biometrics/Train. To render a full sub-tab, mount the corresponding `pages/*View.tsx` under a child route of `/insights` (see `router.tsx:76-87` + `tabs.ts`).

---

## 7. How to extend it

### 7.1 Add a sub-tab or field while still mock-only (cheap)
1. Add/extend the type in `frontend/src/data/types.ts` (Insights/Knowledge region).
2. Add mock instances in `data/insights/insights.ts` (or `knowledge.ts`/`chat.ts`).
3. Surface via the relevant hook in `hooks.ts` — **keep the returned object's shape stable** so the Phase-3 swap stays mechanical.
4. New sub-tab: add to `INSIGHTS_TABS` (`tabs.ts`) + a child route in `router.tsx:78-86` + a view in `pages/`.
5. Add a Vitest test mirroring the existing per-view + per-data tests (§8).

### 7.2 Make it real (Phase 3 / Slice D) — the recipe
The boundary is **engineered for this swap**: rewrite `useInsights`/`useKnowledge`/`useChat` to dual-mode on `isMockMode()` exactly like `useWeight` (`weightHooks.ts:11`) / `useSleep` (`hooks.ts:79`) — `initialData: mock ? <static> : undefined`, `queryFn: mock ? async()=>static : insightsApi.list`. Follow, in order, the house standards (do **not** duplicate them here):

- **`docs/references/api_contract_conventions.md`** — contract-first: write `api/feature/insights/insights.yml` (+ `knowledge`, `chat`/`conversation`) **before** code, merge via `api/generate`, regenerate FE types (`frontend/src/data/_client/api.gen.ts`) + BE `*Api` interfaces.
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

- **Data-layer:** `frontend/src/data/insights/insightsData.test.tsx` (3 patterns all ≥ floor; `p1` critique; weekly score / 4 items; memoir title + 3 anchors; `recentlyConfirmed`×3; 4 predictions w/ validated `actual`; active experiment; `patternCategoryColor('response')`). `frontend/src/data/insights/chatData.test.tsx` (3 msgs assistant→user→assistant; tool/ref shapes). *(Knowledge has no dedicated `data/` test.)*
- **Views:** `pages/{PatternsPage,WeeklyPage,MemoirPage,KnowledgeListPage,ChatPage,PredictionsPage,ExperimentsPage}.test.tsx`, plus `components/PatternCard.test.tsx`. `WeeklyPage.test.tsx` has real-mode describes for the „tanulom" null-state and, since **W1**, a case asserting the live suggestion prose renders **without** the inert „Elfogad/Hangoljuk" buttons. `MemoirPage.test.tsx` gained a **`(real mode)` describe** (since **W2**): with an MSW memoir fixture it renders the real title/body/anchors and does NOT render reactions/anniversary/archive; on the default 404 it renders the honest „készül" placeholder, not the demo fiction — the `(mock mode)` describe is unchanged.
- **Weekly hook (dual-mode):** `data/insights/weeklyHooks.test.tsx` — real-mode composition/null-state cases + (W1) `weeklySuggestion` served from the GET / kept null on the default 404 (MSW `/api/proactive/weekly-suggestion` defaults to 404) + (E3) `growthWeek` from the MSW default honest-zeros. Card: `components/GrowthWeekCard.test.tsx` (E3 — renders the rows on data, the honest empty line on a zero/null week).
- **Memoir hook (dual-mode, W2):** `data/insights/memoirHooks.test.tsx` (3) — real mode maps the server memoir with a derived `Hét N …` week label (anniversaryNote null, mode live); returns null memoir on the default 404; mock returns the seed + anniversaryNote without fetching (MSW `/api/proactive/memoir` defaults to 404).
- **`ChatPage.test` gotcha** (documented in-file): `userEvent.type` deadlocks under `vi.useFakeTimers()`; the test uses `fireEvent.change` + `fireEvent.keyDown` and `vi.advanceTimersByTime(1300)` to exercise the 1200 ms canned-reply timer.
- **Nav/shell:** `insights.nav.test.tsx` (real: lands on `Minták`, `Heti`/`Memoár`/`Előrejelzések`/**`Kísérletek`** links all work → their null-states; mock: `Memoár` navigation renders the demo), `InsightsSubNav.test.tsx` (**both describes = all 7 `.np-pill`s since P2 — nothing hidden**); plus app-level `src/app/navigation.test.tsx` / `TabBar.test.tsx` assert the Insights tab + `aria-label="Insights alnavigáció"` landmark.
- **No ghost pages remain (since P2):** every page test now has a `(mock mode)` + `(real mode)` describe asserting real data / the honest null-state — no test asserts a `hamarosan` teaser any more. `ExperimentsPage.test.tsx` real-mode: an MSW proposed row renders `◇ Javaslat` + Elfogadom/Elvetem and clicking Elfogadom POSTs the decision; the default empty array shows the still-learning null-state. `experimentsHooks.test.tsx` mirrors the P1 `predictionsHooks.test.tsx` idiom (maps a wire row, `[]` default, mock no-fetch). Mode is set per-describe with `vi.stubEnv('VITE_USE_MOCK', …)`.

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
- **Two roadmap stages, do not conflate:** (a) Phase-2 Insights work is now **D′** (deterministic Weekly + honest surface, `mezo-t16y.1` — the old seed-only Slice D was dropped as superseded on 2026-07-04); (b) Phase-3 = the actual AI (Spring AI/pgvector/RAG) — ✅ shipped (`mezo-fnnq`, see `companion.md`).
- **All interactivity is local/ephemeral:** pattern Confirm/Monitor/Reject, knowledge Toggle, memoir reactions, chat send — none persist. Knowledge Toggle + candidate decisions + pattern decisions are REAL since V1.2/V3.1; **memoir reactions are now hidden entirely in live mode (W2)** rather than shown-but-ephemeral (false affordance). The rest are the **validation/feedback loops to wire to the backend**.
- **Chat is fully faked:** `setTimeout` + keyword branch on `"fáradt"`; `"Gemini 3.1 Pro"`, `"23 facts active"`, `"L4 aktív"`, `"60-day acc 68%"` are **hard-coded strings**, not derived. The named tool calls are illustrative, not real endpoints.
- **Two overlapping "insight" types:** rich `Pattern` (Insights tab) vs lightweight `TrendInsight` (`InsightCard`, embedded in Goals/Sleep, `types.ts:157-158`). And **two category enums** that overlap but differ: `PatternCategory` (`physiology|trigger|response`) vs `FactCategory` (`physiology|preference|trigger|tendency|goal_state`). Phase 3 must decide whether to unify.
- **`MIN_PATTERN_CONFIDENCE = 0.65`** is a hard-coded FE constant — should become backend config (`configuration_conventions.md`) when the engine is real.
- **Weekly's REVIEW is real by CLIENT-SIDE composition, its SUGGESTION by the proactive backend (D′ `mezo-t16y.1` + W1 `mezo-h4wp.3`):** `useWeekly` composes the review (score + items) from existing fuel/train/biometrics reads — cheaper than an Insights backend and honest (real numbers or the „tanulom" null-state, never fabricated). The **score formula is deterministic + documented** (§4); its constants (`SLEEP_TARGET_H`/`KCAL_BAND`/`WEIGHT_RATE_EPSILON`) are FE `const`s to **promote to backend config** — same trajectory as `MIN_PATTERN_CONFIDENCE`. **W1 did NOT promote them** (kept them FE consts to stay in scope; a small follow-up bd issue owns the promotion — the proactive epic files it). **Known simplification:** both weeks use the CURRENT schedules for `trainPlanned` (no historical schedule read, §3). **`weeklySuggestion` is now LIVE in real mode (W1)** — the generated plan prose from `GET /api/proactive/weekly-suggestion` (404→null→the honest placeholder); it is no longer the honest-null-only path. The review composition still adds only one Train op (`listWorkouts`, §4) and no Insights endpoint/table; the suggestion endpoint is proactive-owned ([`proactive.md`](proactive.md)).
- **`useKnowledge` is shared across Insights + Me tabs** (§5.1) — co-design any knowledge backend for both.
- **Cross-domain pattern IDs** (`P2`/`P3`) are referenced as mock copy in Sleep/Fuel/Train/Goals — making them real requires a shared pattern-engine service with stable IDs (§5.4).
- **Inert affordances:** "+ Új kísérlet javasol Mezo", the Weekly "Elfogad/Hangoljuk" pair and the **Memoir reactions + "Memoir archive →" footer + anniversary card** (all still handler-less/unpersisted — but since **W1/W2** they are **hidden in live mode** `mode !== 'mock'`, shown only over the mock seed; false-affordance rule), mic button — all handler-less.
- **Honest surface (mezo-t16y.1 · W2 · P1 · P2 — now COMPLETE):** the Phase-3+ demo tabs were hidden from the sub-nav (`visibleInsightsTabs()` filtering `PHASE3_TAB_IDS`) until each got real data — Memoir at W2, Predictions at P1, **Experiments at P2**. `PHASE3_TAB_IDS` is now **empty**: no tab is hidden, no `PhaseTeaserCard` ghost is reachable, every tab renders real data or an honest null-state. The un-ghost recipe (drop the `PHASE3_TAB_IDS` entry, remove the page guard, render real + honest null-state, keep unpersisted extras mock-only) is preserved in the git history of the four un-ghost commits should a future Phase-gated tab need it.

---

## 10. Key files

**Feature (`frontend/src/features/insights/`):**
- `InsightsSection.tsx` — shell (`.pghead-np.lav` head + `.np-pills` sub-nav + outlet)
- `InsightsSubNav.tsx` — sticky `.np-pills` nav (`NavLink` → `.np-pill.on`, lav accent), maps `visibleInsightsTabs()` (all 7 in both modes)
- `tabs.ts` — `INSIGHTS_TABS` (id/to/label/**title**/end) + `visibleInsightsTabs()` (`PHASE3_TAB_IDS` now **EMPTY** — memoir left at W2, predictions at P1, experiments at P2; all 7 tabs visible in both modes)
- `pages/PatternsPage.tsx · WeeklyPage.tsx · MemoirPage.tsx · KnowledgeListPage.tsx · ChatPage.tsx · PredictionsPage.tsx · ExperimentsPage.tsx` — the 7 sub-tabs, **all real dual-mode** (Memoir W2, Predictions P1, Experiments P2 — each with an honest null-state; ExperimentsPage adds the L2 accept/dismiss + propose write actions)
- `data/insights/experimentsApi.ts` + `experimentsHooks.ts` — **P2** the Experiments consumer (`useExperiments()` → `GET /api/proactive/experiment`; `useExperimentActions()` → the decision/propose mutations)
- `data/insights/predictionsApi.ts` + `predictionsHooks.ts` — **P1** the Predictions consumer (`usePredictions()` → `GET /api/proactive/prediction`, list; `[]`→still-learning null-state)
- `components/PatternCard.tsx` — critique grid + thinking disclosure + confirm/monitor/reject
- `components/GrowthWeekCard.tsx` — **E3** the Weekly "Growth — heti" card (quests/LIFE XP/activities/savings + honest empty line); growth domain in [`growth.md`](growth.md)
- `components/ChatMessage.tsx` — chat bubble + tool/ref rows
- **`components/PhaseTeaserCard.tsx` — DELETED in the Napív S8 shell migration (`mezo-mifi`):** with `PHASE3_TAB_IDS` empty no tab is Phase-gated, so the ghost had no reachable consumer; the component is gone and the un-ghost/ghost-guard recipe survives only in git history (§2).
- Tests: `pages/*.test.tsx`, `components/PatternCard.test.tsx`, `InsightsSubNav.test.tsx`, `insights.nav.test.tsx`

**Data layer (`frontend/src/data/`):**
- `insights.ts` — patterns, weekly (seed), memoir, predictions, experiments, **growthWeek (E3 seed)** + `MIN_PATTERN_CONFIDENCE`, `patternCategoryColor`
- `knowledge.ts` — facts, edges, `FACT_CATEGORIES`, `factCategoryColor`
- `chat.ts` — `initialChat`
- `weeklyHooks.ts` — **`useWeekly` (D′ + W1 + E3)**: dual-mode client-side composition + the pure rollup fns (`deriveWeekMetrics`/`deriveItems`/`deriveScore`/`trendOf`) + score constants (`SLEEP_TARGET_H`/`KCAL_BAND`/`WEIGHT_RATE_EPSILON`); the `weeklySuggestion` real branch fetches the proactive GET (W1), the `growthWeek` real branch the Progression GET (E3)
- `weeklySuggestionApi.ts` — **W1** `weeklySuggestionApi.get(date)` → proactive `GET /api/proactive/weekly-suggestion` (wire → `prose` string, 404→null)
- `growthWeekApi.ts` — **E3** `growthWeekApi.get(date)` → Progression `GET /api/progression/growth-week/{date}` (wire → `WeeklyGrowth`; caller `.catch(()=>null)`)
- `memoirHooks.ts` — **`useMemoir` (W2)**: dual-mode `['memoir']` read (mock seed no-fetch / real `GET /api/proactive/memoir`, 404→null); returns `{ memoir, anniversaryNote, mode }`
- `memoirApi.ts` — **W2** `memoirApi.latest()` → proactive `GET /api/proactive/memoir` (wire → FE `Memoir` via `toMemoir`, `Hét N …` week label derived client-side)
- `insightsHooks.ts` — `useInsights` (no longer returns `weekly`/`weeklySuggestion` since D′; its `memoir`/`anniversaryNote` fields no longer consumed since W2 — only `predictions`/`experiments` are live)
- `hooks.ts` — barrel: re-exports `useKnowledge`, `useInsights`, `useChat`, **`useWeekly`**, **`useMemoir`** (the boundary / Phase-3 swap point). It is a **shared, app-wide barrel** — every domain lands its re-export line here (most recently the account-progression hooks, `mezo-k7rn`), so a change to this file is not by itself evidence of an Insights-relevant change; check which exported names moved.
- `types.ts:349-418` — all Insights/Knowledge/Chat types
- Tests: `insightsData.test.tsx`, `chatData.test.tsx`

**Cross-feature seams:**
- `frontend/src/app/router.tsx:76-87` — route wiring · `frontend/src/app/TabBar.tsx:10`
- `frontend/src/features/me/pages/KnowledgePage.tsx` + `ProfilePage.tsx` — share `useKnowledge`
- `frontend/src/features/me/components/InsightCard.tsx` — `TrendInsight` (lightweight insight, used by Goals/Sleep)
- `frontend/src/data/train/train.ts:57` · `sleep.ts:25-33` · `fuelWeek.ts:55,151,156` · `goals.ts:50` — "pattern engine" references (shared `P2`/`P3` IDs)
- `frontend/src/shared/ui/RefTag.tsx · ToolChip.tsx` — chat tool/ref rendering
- `frontend/src/styles/prototype.css:42–47` — `--cat-*` tokens (S8 `mezo-mifi`: `var()` aliases onto Napív accents, no dark block)

**Docs (link, don't duplicate):**
- `docs/superpowers/specs/2026-07-05-insights-weekly-honest-design.md` (D′ — deterministic Weekly v0 + honest surface for Memoir/Predictions/Experiments)
- `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (Slice D §126; Phase-3 out-of-scope §6)
- `docs/milestones/roadmap.md:12-13` (Slice D remaining; Phase-3 AI brain)
- House standards: `docs/references/{api_contract_conventions,liquibase_conventions,java_package_structure,spring_patterns,error_handling,configuration_conventions,testing_standards,integration_test_framework}.md`

**Confirmed absent (Phase-3 gap):** no `api/feature/insights|knowledge|chat`, no `backend/**` Java for any Insights domain, no Liquibase changeset. **Weekly (D′) has a real-mode hook path but no Insights backend** — it composes over other features' contracts (Fuel/Train/biometrics) client-side. **Memoir (W2) has a real-mode hook path over a PROACTIVE-owned backend** (`GET /api/proactive/memoir` — not an Insights endpoint; the `memoir` table + generator live in `feature/proactive`, see [`proactive.md`](proactive.md)).

