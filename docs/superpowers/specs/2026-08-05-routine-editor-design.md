# Routine editor — DB-backed habit catalog + editor page + AI suggestions (design spec)

- **Date:** 2026-08-05 · **bd:** `mezo-n5e9` (epic; children `.1` backend / `.2` FE / `.3` AI) · **Parent feature:** [habit.md](../../features/habit.md)
- **Decided with Daniel in-session** (2026-08-05): all four capabilities in scope — built-in
  habit editing, custom habits, custom chains (rutinok), AI suggestions; AI shape =
  editor-embedded propose-only (companion chat writer-tool deferred).
- **Prerequisite:** the [honest-derivation fix](2026-08-05-habit-honest-derivation-fix-design.md)
  (`mezo-u6jx`) ships first — it renames two metric strings the palette (D4) then freezes.
- This delivers the original habit spec's deferred **sub-project: custom/user-edited habits +
  catalog-management UI** ([2026-07-19 spec §10](2026-07-19-morning-evening-routine-habit-engine-design.md)).

## 1. Goal

A **routine editor**: the fixed 15-habit / 2-chain catalog becomes user-editable — rename,
reorder, toggle, re-XP the built-ins; add custom habits (MANUAL, or DERIVED off an enumerated
metric palette); create whole new chains („rutinok") anchored to a Today daypart face; and an
AI suggester that proposes habits/routines from Daniel's skills, goals and existing chains.
The 2026-07-19 data model was deliberately general (chain/position/anchor/mode/metric) so this
is an expansion, not a redesign: `habit_day`, the evaluator, XP flow and all Today/Growth
surfaces keep working unchanged over a catalog that now lives in Postgres.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Catalog storage | **Full DB catalog** — `habit_chain` + `habit_def` tables; the JSON file stays only as the **bootstrap seed** (idempotent startup importer inserts missing rows by key, per-user). No hybrid JSON+overrides: the editor is the point, one source of truth. |
| D2 | Key stability | `habit_day.habit_key` (varchar) remains the join; built-in keys never change on edit (rename = title only), custom keys are generated slugs (`custom_<nanoid>`). History + 28-day strength survive every edit. |
| D3 | Chains are first-class | `habit_chain` rows replace the MORNING/EVENING enum. Each chain carries a **`daypart` anchor** (`MORNING`\|`DAY`\|`EVENING`) that decides which Today face renders it — the FE's hardcoded `CHAIN_FACE` map is replaced by catalog data. The two seed chains map morning→Reggel, evening→Este. |
| D4 | Custom DERIVED = metric palette | A custom habit may pick a metric from an **enumerated palette of existing evaluator metrics** (e.g. `weight_logged_today`, `stim_intake_today`, `training_done_today`, `ritual_closed`, `intention_focus_set`…). **No new metric types, no user-defined evaluators** — the evaluator stays a closed, honest set. MANUAL stays the default for anything without a real signal. |
| D5 | Edit effects | Toggle off / soft-delete ⇒ no new `habit_day` rows materialize from the next day read; existing rows untouched (honest history). XP edits affect future completions only (5–15 band enforced at write time). The loader's fail-fast invariants (chain membership, MANUAL ⇔ `metric='manual'`, LIFE skill, XP band) move to **write-time validation** (`SystemRuntimeErrorException` + `SystemMessage`). |
| D6 | Surface | Entry from the `/me/growth` **Rutin tab** („Szerkesztés") → a routed **`RoutineEditorPage`** (`features/me/pages/`), with `HabitEditSheet` / `ChainEditSheet` / `AiSuggestSheet` in `features/me/sheets/`. The Rutin tab itself stays the read-only stats surface. |
| D7 | AI shape | **Editor-embedded, propose-only**: `POST /api/habit/ai/suggest` on the companion **smart model** (strict-JSON, the fact-extraction precedent), grounded in a deterministic context block (skills + levels, active goals, current chains). Accepting a card calls the normal create endpoint — the model never writes. Companion-chat writer tool: deferred (would be the first writing @Tool; separate guardrail work). |
| D8 | Mock parity | Mock catalog seeds the same two chains; editor mutations patch the query cache so the demo is fully drivable offline; both `pnpm test` modes stay green. |

## 3. Data model (child `.1`)

```
habit_chain: id uuid pk, created_by, is_deleted, created_at,
             chain_key varchar(40), title varchar(80), daypart varchar(8) ck (MORNING|DAY|EVENING),
             position int, is_active bool default true
             uq (created_by, chain_key) where is_deleted = false

habit_def:   id uuid pk, created_by, is_deleted, created_at,
             habit_key varchar(40), chain_id uuid fk→habit_chain, position int,
             title varchar(80), why text, anchor_copy varchar(120),
             mode varchar(7) ck (DERIVED|MANUAL), metric varchar(40),
             skill_key varchar(40), skill_kind varchar(4) ck (LIFE),
             xp int ck (5..15), link_url text null, is_active bool default true
             uq (created_by, habit_key) where is_deleted = false
```

- Migration naming: `{YYYYMMDDHHMM}_mezo-n5e9.1_create_habit_chain.sql` etc.; constraints named
  `pk_/fk_/uq_/ck_/idx_` per [liquibase_conventions.md](../../references/liquibase_conventions.md).
- **Bootstrap importer** (lazy, idempotent — the `ensureRows` idiom, NOT a startup runner:
  startup has no user context): the first catalog or day read for a user inserts the two seed
  chains + any catalog-JSON def whose `habit_key` has no live row for that user. Runs inside
  the habit switch; reuses the JSON loader's validation. NOT `@Profile("demodata")` — this is
  production reference data, not demo seed.
- `HabitService`/`HabitEvaluator`/`HabitJob` re-point from `HabitCatalog` (static) to a
  repository-backed catalog service; `ensureRows` iterates **active** defs; `closePast` treats
  keys absent from the live catalog as today (quietly `missed`).

## 4. API (child `.1`, contract-first in `api/feature/habit/habit.yml`)

| Method + path | Purpose |
|---|---|
| `GET /api/habit/catalog` | chains + defs (incl. inactive) for the editor; Today keeps using `GET /day/{date}` |
| `POST /api/habit/chain` · `PATCH /api/habit/chain/{id}` · `DELETE …` | create / edit (title, daypart, position, active) / soft-delete a chain (delete blocked while it has live defs) |
| `POST /api/habit/def` · `PATCH /api/habit/def/{id}` · `DELETE …` | create / edit (title, why, anchorCopy, chain, position, xp, linkUrl, active; mode+metric fixed after creation) / soft-delete a def |
| `PUT /api/habit/chain/{id}/order` | reorder defs within a chain (position list) |
| `POST /api/habit/ai/suggest` | child `.3` — propose-only suggestions (§6) |

Errors follow [error_handling.md](../../references/error_handling.md); validation per D5.
DTOs from the generated `api.dto` models on both sides — never hand-written.

## 5. Editor UX (child `.2`)

- **`RoutineEditorPage`** (route under `/me`, entry button on the Rutin tab): chain list in
  daypart order → per-chain habit rows (drag/arrow reorder, active toggle, tap → `HabitEditSheet`).
  „+ Új habit" per chain, „+ Új rutin" at page level (`ChainEditSheet`: title, daypart pick).
- **`HabitEditSheet`**: title, miért, horgony-szöveg, skill pick (LIFE skills), XP (5–15
  stepper), link URL; create-mode extra: mode pick — MANUAL, or DERIVED with the D4 metric
  palette (Hungarian labels explaining each signal, e.g. „aznapi súlylog"). Mode/metric locked after creation.
- **Today integration:** `todayItems.ts` buckets rows by the chain's `daypart` from the catalog
  read (replacing `CHAIN_FACE`); the Nap face gains routine-row capability (it renders like the
  Este chain: plain actionable rows, no hero — the hero stays a MORNING-chain feature).
  `DEDUP_PAIRS` and `habitAction` keep working keyed on the stable built-in keys; custom habit
  rows are MANUAL-`Pipa` or palette-DERIVED with the palette metric's existing CTA (or none).
- **Growth Rutin tab:** renders per-chain cards from the catalog read instead of the fixed
  two — no other behavior change.
- Data layer: `data/habit/habitAdminHooks.ts` (catalog read + CRUD mutations, invalidation:
  `['habitCatalog']`, `['habitDay']`, `['habitSummary']`), exported only via the
  `@/data/hooks` barrel; mock arm per D8.

## 6. AI suggester (child `.3`)

- `POST /api/habit/ai/suggest` `{chainKey?, hint?}` → `{suggestions: [{title, why, anchorCopy,
  skillKey, xp, chainKey, position, mode: MANUAL}]}` (max 5).
- Implementation: second `ChatClient` on `llm.smart-model` with a strict-JSON response schema —
  the fact-extraction pipeline's exact pattern; prompt grounds on a deterministic Hungarian
  context block (LIFE skills + levels, active goals, current chains with strengths) and
  instructs identity-vote tone. Suggestions are **always MANUAL** (the model must not claim
  derived signals). Calls audited into `llm_log` like every companion call.
- FE **`AiSuggestSheet`**: one tap (optional szándék-mező) → suggestion cards → accept (calls
  `POST /api/habit/def` — same validation), edit-first, or dismiss. Degraded-LLM state reuses
  the ChatPage badge pattern. Mock mode: canned suggestions.

## 7. Testing

- **`.1`:** entity/DDL ITs, bootstrap-importer idempotency IT, catalog-service + validation ITs,
  admin API ITs (CRUD, reorder, validation 4xx branches), `ensureRows`-over-active-defs +
  toggle-off materialization IT; `habit_chain`/`habit_def` → `ResetDatabase`; new populators.
  Existing `Habit*IT` suite must stay green over the DB catalog (regression gate).
- **`.2`:** editor page + sheets tests, `todayItems` daypart bucketing (incl. a DAY-face chain),
  admin-hook invalidation fan-out, mock-cache editing; both modes + build green.
- **`.3`:** suggest endpoint IT with the fake-LLM harness (strict-JSON parse, max-5, MANUAL-only
  guard), `AiSuggestSheet` accept-flow test.
- Focused gates per child; the full suite runs in CI (self-PR per child branch).

## 8. Out of scope

- Companion-chat writer tool („vegyél fel egy esti rutint" in chat) — deferred, needs the
  first-writer-tool guardrail design.
- Per-habit configurable time windows (the honest-derivation fix removed the fixed ones; the
  model leaves room, no UI in v1).
- Editing DERIVED mode/metric after creation; custom evaluator metrics; non-LIFE skills; habit
  reminders/notifications (separate deferred item in [habit.md §9](../../features/habit.md)).

## 9. Docs to update per child

`docs/features/habit.md` (§2–§7, §10 — catalog now DB, editor surface, daypart bucketing, AI
suggester) in `.2`/`.3`; `docs/features/today.md` (face bucketing source) in `.2`;
`docs/features/companion.md` gets a pointer only (the suggester lives in the habit domain).
An ADR is warranted for D1+D7 (user-editable catalog + propose-only AI) — write it in `.1`.
