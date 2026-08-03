# Mezo — Fuel Stack Page Redesign — Design

> **Date:** 2026-08-03
> **Status:** Approved (brainstorming) → next: writing-plans
> **Driving issue:** `mezo-vx9v`
> **Scope:** Replace the Stack "AI builder" (selection + Bekapcsolás) with a living, autosaved,
> occurrence-based daily protocol. Backend placement engine (rules + LLM fallback), slot-pinned
> manual moves, rest-day regrouping, real meal-match. Phase-3/P8 recommendation *content* stays
> out of scope.
> **Mockup:** [`2026-08-03-stack-redesign-mockup.html`](2026-08-03-stack-redesign-mockup.html)
> (training day + rest day + item panel — validated in the brainstorming visual companion).

## Why (problems with the current page)

- `buildProtocol()` is a name-needle rule mock: it only knows ~9 hardcoded items
  (kreatin/whey/D3/Mg/omega/koffein/AAKG/béta-alanin/PWO). **Anything else the user adds lands
  nowhere** — invisible, no slot, no feedback.
- The selection lives in session state and persists only via the **"Bekapcsolás · ma"** button
  (`POST /api/fuel/protocol` stores only the selected pantry ids). Editing feels dead until you
  press a button whose meaning ("apply a version") never matched the user's mental model.
- One item = at most one slot. Real usage needs **multiple intakes per day** (kreatin 3×5g).
- The page is crowded with mock-era sections that are empty or fictional in real mode
  (context StatCells, AI recommendations, fixed 3-recipe meal matches, narrative intro).

## Approved decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Save model | **Full autosave.** No apply button, no version concept in the UI. Single living protocol; every add/move/remove/dose change persists immediately. |
| 2 | Pin semantics | **Slot-pinned.** A manual move fixes the occurrence to a named zone; zone *times* keep flowing from the day's anchors. The engine never overwrites a pinned zone. |
| 3 | Placement engine | **Deterministic rule table + LLM fallback** for unknown items (one call at add time, cached on the occurrence; consumer-owned port per ADR 0012, feature-flagged). |
| 4 | Rest day | **Regroup.** Training-bound occurrences move to a rule-defined fallback zone for that day (or render as "ma kimarad"), badged `ma nincs edzés`; pinned zones are never rewritten — the fallback is projection-only and reverts on the next training day. |
| 5 | Layout | **A · Napi idővonal** — the page *is* today's protocol: zone cards top-to-bottom, items inside. |
| 6 | Kept sections | Day-summary strip · intake tick per occurrence · compact "Miért így" block · **meal-match, properly built**. Removed: "Mit nézek most" context card, "Mit hozzáadnék" AI recommendations, narrative intro, Bekapcsolás button/toast. |
| 7 | Meal-match scope | **Suggestion + verification.** Deterministic recipe suggestions from the real library for meal-bound zones, plus post-hoc verification of logged meals from their macro snapshots. |
| 8 | Multi-dose | **Occurrence-based items, manual splits.** The engine places one occurrence; the user adds further intakes ("+ Még egy bevétel") with their own zone + dose. Rule table may carry a recommended daily-total hint (e.g. kreatin 15–20g/nap) surfaced in the item panel — no auto-split. |

## Domain model

### Zones (canonical, shared FE↔BE)

| key | HU label | Time derivation (FE, projection-time) |
|---|---|---|
| `wake` | Ébredés | sleep-goal wake |
| `breakfast` | Reggeli | first meal window (`buildDayPlan`) |
| `pre_workout` | Edzés előtt | first training block − 40 min (existing `PRE_WORKOUT_STACK_LEAD_MIN`) |
| `post_workout` | Edzés után | first training block end + 30 min |
| `lunch` | Ebéd | lunch meal window (`buildDayPlan`) |
| `dinner` | Vacsora | dinner meal window (`buildDayPlan`) |
| `evening` | Este | bedtime − 2 h |
| `bedtime` | Lefekvés | bedtime − 30 min |

Zone **assignment** is persisted (backend); zone **times** are never persisted — the FE remains
the single source of truth for fuel-slot times (existing invariant, unchanged). Empty zones are
not rendered.

### Protocol occurrence (replaces one-row-per-selected-item `protocol_item`)

One stack item appears as **1..n occurrences** per day. Each `protocol_item` row is one occurrence:

- `pantry_item_id` (FK, unchanged) — multiple rows per pantry item allowed
- `slot_key` — zone enum above
- `dose` — nullable text; null = inherit the pantry item's default dose
- `pinned` — boolean; true when the user chose/moved the zone
- `placement_source` — `rule` | `llm` | `user` | `fallback`
- `placement_reason` — one Hungarian sentence ("why this zone")
- Uniqueness: `uq(protocol_id, pantry_item_id, slot_key)` — one occurrence of an item per zone,
  so the intake tick is unambiguous.

Removing an item from the stack deletes all its occurrences. "Vissza autóra" (unpin) re-runs the
engine for that occurrence; manually added extra occurrences have no auto state — they are
deleted, not unpinned.

### Protocol

Single living active protocol per user. The `protocol` table and its version/history columns
stay (cheap audit), but versioning disappears from the API surface and the UI.

## Placement engine (backend, at write time)

Runs in `ProtocolService` when an occurrence is created without an explicit `slotKey`, and again
on unpin:

1. **Deterministic rule table** (Java constant list in `feature/fuel`, unit-tested): ordered
   rules over pantry `category` + lowercase name/ingredient needles → `slotKey` + `reasonHu` +
   optional `restDay` behavior (`moveTo: zone` | `skip`) + optional `dailyTotalHintHu`
   (e.g. kreatin → "ajánlott 15–20g/nap — érdemes több bevételre osztani"). Extends today's
   needle set: koffein/kávé→`wake`, kreatin→`wake` (rest day: keep), whey/protein→`post_workout`
   (rest day: `breakfast`), PWO/AAKG/béta-alanin→`pre_workout` (rest day: skip), D3/K2/omega/
   zsíroldékony→`lunch`, Mg/glicinát→`evening`, ZMA→`bedtime`, … (full table in the plan).
2. **LLM fallback** for items no rule matches: one call returning `{slotKey, reasonHu}`,
   validated against the zone enum. Consumer-owned port **`StackPlacementLlm`** in
   `feature/fuel`, adapter provided by companion (ADR 0012 idiom), gated on
   `mezo.feature.stack-placement-llm.enabled`. Result stored on the occurrence
   (`placement_source='llm'`) — never re-called for that occurrence.
3. **Fallback** when the flag is off or the call fails: `breakfast`,
   `placement_source='fallback'`, reason "Bizonytalan besorolás — helyezd át, ha máskor szeded."

User-chosen placements (`slotKey` given, or a move) store `placement_source='user'`,
`pinned=true`, and skip the engine.

## Day projection (frontend, pure logic)

New pure function `projectStackDay(occurrences, anchors, blocks, date)` in
`features/fuel/logic/` (replacing `buildProtocol`; `deriveBlocks`/`deriveProtocolAnchors` stay):

- Maps each occurrence's zone to today's time per the zone table; groups into ordered zone cards.
- **Rest day** (no training block today): `pre_workout`/`post_workout` occurrences follow their
  rule's `restDay` behavior; without one, `pre_workout`→`breakfast`, `post_workout`→`lunch`.
  `skip` renders the occurrence greyed-out with a `ma nincs edzés → kimarad` badge (tick
  disabled) inside its fallback zone. Pinned occurrences get the same projection-only fallback,
  badged; the persisted zone is untouched.
- "Recalculation daily / on routine change" is therefore automatic: projection runs at render
  from live anchors (sleep goal, Train schedule, meal windows) — no cron, no button.

## UX

**Page composition (top→bottom):** page header · day-summary strip (day type + training time,
wake/bed anchors, item + pin count, "minden változás automatikusan mentve") · zone cards ·
"+ Hozzáadás a Kamrából" (existing `StackPickerSheet`, now creating occurrences directly) ·
meal-match block · compact "Miért így" block (2–3 key reasons distilled from the occurrences'
`placement_reason`s).

**Zone card:** zone name + projected time + anchor note (e.g. `gym −40p`). Item row: intake tick
(existing `/api/fuel/intake`, now sent with `slotKey`; per-occurrence tick, taken = strikethrough)
· name + dose · badge `auto` / `📌` / rest-day badge.

**Item panel (`StackItemSheet`, tap a row):** current placement + reason; zone picker chips with
the engine's ★ suggestion; **"Vissza autóra"** (pinned/manual-move occurrences only); dose edit;
**"+ Még egy bevétel"** (new occurrence: zone + dose, `user`-placed); daily-total hint when the
rule table has one; "Eltávolítás a stackből" (deletes all occurrences of the item).

## Meal-match (FE pure logic, no new endpoint)

`matchMealsToStack(occurrences, recipes, fuelDays)` in `features/fuel/logic/`:

- **Suggestion:** for each meal zone (`breakfast`/`lunch`/`dinner`) holding ≥1 fat-bound
  occurrence → top recipe from the real library by fat/serving (tie-break: mezoFit); for
  `post_workout` with protein-bound items → top by protein/serving. Max 1 suggestion per zone,
  with a one-line reason ("32g zsír/adag → D3+K2 felszívódás").
- **Verification:** for today's and yesterday's logged meals in those windows, evaluate the
  macro snapshot against the zone's need (fat-bound: ≥15 g fat OK, else ⚠ + advice; post-workout:
  protein threshold). Thresholds are named consts in the logic module.

## API contract changes (`api/feature/fuel/fuel.yml` — contract first)

- `GET /api/fuel/protocol` → `ProtocolViewResponse` gains
  `items: [{id, pantryItemId, slotKey, dose, pinned, placementSource, placementReason}]`.
  `dose` is the per-occurrence override; when null the FE falls back to the pantry item's
  default dose (item names always resolve on the FE from the pantry read, as today).
- **New** `POST /api/fuel/protocol/items` `{pantryItemId, slotKey?, dose?}` → 201 occurrence
  (no `slotKey` → engine places; with `slotKey` → user placement, pinned).
- **New** `PATCH /api/fuel/protocol/items/{id}` `{slotKey?, dose?, pinned?}` — move (sets
  `user`/pinned), dose edit, or `pinned:false` → engine re-places.
- **New** `DELETE /api/fuel/protocol/items/{id}`.
- **Removed:** `POST /api/fuel/protocol` (activate-with-version). Single-user app, FE+BE ship
  together — no compat shim.
- Intake API unchanged; the FE now always sends `slotKey` on `POST /api/fuel/intake`, and a
  day's tick state is keyed `(pantryItemId, slotKey)`. Legacy null-slot intakes match an item's
  first occurrence for display.

Mock mode mirrors all of it with cache mutators on the same shapes (occurrence-shaped seed).

## Data migration (Liquibase, `mezo-vx9v` changesets)

`protocol_item` + `slot_key`, `dose`, `pinned` (default false), `placement_source`,
`placement_reason` (+ the uq constraint). Existing rows keep `slot_key` NULL; `ProtocolService`
assigns missing placements lazily on first read (runs the engine, persists) so no data is
invented in SQL (seed-in-Java rule).

## Integrations

- **Mai timeline** (`useFuelTimeline`/`buildDayPlan`) and the **notification schedule
  writer/preview** currently consume `buildProtocol()`. Both switch to the same
  `projectStackDay()` output so the Stack page, the timeline and notifications can never
  disagree. `buildProtocol.ts`'s mock builder is retired.
- **Intake** flow (tick) unchanged server-side.
- **Docs in the same change:** `docs/features/fuel.md` (§Stack + hook table), an **ADR** for the
  living-protocol contract change (supersedes the "protocol persists ONLY selected ids + FE
  buildProtocol" decision), `_platform-notifications.md` if the writer's input shape changes.

## Out of scope

- P8/Phase-3: AI recommendations ("Mit hozzáadnék"), pattern-based reasoning prose, smart
  auto-split of high-dose items, context card revival.
- Weekly per-day-of-week protocol variants (the day projection already differentiates
  training/rest days; explicit per-weekday plans are YAGNI for now).
- Free-text (non-Kamra) stack items — the Kamra stays the single item source.

## Testing

- **Backend IT** (Testcontainers, populator pattern): rule-table placements for known items;
  flag-off fallback; occurrence CRUD incl. uq violation; unpin → re-place; lazy backfill on read.
- **FE vitest**: `projectStackDay` (training day, rest day, pinned fallback, skip badge);
  `matchMealsToStack` (suggestion ranking, verification thresholds); `FuelStackPage` +
  `StackItemSheet` in both modes (`pnpm test` + `VITE_USE_MOCK=true pnpm test`).
- Full suite runs in CI via the self-PR gate (local machine runs focused tests only).
