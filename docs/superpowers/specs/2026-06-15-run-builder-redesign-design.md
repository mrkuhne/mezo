# Mezo — Run Builder Redesign (weekday + time-of-day, 1–8 weeks, auto-save) — Design

> **Date:** 2026-06-15
> **Status:** Approved (brainstorming) → next: writing-plans
> **Driving issues:** `mezo-9pv` (redesign · feature) · `mezo-11m` (weeks-crash · bug, shipped together) · `mezo-eq9` (＋Edzés free-form sessions · follow-up, out of scope here)
> **Scope:** Rework the running-block builder so the user can choose **which weekdays** and **what time** each prescribed session runs, set a **1–8 week** plan length, and edit through **auto-save** with a single bottom action. Fix the `weeks` crash on new-plan creation. Frontend-driven; one new nullable contract field, **no DB migration**. Free-form session add/remove is explicitly deferred.

## Source of truth

- **Existing running slice (the code being reworked):** `docs/superpowers/specs/2026-06-14-train-running-slice-design.md` (original design) and the live files below.
- **Frontend boundary:** `frontend/src/data/hooks.ts` → `useRunning()` in `frontend/src/data/runningHooks.ts`. Hook signatures are the contract.
- **Backend house standards (mandatory):** `docs/references/` — `api_contract_conventions.md` (contract-first), `spring_patterns.md`, `testing_standards.md`, `integration_test_framework.md`. This spec **references** them; it does not restate them.
- **Day+time precedent (copy it):** `SportScheduleSlot` already carries `dayOfWeek` (int 0–6) **and** `time` (HH:mm) end-to-end — `api/feature/train/train.yml` `SportScheduleSlotInput`/`Response` (~1333–1387), `sport_session.time VARCHAR(5)`, editor `SportScheduleSheet.tsx:122-128` (native `<input type="time">`).
- **Weekday model:** `frontend/src/data/train.ts:17` `DAY_ORDER = ['Hét','Kedd','Sze','Csü','Pén','Szo','Vas']` (index = `dayOfWeek`, Monday=0).

## Approved decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Builder layout | **B — self-contained session cards.** Each prescribed session is one card: type header + RPE + weekday grid + time-of-day + load controls. |
| 2 | Card internal structure | Two zones, labelled: **Menetrend** (plan-level: weekday grid + time, "minden héten") and **Terhelés** (week-level: steppers / pyramid pills, "N. hét"). |
| 3 | Weekday | Make the existing `dayOfWeek` user-editable via a 7-day grid (reuse the `MesocyclePlanner` grid look, run accent `--info`). Single-select per session. |
| 4 | Time-of-day | **New `timeOfDay` field** (HH:mm string, nullable) on `RunPrescribedSession`. Editor = native `<input type="time">` (mirrors `SportScheduleSheet`; mobile-native, full precision). |
| 5 | Day+time scope | **Plan-level**: editing day/time writes to **every week's** same-`key` session. The week selector only changes load. |
| 6 | Session `key` | **Stays stable** (`'tue-sprint'` / `'fri-pyramid'`); never derived from the weekday — it is the `run_session_log` join key. |
| 7 | Plan length | **1–8 weeks**: `＋` adds a week (clone of last), last week removable. |
| 8 | Save model | **Auto-save** (debounced on draft change + flush on back / week-change / status action). No `Mentés` button; `✓ Mentve` indicator. |
| 9 | Bottom actions | **Single status CTA**: planned → `Aktiválás · {date}`, active → `Lezárás`. `Duplikálás` / `Törlés` move into a header `⋯` menu. |
| 10 | Out of scope | `＋ Edzés hozzáadása` (arbitrary sessions/types) → `mezo-eq9`. The fixed Sprint+Piramis pair ships now. |

## 1. UX / layout

Full-screen builder (route `/train/futas/:id`), running accent `--info`. Top-to-bottom:

- **Breadcrumb** `← Futás` + status eyebrow `Builder · {Tervezett|Aktív|Archív}`. Right side of the eyebrow row: `✓ Mentve` save chip + `⋯` overflow button.
- **Title** input (display font) + **goal** (`cél`) input — unchanged.
- **Hetek · 1–8** row: week chips `1..N` (selected = `--info` tint) + dashed `＋` chip (adds a week, hidden at 8). Removing the last week: small `×` affordance on the last chip when `N > 1`.
- **Session cards** (Sprint, then Piramis), each:
  - Header: mono label (`Sprint-intervallum` / `Piramis-intervallum`) + RPE tag (sprint `min≥9` → `--error`, else `--warning`).
  - **Menetrend zone** — `Nap · minden héten` hint + 7-day grid (`dayOfWeek`); `Időpont · minden héten` hint + native time input (`timeOfDay`).
  - thin divider.
  - **Terhelés zone** — `Terhelés · {N}. hét` hint + sprint: two `CompactStepper`s (kör / mp pihenő); pyramid: tappable work-second pills + `＋ szakasz`, with `pihenő = szakasz × 2 · automatikus` note.
- **Sticky bottom bar**: single CTA — planned `✓ Aktiválás · {startDate}`, active `Lezárás` (error-tint ghost), archived → no CTA (read-only; Duplikálás still available in `⋯`).
- **`⋯` menu**: `Duplikálás`, `Törlés` (error). All statuses.

Reference mockup (frozen, mezo design tokens): `docs/superpowers/specs/2026-06-15-run-builder-redesign-mockup.html`.

## 2. Data model & contract change

The whole plan tree is one jsonb column (`running_block.structure JSONB NOT NULL`), so the only model change is **one nullable field**, and **no Liquibase migration / no DB column** is needed — Hibernate `@JdbcTypeCode(JSON)` + MapStruct round-trip new fields automatically.

Add `timeOfDay` (string, HH:mm, nullable) to `RunPrescribedSession`. `dayOfWeek` already exists.

Touch points (contract-first per `api_contract_conventions.md`):

1. **OpenAPI** `api/feature/train/train.yml` → `RunPrescribedSession` schema (~1440): add **`timeOfDay`** (string, nullable, `pattern: '^\d{2}:\d{2}$'`, example `'18:00'`) — same HH:mm shape as `SportScheduleSlot.time`, named `timeOfDay` to avoid ambiguity with logged actual times. Then regenerate: `cd api/generate && npm run generate:api`; `cd frontend && pnpm generate:api`; backend types via `./mvnw generate-sources`.
2. **Java** `backend/.../feature/train/entity/RunningBlockStructure.java` — add `String timeOfDay` to the `RunPrescribedSession` record (lines 14–21). No entity/mapper/migration change.
3. **FE generated types** `frontend/src/lib/api.gen.ts` (RunPrescribedSession ~837) regenerate; `runningApi.ts` re-exports — not hand-edited.

## 3. Plan-level day+time propagation

Day/time live on each session but are **plan-level**: an edit applies to that session in **every** week. New immutable updaters in `frontend/src/data/runningDraft.ts`, keyed by the **stable** session `key`:

```
setSessionDay(structure, key, dayOfWeek) // maps ALL weeks' sessions where s.key === key
setSessionTime(structure, key, timeOfDay)
```

(contrast with the existing `setSprintRounds`/`setSprintRest`/`setPyramidWork`, which target a **single** `weekNumber`.) Because `key` is stable and weekday-independent (decision #6), the `run_session_log` join (`block_id + week_number + session_key`) never desyncs.

Defaults: `sprintSession` / `pyramidSession` factories (`data/running.ts`, `data/runningDraft.ts`) gain a `timeOfDay` default (e.g. sprint `'18:00'`, pyramid `'17:30'`). `dayOfWeek` defaults unchanged (1 = Kedd, 4 = Péntek).

## 4. Plan length 1–8 weeks

New `runningDraft.ts` helpers:

- `addWeek(structure)` — clone the last `RunWeek` (load progression continues from it), `weekNumber = N+1`; cap at 8. Builder also bumps `draft.weeks`.
- `removeLastWeek(structure)` — drop the last week; floor at 1. Builder decrements `draft.weeks` and clamps `currentWeek`/`selectedWeek`.

`newDraft` keeps a sensible default length (4) but the field is now first-class editable. `endDate` is recomputed from `weeks` on length change.

## 5. Auto-save + actions

`RunningBlockBuilder` keeps its local `draft` state. Replace the explicit `Mentés` button with auto-save:

- A **debounced effect** (~600 ms) calls `saveRunningBlock(block.id, draft)` when the draft changes and differs from the loaded block.
- **Flush on exit**: the back button, week-change, and status actions persist the pending draft first.
- `✓ Mentve` chip reflects `saveMutation` idle/pending/success.
- Real-mode `saveMutation.onSuccess` already `invalidate()`s; the builder's re-seed effect is keyed on `[block?.id]` only, so a refetch with the same id does **not** clobber in-progress edits (existing behavior, `RunningBlockBuilder.tsx:47-53`).
- Bottom CTA = status action only (`activateRunningBlock` / `closeRunningBlock`). `Duplikálás` (`saveRunningBlock(null, duplicateDraft(block))`) and `Törlés` (`deleteRunningBlock`) move into the `⋯` menu.

## 6. `weeks`-crash fix (mezo-11m)

**Root cause:** `RunningView.createBlock` (`RunningView.tsx:60-64`) → `saveRunningBlock(null, newDraft, { onSuccess: b => openBuilder(b.id) })`. Real-mode `saveMutation.onSuccess = invalidate` (`runningHooks.ts:52`) only schedules an async refetch — it never inserts the created block into the cache. `openBuilder` navigates immediately; the builder mounts on the **stale** list → `block` undefined → `draft = {}` → `RunWeekEditor.tsx:30` reads `structure.weeks` on `undefined` → throws. Mock mode is immune (`upsertMock` does a synchronous `setQueryData`, `runningHooks.ts:38-47`).

**Fix (defense in depth):**

1. **Primary** — make real-mode create populate the cache synchronously: in the save mutation's success path, when it was a **create** (no id), `qc.setQueryData(['running','blocks'], prev => [...(prev ?? []), created])` (then still `invalidate`). The builder now finds the block on mount.
2. **Guard** — `RunningBlockBuilder` treats "block present but `draft.structure` not yet seeded" as a loading state (don't pass `undefined` structure down); `RunWeekEditor` / `RunSessionCard` read `structure?.weeks ?? []`.
3. **Regression test** — IT/component test for create → navigate → builder renders (the path the existing mock-only `RunningBlockBuilder.test.tsx` never covers).

## 7. Component / file map

**Frontend — modify**
- `features/train/RunningBlockBuilder.tsx` — header `✓ Mentve` + `⋯` menu; 1–8 week chips with `＋`/remove; auto-save effect; single status CTA; structure guard.
- `features/train/components/RunWeekEditor.tsx` — drop hardcoded `Kedd · Sprint`/`Péntek · Piramis` strings; render per session: weekday grid + time input (Menetrend) over the existing load controls (Terhelés); `structure?.weeks` guard.
- `features/train/components/RunSessionCard.tsx` — render `timeOfDay` beside `dayLabel` (read display, ~line 85).
- `data/runningDraft.ts` — `setSessionDay`, `setSessionTime`, `addWeek`, `removeLastWeek`; `timeOfDay` in factories.
- `data/running.ts` — mock fixtures gain `timeOfDay`.
- `data/runningHooks.ts` — create-path synchronous `setQueryData`.
- `lib/api.gen.ts` / `lib/runningApi.ts` — regenerated.

**Frontend — new (small, reusable, run-accent)**
- A `WeekdayGrid` (single-select, `DAY_ORDER`, `--info`) and a thin time field — extracted within the train feature so the builder stays focused.

**Backend — modify**
- `feature/train/entity/RunningBlockStructure.java` — `timeOfDay` on the record.

**Contract**
- `api/feature/train/train.yml` — `RunPrescribedSession.timeOfDay`.

**No change:** Liquibase, `RunningBlockEntity`, `RunningMapper`, `RunningService`.

## 8. Out of scope (→ mezo-eq9)

`＋ Edzés hozzáadása` — adding/removing arbitrary sessions (any weekday/kind). Needs stable unique key generation + `run_session_log` join rework. The card model prepares for it; not built here.

## 9. Testing

- **Frontend, both modes green** (`pnpm test` and `VITE_USE_MOCK=true pnpm test`):
  - `runningDraft` unit tests: `setSessionDay`/`setSessionTime` propagate to all weeks; `addWeek`/`removeLastWeek` bounds (1..8) + `currentWeek` clamp; `key` unchanged after day edit.
  - Builder component test: weekday/time edit reflects in all weeks; auto-save fires (mocked mutation); **create → navigate → builder renders** (mezo-11m regression).
- **Backend IT** (`AbstractIntegrationTest`/`ApiIntegrationTest`, real Postgres): round-trip a block whose sessions carry `timeOfDay` (jsonb persists + returns the field); existing running ITs stay green.
- **Parity:** the run-builder is a real-mode write surface; confirm no mock-parity snapshot regressions.

## 10. Build order

1. Contract: add `timeOfDay` to OpenAPI → regenerate FE+Java types.
2. Backend: record field + IT.
3. `runningDraft.ts` updaters/factories + unit tests (TDD).
4. `runningHooks.ts` create-cache fix + `RunningBlockBuilder` guard + regression test (closes mezo-11m).
5. `RunWeekEditor` + `RunSessionCard` UI (weekday grid + time + zones).
6. Builder shell: 1–8 weeks, auto-save, `⋯` menu, single CTA.
7. Docs: update `docs/features/<train running>.md`; both test modes + build green.
