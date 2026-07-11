# mezo — Per-Feature Documentation Index

This folder is mezo's **living, current** engineering reference: one doc per domain feature and one per cross-cutting platform layer. Each doc describes how a feature **works now** — its data flow, data model/API, **integrations with other features**, how to **use** it, how to **extend** it, and how it's tested. They are kept in sync with the code; if a feature changes and its doc here doesn't, the work is not done.

---

## 1. Purpose — and how this differs from `specs/` and `references/`

`docs/features/` is the answer to *"how does feature X work, and how do I build on it?"* — read it before touching any feature or wiring any new one. It is durable memory that tracks the code, not a point-in-time artifact.

Three doc families, three different jobs — read the right one (or all three) for the job at hand:

| Folder | Question it answers | Lifecycle | When to read it |
|---|---|---|---|
| **`docs/features/`** (this folder) | **HOW it works NOW** — operation, data flow, data model/API, integrations, use, extend, test | **Living** — kept in sync with the code | You're understanding, consuming, debugging, extending, or wiring a feature. Start here. |
| **`docs/superpowers/specs/`** | **WHAT we decided to build & WHY then** — the design as it stood when the feature was conceived | **Point-in-time** — a historical artifact, *not* kept in sync | You need the original design rationale, slice map, or the "why this shape" behind a decision. Each feature doc links its driving spec. |
| **`docs/references/`** | **HOW we build** — Java/Spring/Liquibase/testing/API **house standards** | **Living, non-negotiable** rules | You're writing/reviewing backend code, a migration, a test, or a contract. The feature doc tells you *what*; the reference tells you the *mandatory pattern*. |

Rule of thumb: a feature doc tells you the feature's seams and the recipe to extend it, then **links** to the relevant `references/*.md` for the exact house standard and to its `specs/` for the original rationale — it never restates them. ADRs (`docs/decisions/`), infra (`docs/infrastructure/`), and the roadmap (`docs/milestones/roadmap.md`) are linked, never duplicated.

### Maintenance policy — living, but kept lean

These docs are **overwritten in place; git is the history.** When a feature changes, edit the affected section(s) of its doc as part of the same change — **never** keep an in-doc changelog, version suffix, or dated snapshot. To see what a doc said before, use `git log -p docs/features/<x>.md`. This is what keeps the set from bloating: a `features/` doc has exactly one current version per feature, whereas `specs/` deliberately accumulates one dated, frozen artifact per design effort (the decision trail). Practical rules:

- **Edit only what changed.** The 10-section template means a change maps to specific sections (new endpoint → §4 + §10; new integration → §5; mock→real swap → §3 + §4 + §8). Update those; leave the rest.
- **Link, don't duplicate.** Describe structure, intent, and integration seams with `file:line` pointers — don't paste code (it rots fastest) or restate `references/` / `specs/`.
- **Update when it changes what the doc describes** — behavior, contract, data model, integrations, the file map, or status. A purely internal, no-behavior-change refactor only needs a touch if its `file:line` pointers went stale.
- **Same change, not a later pass** — so review catches drift. If the work leaves a `features/` doc stale, the work isn't done.

**Mandatory rule (enforced by root `CLAUDE.md` + [`docs/README.md`](../README.md)):** every new or changed feature MUST add or update its `docs/features/` doc — a new view/flow, a new domain, swapping a mock hook to real, a new sub-feature, or a cross-feature integration all require it. See [§5 of this index](#5-the-doc-template) for the canonical template every doc follows.

---

## 2. Index

Status legend: ✅ done · 🔶 mock-only (Phase-1 FE, no real backend yet) · 🟣 Phase-3 (AI brain) deferred · mixed = per sub-feature.

### Domain docs

| Doc | Area | Status | One-line |
|---|---|---|---|
| [`today.md`](today.md) | Today (`/today`, "Ma") | 🔶 mock-only (one real seam: check-in save) | Daily morning-briefing aggregation surface; every section mock except the `POST /api/biometrics/checkin` write. Includes AnchorMode + the "Heartbeat" 4×/day check-in. |
| [`train.md`](train.md) | Train (`/train`, "Edzés") | ✅ done (FE mock + FE real + backend) | The largest domain: six tabs (Mai · GYM · Sport · Futás · Gyakorlatok · Mesociklusok) — mesocycles, workout execution, exercise catalog/records, volleyball, interval running. AI/cross-load engine is 🟣 Phase-3. |
| [`fuel.md`](fuel.md) | Fuel (`/fuel`) | 🔶 mock-only (Slice C not started) | Nutrition: meal pacing, supplement stack/protocol, pantry ("Kamra"), recipes, weekly rhythm. AI scoring/replan/import simulated client-side. |
| [`insights.md`](insights.md) | Insights (`/insights`) | 🔶 mock-only (🟣 Phase-3 landing zone) | The "AI brain" read surface: 7 sub-tabs (patterns, weekly, memoir, knowledge, chat, predictions, experiments) — hand-authored mock copy simulating the future AI. |
| [`me.md`](me.md) | Me (`/me`, "Én") | mixed — `Cél`/`Alvás` ✅ backed; `Profil`/`Emberek`/`Tudás` 🔶 | Profile + biometrics + relationships hub. Weight (`Cél`) and sleep (`Alvás`) are real; profile, People, and the Knowledge alias are mock. |
| [`companion.md`](companion.md) | Companion (AI chat brain, Phase-3) | mixed — backend ✅ V0.2 spine; FE 🔶 mock | The Phase-3 AI companion: persisted conversations + a sync Hungarian chat endpoint over the `CompanionLlm` port (Spring AI 2 / Gemini). No FE surface yet — the ChatPage stays the mock `insights` chat until V0.4. |
| [`growth.md`](growth.md) | Growth (daily quests, no own route — Today card) | ✅ E1 done | Gamified growth layer per ADR 0010: deterministic catalog-driven daily quests (BODY+FUELBIO), derived completion → XP via the progression award tail, LIFE band seed (`recovery`), reroll, cron backstops. E2 (LIFE band + activity log + GrowthCard) planned. |

### Platform docs (cross-cutting, `_`-prefixed — no route/tab of their own)

| Doc | Area | Status | One-line |
|---|---|---|---|
| [`_platform-data-layer.md`](_platform-data-layer.md) | Data Layer & Dual-Mode | ✅ done (some hooks 🔶 mock-only) | The single FE↔data boundary (`data/hooks.ts`) + `isMockMode()` dual-mode switch + TanStack Query wiring + typed REST clients. Read before wiring any domain to the backend. |
| [`_platform-api-backend.md`](_platform-api-backend.md) | API Contract & Backend Architecture | ✅ done (auth · biometrics · Train) | The contract-first OpenAPI pipeline (`api/`) + the Spring Boot 4 backend spine (`techcore/` + `feature/<x>/…`) + the FE consumption seam. Drift = compile error. |
| [`_platform-auth-security.md`](_platform-auth-security.md) | Auth & Security | ✅ backend done; FE bootstrap real, 🔶 stubbed in mock | Single-owner auth: login → 30-day HS256 JWT → resource-server filter → server-side `created_by` ownership. No login UI. |
| [`_platform-design-system.md`](_platform-design-system.md) | Design System & UI Primitives ("Deep Current v2") | ✅ done (Phase-1, FE-only) | The CSS-token vocabulary, ~25 React primitives, and the iPhone-frame app shell every screen renders on. No backend. |

---

## 3. Feature → doc map (quick lookup by route or sub-feature)

Jump from a route, tab, sub-feature, or concept to the doc + the section that covers it.

| You're looking at / for… | Route | Doc → section |
|---|---|---|
| The home screen, "Ma", morning briefing | `/today` | [`today.md`](today.md) §2 |
| Check-in / "Heartbeat" strip / `CheckInSheet` | `/today` | [`today.md`](today.md) §3–§4 (the one real Today seam) |
| AnchorMode (rough-day recovery view) | `/today?day=rough` | [`today.md`](today.md) §2, §9 |
| Reta(trutide) phase bar / cycle | `/today`, `/fuel` | [`today.md`](today.md) §2 · [`fuel.md`](fuel.md) §5 |
| Weekly cross-domain agenda (gym+volley+run) | `/train` (Mai) | [`train.md`](train.md) §2, §5 (`TrainTodayPage`) |
| Active week / gym split | `/train/gym` | [`train.md`](train.md) §2 (`GymPage`) |
| Active workout / per-set logging / resume | `/train/session` | [`train.md`](train.md) §2, §4 (workout execution) |
| Mesocycle library / planner / builder | `/train/mesocycles`, `/new`, `/:id` | [`train.md`](train.md) §2, §4 (mesocycles) |
| Volleyball ("Röplabda") schedule + log | `/train/sport` | [`train.md`](train.md) §2, §4 (sport) |
| Interval running ("Futás") + block builder | `/train/futas`, `/train/futas/:id` | [`train.md`](train.md) §2, §4 (running) |
| Exercise catalog + per-exercise records | `/train/exercises` | [`train.md`](train.md) §2, §4 (catalog/records) |
| Meal pacing ("Mai") + meal score sheet | `/fuel` | [`fuel.md`](fuel.md) §2 (`FuelMaiPage`) |
| Weekly fuel rhythm / gym-time grid | `/fuel/plan` | [`fuel.md`](fuel.md) §2 (`FuelPlanPage`) |
| Supplement protocol builder | `/fuel/stack` | [`fuel.md`](fuel.md) §2, §3 (`buildProtocol`) |
| Recipe library / new recipe | `/fuel/recipes` | [`fuel.md`](fuel.md) §2 (`FuelRecipesPage`) |
| Pantry / "Kamra" / scrape import | `/fuel/kamra` | [`fuel.md`](fuel.md) §2, §3 (`buildKamraItems`) |
| Detected patterns (critique grid, confirm/reject) | `/insights` | [`insights.md`](insights.md) §2.1 |
| Weekly review / memoir / predictions / experiments | `/insights/{weekly,memoir,predictions,experiments}` | [`insights.md`](insights.md) §2.2–§2.7 |
| Companion chat (simulated) | `/insights/chat` | [`insights.md`](insights.md) §2.5 |
| Knowledge facts (flat list, prompt toggles) | `/insights/knowledge` | [`insights.md`](insights.md) §2.4, §5.1 |
| Knowledge graph / "Élő mindmap" | `/me/knowledge` | [`me.md`](me.md) §5.5 → data is Insights-domain ([`insights.md`](insights.md) §5.1) |
| Profile dashboard / settings / theme toggle | `/me` (Profil) | [`me.md`](me.md) §2 · theme: [`_platform-design-system.md`](_platform-design-system.md) §2 |
| Weight goal + log ("Cél") | `/me/goals` | [`me.md`](me.md) §2–§4 (weight ✅ backed) |
| Sleep log ("Alvás") | `/me/sleep` | [`me.md`](me.md) §2–§4 (sleep ✅ backed) |
| People / "Mizu Velünk" 1:1 ritual ("Emberek") | `/me/people` | [`me.md`](me.md) §2 (mock-only) |
| The `useX()` hooks / mock-vs-real / ghost-guard rule | — | [`_platform-data-layer.md`](_platform-data-layer.md) §2, §4 |
| OpenAPI contract / `api/feature/<x>.yml` / codegen | — | [`_platform-api-backend.md`](_platform-api-backend.md) §3–§4 |
| `OwnedEntity` / `CurrentUserId` / soft delete / typed jsonb | — | [`_platform-api-backend.md`](_platform-api-backend.md) §4b · [`_platform-auth-security.md`](_platform-auth-security.md) §4 |
| Login / JWT / owner seed / token bootstrap | `/api/auth/login` | [`_platform-auth-security.md`](_platform-auth-security.md) §3–§4 |
| Tokens / primitives / `Sheet` / `GhostState` / accent convention | — | [`_platform-design-system.md`](_platform-design-system.md) §5–§6 |
| Companion chat backend (conversations + sync message) | `/api/companion/*` | [`companion.md`](companion.md) §3–§4 |

---

## 4. Cross-reference / integration matrix

Derived from each doc's **§5 Integrations**. The named **contract** is the type/shape that crosses the seam. 🟣 marks a seam that is narrated/mock today but whose live engine is Phase 3.

### Domain ↔ domain

| Seam | Direction | Contract crossing | Notes / source |
|---|---|---|---|
| **Today ↔ Train** | Today → Train | navigation only (`navigate('/train')`); Today renders its **own** mock `Workout`, not Train's backend | [`today.md`](today.md) §5 |
| **Today ↔ Fuel** | Today ← Fuel | `FuelSlot[]` / `FuelPlanToday` — `useFuelPreview` slices the **same** `fuelToday` object Fuel renders | [`today.md`](today.md) §5 · [`fuel.md`](fuel.md) §5 |
| **Today ↔ Insights** | Today → Insights | visual teaser only; `InsightsTeaser` mirrors pattern `p1` verbatim (a copy, not a live read) | [`today.md`](today.md) §5 · [`insights.md`](insights.md) §5.2 |
| **Today scenario ↔ Fuel** | Fuel ← Today | `TodayScenario` (`retaDay`, `day`) drives Fuel/Mai's Reta bar via `useTodayScenario` | [`fuel.md`](fuel.md) §5 |
| **Train (Mai) ↔ Running** | internal merge | `WeeklyAgendaDay` / `RunPrescribedSession` / `WorkoutPlan` / `SportSchedule` — `TrainTodayPage` composes both `useTrain` + `useRunning` | [`train.md`](train.md) §5 (canonical internal integration) |
| **Train Sport → all systems** 🟣 | Sport → Fuel/Sleep/Weight/Insights/Train | `CrossLoadRow {target,impact,why,system,warning}` — mock-only; engine Phase 3 (`crossLoad: null` in real → view ghosts) | [`train.md`](train.md) §5 |
| **Train Running → GYM** 🟣 | Running → leg volume | static presentational cross-load text — engine Phase 3 | [`train.md`](train.md) §5 |
| **Train ↔ Me/`Cél`** 🟣 | mock narrative | a mesocycle id/label pair; `Goal.mesocycles` IDs are mock strings, not joined to the Train backend | [`me.md`](me.md) §5.2 |
| **Train (gym) ↔ Fuel** | Fuel owns a copy | `GymScheduleDay` / `VolleyballSession` — Fuel keeps its **own private copy** of the schedule, not read from Train | [`fuel.md`](fuel.md) §5 |
| **Fuel ↔ Me/`Alvás`** 🟣 | Fuel → Sleep | `SleepLogResponse.mealToSleep` hardcoded `0` "until Fuel lands" — *the* documented future seam | [`me.md`](me.md) §5.3 · [`fuel.md`](fuel.md) §1 |
| **Fuel replan cascade** 🟣 | Fuel → Sleep/Insights/Train | `ReplanScenario.cascades[].system` (`'Fuel'|'Train'|'Sleep'|'Insights'`) — the simulated "context ripples across domains" model | [`fuel.md`](fuel.md) §5 |
| **Me/Knowledge ↔ Insights/Knowledge** | shared hook | `KnowledgeFact[]` + `KnowledgeEdge[]` — `useKnowledge` backs `/insights/knowledge` (flat list) **and** `/me/knowledge` (graph) — co-design any backend | [`insights.md`](insights.md) §5.1 · [`me.md`](me.md) §5.5 |
| **Cross-system "pattern engine"** 🟣 | Insights ← Train/Sleep/Fuel/Goals | shared stable pattern IDs (`P2`/`P3`) referenced by hand in mock copy across domains — build as a **shared service**, not Insights-local | [`insights.md`](insights.md) §5.4 |
| **`TrendInsight` (lightweight insight)** | embedded in Goals/Sleep | `TrendInsight {type, text}` — a parallel, lighter insight type vs the rich `Pattern`; Phase-3 must reconcile | [`insights.md`](insights.md) §5.3 |
| **Today ↔ Me** | shared object | `UserMeta` — `useProfile` re-exports the same `user` defined in Today's mock; biometrics backend is shared (check-in is a weight/sleep sibling) | [`me.md`](me.md) §5.1 |

### Domain ↔ platform (every domain rides these)

| Platform seam | What crosses | Doc |
|---|---|---|
| **Data layer** (the hub) | every domain consumes its data **only** via `useX()` from `@/data/hooks`; mock-vs-real via `isMockMode()`; real mode has no static fallback → views ghost-guard | [`_platform-data-layer.md`](_platform-data-layer.md) §6 |
| **API contract & backend** | every backed feature flows `api/feature/<x>.yml` → generated `*Api` + `*Request`/`*Response` DTOs → controller → service → `OwnedRepository` → Postgres; drift = compile error | [`_platform-api-backend.md`](_platform-api-backend.md) §5 |
| **Auth & ownership** | `CurrentUserId.get()` (UUID from JWT subject) → `OwnedEntity.createdBy`, stamped server-side, never in a DTO; `apiFetch` Bearer token from `bootstrapOwnerToken` | [`_platform-auth-security.md`](_platform-auth-security.md) §5 |
| **Error contract** | `SystemMessage[]` / `SystemMessageList` (stable codes, never resolved text) ↔ FE `ApiError` | [`_platform-api-backend.md`](_platform-api-backend.md) §5 · [`_platform-auth-security.md`](_platform-auth-security.md) §5 |
| **Design system** | `@/shared/ui/**` primitives, `Sheet`, `GhostState`, `--cat-*`/accent tokens, the on-brand-screen idiom; theme via `data-theme` | [`_platform-design-system.md`](_platform-design-system.md) §5 |

**Reading the matrix:** Train is the hub of live cross-domain data (Mai aggregation, records ← sets). Insights is the conceptual hub the others *point toward* (shared `P2`/`P3` pattern IDs, the knowledge graph shared with Me). Fuel is the most cross-coupled **mock** domain (Today preview, Reta cycle, replan cascade, Me/Goals context). Everything funnels through the platform data-layer + design-system, and every backed write funnels through auth/ownership.

---

## 5. The doc template

Every feature doc — domain or platform — follows this **canonical 10-section template**. Keep the section numbers and headings stable so the [feature→doc map](#3-feature--doc-map-quick-lookup-by-route-or-sub-feature) and cross-references stay mechanical. Open with a one-line `>` blockquote summary that states the route/tab (or "platform, no route") and a precise per-layer status badge (✅ / 🔶 / 🟣 / mixed). Write in **English**; quote Hungarian UI labels, route names, and domain terms **verbatim**. Link `specs/`, `references/`, `decisions/`, and `roadmap.md` — never duplicate them.

```markdown
# <Feature> — Feature Documentation

> One-line: <what it is> at route `<route>` (tab "<HU label>"). **Status: <✅/🔶/🟣/mixed per layer>.**
> <If platform: the `_`-prefix note — cross-cutting, no route/tab of its own.>

## 1. Summary
What it is, why it exists, status per layer (FE mock / FE real / backend), and the driving
design spec(s) in `docs/superpowers/specs/` (+ ADR if one exists). Be precise about what is
real vs mock vs Phase-3.

## 2. User-facing behavior
The routes/sub-tabs and what the user actually does on each — flows, sheets, scenarios,
empty/ghost states. Quote Hungarian labels verbatim.

## 3. Architecture & data flow
The `view → hook → mock/real → api → backend → db` path (or where it truncates). The
`isMockMode()` seam, key invariants (synchronous mock `initialData`, no-static-fallback
real mode, ghost-guard), and the mock/real mutation flavors. A traced flow diagram helps.

## 4. Data model & API
FE domain types (`data/types.ts`), mock data files, and — if backed — the contract fragment,
endpoints (method + path + returns + status), entities, migrations, mappers. If unbacked,
state "no tables/DTOs/endpoints exist yet" and where the backend will plug in.

## 5. Integrations
The highest-value section: every seam to other features/platform, **bidirectional**, each
naming the **contract** (the type/shape that crosses). Mark 🟣 for mock-today/Phase-3-engine
seams. This section feeds the index's integration matrix — keep it accurate.

## 6. How to use it (consume)
Import-from-`@/data/hooks` examples (never reach into a hook module or `*Api.ts` directly),
the returned shape, ghost-guard + `*Pending` obligations, and pure helpers worth reusing.

## 7. How to extend it
The concrete recipe: contract-first → backend (per `docs/references/*.md`) → migration →
dual-mode hook → both-test-modes-green. Link the references; never restate them. Include the
mock-only extension path where relevant.

## 8. Testing
FE (Vitest + RTL + MSW, both `pnpm test` and `VITE_USE_MOCK=true pnpm test`; parity), and —
if backed — backend ITs (`AbstractIntegrationTest`/`ApiIntegrationTest` + Postgres, populators,
`ResetDatabase`). Name representative tests and the commands.

## 9. Decisions, gotchas & deferred
Key decisions (link specs/ADRs), load-bearing gotchas, and what is explicitly deferred /
Phase-3 (with bd issue ids where they exist).

## 10. Key files
A grouped pointer list (FE views/components, data/hooks, API contract, backend, tests, docs) —
absolute-from-repo-root paths so the next contributor can navigate straight in.
```

**The rule (restated, because it is enforced):** per root `CLAUDE.md` and [`docs/README.md`](../README.md), any new or changed feature — new view/flow, new domain, mock→real hook swap, new sub-feature, or a cross-feature integration — **MUST** add or update its `docs/features/` doc in the same change. If a finished piece of work leaves no trace here of how the feature now works, the work is **not done** — update the doc before closing the `bd` issue.
