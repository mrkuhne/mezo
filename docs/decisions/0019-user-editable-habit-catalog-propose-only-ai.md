# 0019 — User-editable habit catalog in DB; AI suggestions are propose-only

- **Status:** Accepted
- **Date:** 2026-08-05
- **Driver:** `mezo-n5e9` (epic) / `mezo-n5e9.1` (this backend slice)

## Context

The habit engine ([`habit.md`](../features/habit.md), spec
[`2026-07-19-morning-evening-routine-habit-engine-design.md`](../superpowers/specs/2026-07-19-morning-evening-routine-habit-engine-design.md)
D1/D2) shipped v1 with a **fixed** catalog: 15 `HabitDef`s across two chains (MORNING/EVENING),
loaded fail-fast from `content/habit-catalog.json` and never persisted — that ADR-less v1 decision
worked because nothing edited the catalog. The data model was deliberately kept general
(chain/position/anchor/mode/metric) specifically so this moment wouldn't require a redesign
(spec §10, the deferred "custom/user-edited habits + catalog-management UI" sub-project).

The routine editor (design spec
[`2026-08-05-routine-editor-design.md`](../superpowers/specs/2026-08-05-routine-editor-design.md),
D1–D8) turns that catalog user-editable — rename/reorder/toggle/re-XP built-ins, add custom
habits and whole new chains, and (child `.3`, not yet built) let an LLM suggest routines from the
user's skills/goals. Two decisions from that spec needed to be durable ADR material rather than
buried in a dated design doc: how the catalog is stored (D1/D2/D3), and how far the AI is allowed
to reach into it (D7). This ADR covers what `.1` (this backend slice) actually shipped; `.2` (the
editor page) and `.3` (the AI suggester) are still to come.

## Decision

**(a) Full DB catalog, JSON demoted to a seed, lazy per-user bootstrap, keys stable, deletions
never resurrected.**

- Two new tables, `habit_chain` and `habit_def`
  (migrations
  [`202608051400_mezo-n5e9.1_create_habit_chain.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202608051400_mezo-n5e9.1_create_habit_chain.sql) /
  [`202608051410_mezo-n5e9.1_create_habit_def.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202608051410_mezo-n5e9.1_create_habit_def.sql)),
  own the catalog per-user (`created_by`, partial-unique `(created_by, chain_key|habit_key) where
  is_deleted = false`, named `pk_`/`fk_`/`ck_`/`idx_` constraints, `created_by → app_user(id) on
  delete cascade` — the house pattern, copied from `habit_day`'s own migration). `HabitDefEntity`
  additionally FKs `chain_id → habit_chain(id)`.
- `HabitCatalog` (the JSON loader) is **demoted to a seed source**: it still loads + validates
  `content/habit-catalog.json` fail-fast at startup, but nothing reads it at request time anymore
  (`HabitCatalog.java:14-20`). The runtime catalog is `HabitCatalogService`
  (`backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitCatalogService.java`):
  `ensureCatalog(userId)` lazily imports the two seed chains + any seed def the user never had,
  `byKey`/`activeForChainKey`/`chains` serve reads. There is no startup importer — startup has no
  user context — so bootstrap is a **per-user, lazy, idempotent** operation, the same
  `ensureRows`-under-a-unique-index-race idiom `habit_day` already uses
  (`HabitCatalogService.java:47-53`, `DataIntegrityViolationException` catch on a lost race).
- **Never-resurrect is load-bearing, not incidental.** `@SQLRestriction` rewrites JPQL/derived
  queries but not native SQL, so a single native probe —
  `HabitDefRepository.findAllKeysEver` (`HabitDefRepository.java:29`) — returns every `habit_key`
  a user ever had, live or soft-deleted, in one query; `bootstrapMissing` diffs the seed list
  against that set (`HabitCatalogService.java:92-95`). A key present in the deleted-inclusive set
  is skipped even though `findByCreatedByAndDeletedFalse*` can no longer see it — soft-deleting a
  seed habit is permanent per user. This replaced an earlier per-def native `COUNT` probe (an
  O(seed-size) query fan-out flagged in review) with the single bulk query, and deliberately has
  **no "skip everything if any def exists" short-circuit** — every seed def is still checked
  individually against the set, so a future addition to `habit-catalog.json` still imports for
  existing users on their next touch, it just never un-deletes what they removed.
- **Keys are the stable join**, unchanged from D2 of the 2026-07-19 spec: `habit_day.habit_key`
  keeps working as-is. Built-in keys never change; user-created rows get server-generated
  `custom_<8-hex>` / `chain_<8-hex>` keys (`HabitAdminService.generateKey`,
  `HabitAdminService.java:244-246`) — the client never invents or chooses a key, closing off key
  collisions and enumeration guessing.
- **No cron-side bootstrap.** The nightly `HabitJob`'s `closePast` is a poor place to materialize
  a catalog for a user who has never touched habits — it would write two chains + fifteen defs for
  every dormant account, every night, for nothing. `closePast` now checks for stale `habit_day`
  rows *first* and returns with zero writes if there are none; only a user with actual stale rows
  triggers `ensureCatalog` (`HabitService.java:172-178`, asserted by
  `HabitCatalogBootstrapIT.testClosePast_shouldNotBootstrapCatalog_whenUserHasNoHabitDayRows`).
  `getDay`/`check`/`uncheck`/the admin endpoints still bootstrap on touch, same as before —
  `summary` does not (see Consequences: it's read-only, and `getDay` is the bootstrap point).

**(b) The AI suggester (child `.3`, not built yet) is propose-only — it never writes.** Per D7 of
the routine-editor spec, the upcoming `POST /api/habit/ai/suggest` will run a second `ChatClient`
against a strict-JSON schema and return suggestion cards; accepting one calls the **normal**
`POST /api/habit/def` — the same validation, the same generated key, the same write path a human
edit takes. The model has no direct persistence path and no elevated write endpoint of its own.
This is a discipline decision to make now, before `.3` exists: whatever `.3` builds, the model
proposes and the existing create endpoint decides, per the fact-extraction pipeline's own
precedent of routing model output through ordinary validated writes rather than a bespoke ingest
path.

## Consequences

- **The loader's fail-fast invariants become write-time validation.** v1's `HabitCatalog` loader
  enforced chain/mode membership, `skillKind == LIFE`, `5 ≤ xp ≤ 15`, and MANUAL ⇔
  `metric == "manual"` once, at startup, over a file nobody could touch at runtime. Those same
  invariants are now enforced per-write in `HabitAdminService`: `resolveMetric`
  (`HabitAdminService.java:206-218`) forces `metric = "manual"` for MANUAL defs and rejects it for
  DERIVED (`HABIT_MODE_METRIC_MISMATCH`), and requires the metric be one of
  `HabitEvaluator.SUPPORTED_METRICS` (`HABIT_METRIC_UNKNOWN`) — the union of `INTRADAY_METRICS`,
  `END_OF_DAY_METRICS` and `METRIC_BED_NEXT_DAY` (`HabitEvaluator.java:70-76`), i.e. exactly D4's
  "enumerated palette of existing evaluator metrics, no user-defined evaluators". The XP band and
  chain-existence checks moved the same way (`HABIT_DEF_UNKNOWN_CHAIN`, the DB `ck_habit_def_xp`
  constraint as the last line of defense). A malformed row can no longer be caught at boot — every
  admin write is now the enforcement point, and it has to stay that way as `.2`/`.3` add more
  entry points.
- **`HabitResponse.chain` is a string, not the old two-value enum.** `api/feature/habit/habit.yml`
  widened `chain` from `enum: [MORNING, EVENING]` to a plain `string` (the seed chains still emit
  the literal values `"MORNING"`/`"EVENING"` on the wire, so this is behavior-identical for
  existing consumers); `HabitMapper.toResponse` now assigns the chain key directly instead of
  going through `HabitResponse.ChainEnum.fromValue` (`HabitMapper.java:32`). Custom chains get
  server-generated `chain_<hex>` keys that would never fit a closed enum. The frontend's own
  `HabitChain` type (`frontend/src/data/types.ts:924`) is untouched — it still declares
  `'MORNING' | 'EVENING'` and `habitApi.ts` casts the wire string into it — so the FE-visible
  surface of this slice is exactly that one widened field, and nothing else observably changed;
  the FE will need to widen its own type once `.2` lets a user see a custom chain's rows.
- **Chains carry a `daypart`** (`MORNING`\|`DAY`\|`EVENING`, `ck_habit_chain_daypart`) that has no
  reader yet — Today still buckets rows via the FE's hardcoded `CHAIN_FACE` map
  ([`habit.md` §3](../features/habit.md)). `.2` is where `todayItems.ts` switches to reading this
  column instead, per the routine-editor spec §5 — this ADR just records that the column exists
  and is already populated correctly for the two seed chains (Reggeli → `MORNING`, Esti →
  `EVENING`) so `.2` has nothing to backfill.
- **The 8 admin endpoints are real but still developer/API-only.** `GET /api/habit/catalog`,
  chain `POST`/`PATCH`/`DELETE`/`PUT .../order`, def `POST`/`PATCH`/`DELETE` are live behind
  `HABIT_SWITCH` (`HabitController.java`, `HabitAdminService.java`) and covered by
  `HabitAdminApiIT`, but there is no `.1`-scope UI: the routine editor page itself is `.2`. Seed
  chains (`MORNING`/`EVENING`) reject `DELETE` with `HABIT_CHAIN_SEED`
  (`HabitAdminService.java:98-100`) — they can be edited (title, position, active) but not
  removed, since Today's face-bucketing precedent still assumes they exist.
- **What this doesn't change:** `habit_day`, `HabitEvaluator`'s honest-derivation rules, the
  XP/progression tail, and every existing Today/Growth surface are byte-for-byte the same — the
  catalog swap is purely underneath `HabitService`/`HabitMapper`, which is the point of the
  original general data model.
- **`HabitService#summary` is read-only and non-bootstrapping** (mezo-n5e9.1 review finding 3): it
  used to call `ensureCatalog` (twice), materializing 17 catalog rows for any user whose summary
  was read — including every companion chat turn, since `ContextSnapshotAssembler`/`PracticeTools`
  call `summary` on each one. A user who has never touched habits now gets an honest empty/zero
  summary instead; `getDay` (the Today read) remains the one true bootstrap point, same as every
  other read/write path above.

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Hybrid JSON + per-user override table (JSON stays canonical, a thin overrides table patches title/xp/active) | Two sources of truth for one concept; the editor's whole point is that the user's edits *are* the catalog, not a diff against one they can't see or fully control. Rejected in the spec (D1). |
| Eager startup bootstrap (materialize every registered user's catalog on boot) | Startup has no per-user context in this single-tenant-per-row model, and would front-load work for accounts that may never touch habits — the same reasoning that later killed cron-side bootstrap. |
| Companion-chat writer tool for AI habit suggestions ("vegyél fel egy esti rutint" in chat) | Would be the first writing `@Tool` in the companion surface, needing its own guardrail design; deferred to a separate effort, kept out of `.3`'s scope (spec §8). Editor-embedded propose-only ships first. |
