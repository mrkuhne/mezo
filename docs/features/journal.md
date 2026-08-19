---
title: Journal — Free-Prose Notes + Narrative Memory Embedding
type: feature-domain
status: done
updated: 2026-08-19
tags: [me, companion, backend, frontend, data-layer, phase-5]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/journal
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/JournalEmbeddingListener.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java
  - frontend/src/data/journal
  - frontend/src/features/me/sheets/JournalSheet.tsx
  - frontend/src/features/me/pages/JournalPage.tsx
  - api/feature/journal/journal.yml
related: [me, companion, _platform-data-layer, _platform-api-backend]
---

# Journal — Free-Prose Notes + Narrative Memory Embedding

> Free-prose journal entries, captured in two taps from either the global QuickInput sheet or the
> dedicated `/me/naplo` page, persisted in `journal_entry`, and embedded post-commit into the
> companion's `memory_embedding(kind=journal_entry)` vector store. **Status: ✅ done** (backend +
> FE real + FE mock). Lives under the `Me` tab (`ME_TABS` entry `journal`, `/me/naplo`) — see
> [`me.md`](me.md) §2 for the surface, this doc for the domain. bd `mezo-b3pp.1`, **W1.1 of the
> Phase 5 "deep memory & personalization" epic** (`mezo-b3pp`).

## 1. Summary

**Journal** is the first slice of Phase 5's W1 "narrative capture" wave: it gives Daniel a place to
write whatever is on his mind — no structure, no scoring, no engine reading it back yet — and feeds
that prose into the companion's episodic memory so a later chat can recall it. It deliberately does
**less** than it could: one free-text field, one optional date, no tags, no AI processing of the
entry itself. The value W1.1 ships is the **pipe**, not an app on top of it.

Two things ship together:
- **The `journal_entry` aggregate** (`feature/journal`) — a small, independent CRUD domain: create,
  ranged list (newest first), update (text and/or day), soft-delete. Own contract, own switch.
- **The embed seam into `feature/companion`** — every create/update/delete publishes a Spring
  event; a companion-owned `@Async AFTER_COMMIT` listener keeps the entry's vector row in
  `memory_embedding` in sync through the **existing single write path**,
  `MemoryEmbeddingWriter` (companion.md §"Embed pipeline" / §4). Journal never touches
  `memory_embedding` or `EmbeddingPort` itself — the memory write is entirely companion's.

Status per layer: **backend** ✅ (`feature/journal` — 1 table, `JournalService`, `JournalController`,
switch-gated; companion's `JournalEmbeddingListener` + `MemoryEmbeddingWriter.writeJournal`/
`.deleteJournalEmbedding`), **FE real** ✅ (`JournalSheet` create/edit/delete + `JournalPage` at
`/me/naplo`, both wired through `@/data/hooks`), **FE mock** ✅ (deterministic 5-note seed spanning
two months, dual-mode hooks). Driving design spec: [`2026-08-18-phase5-deep-memory-personalization-design.md`](../superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md)
§4.1 (data model), §4.3 (the `memory_embedding` kind expansion), §5.1 (W1.1 slice spec), §11
(cross-cutting conventions). Plan of record:
[`2026-08-18-w1-1-journal-embed-pipeline.md`](../superpowers/plans/2026-08-18-w1-1-journal-embed-pipeline.md).

## 2. User-facing behavior

Two entry points into the **same** `JournalSheet`, plus a dedicated read/manage page:

### QuickInput's „Napló" tile → a two-option picker
`QuickInputSheet`'s „Napló" tile used to jump straight into the activity log. It now opens an
in-place picker phase (`'naplo-pick'`, `QuickInputSheet.tsx:79-88`) titled **„Mit naplózol?"** with
two tiles: **„✍️ Aktivitás"** (unchanged — opens `ActivityLogSheet`, the XP-earning activity log)
and **„📓 Napló"** (opens `JournalSheet` in create mode). Both replace the picker in place — closing
either closes the whole QuickInput stack (`QuickInputSheet.tsx:61-63`).

### `JournalSheet` (`features/me/sheets/JournalSheet.tsx`) — create + edit + delete
One free-text `<textarea>` (no length cap, placeholder „Írd le, mi jár a fejedben…", autofocus) plus
an optional `<input type="date">` defaulting to today, plus a mic button reusing the shared
`useVoiceInput` hook (`features/insights/logic/useVoiceInput`, the `ChatPage` composer idiom — the
transcript is **appended** to whatever's already typed, not overwritten). Header eyebrow „Napló",
title „Mi jár a fejedben?" in create mode / „Bejegyzés szerkesztése" in edit mode (`entry` prop
set). CTAs „Mégse" / „Mentem" — save calls `addNote` (create) or `updateNote` (edit) then closes.
**Edit mode only** additionally offers **„Törlés"** behind a two-step confirm („Törlés" →
„Biztosan törlöd?", `var(--error)` styling, the `EditGoalSheet` idiom) → `removeNote`.

### `/me/naplo` — `JournalPage` (`features/me/pages/JournalPage.tsx`)
The read + manage surface, reached via the `Napló` tab in `ME_TABS` (right after `Growth`). Header
`Me · Napló` / `Napló` with a `+ Új bejegyzés` action opening `JournalSheet` in create mode. Entries
render **month-grouped, newest first** (`monthLabel` via `hu-HU` `{year, month: 'long'}`, the
`MemoryJournalPanel`/`GrowthJournalCard` idiom) over a **widening date window**: `monthsBack` starts
at 3 (this month + the two before), and a **„Korábbi hónapok"** ghost button at the list's foot
grows it by 3 more months per tap (`windowFrom`, pure integer month arithmetic — never a fresh
`new Date()` re-entry). Tapping any entry card reopens `JournalSheet` with `entry` set (edit mode).

**States:**
- **Loading** — three `SkeletonCard` rows under a `role="status"` „Betöltés…" landmark.
- **Genuine fetch failure** (`isError && notes.length === 0`) — `GhostState` „Nem sikerült betölteni
  a naplót." + „Újra" retry (distinguishes a real failure from an honest "not resolved yet" empty
  read — both would otherwise look like the same empty array).
- **Stale-but-present** (a refetch fails after a successful first load) — falls through to the
  normal list, not the retry state.
- **Empty window** — `GhostState` „Még nincs bejegyzés — kezdd a + gombbal." with the SAME
  „Korábbi hónapok" CTA as the footer (an empty *current* window and "no entries anywhere" render
  identically; widening covers both without stranding a user whose oldest entry sits outside the
  default 3-month window).

## 3. Architecture & data flow

```
QuickInputSheet 「Napló」→ picker → JournalSheet   (create, mock+real)
JournalPage (/me/naplo) → JournalSheet (entry=note) (edit/delete, mock+real)
  → useJournalNotes(from,to) / useJournalActions()   (@/data/hooks)
      mock: mockJournalNotes seed, filtered by range; mutations patch every open ['journal',from,to]
            cache entry whose OWN range covers the note (journalRangeQueries — Task 7's widening
            window means several ranges are live at once, mock's staleTime:Infinity keeps them all)
      real: journalApi → GET /api/journal?from&to | POST | PUT /{id} | DELETE /{id}
              → JournalController (implements JournalApi, JOURNAL_SWITCH-gated)
              → JournalService (create[occurredOn default today] / list / update / delete)
              → JournalEntryRepository → journal_entry (Postgres)
              → publishes JournalEntrySavedEvent (create+update) / JournalEntryDeletedEvent (delete)

              AFTER the transaction commits (separate async hop, companion-owned):
              → JournalEmbeddingListener (COMPANION_SWITCH + JOURNAL_SWITCH gated)
                  onJournalEntrySaved  → reload the live entry → MemoryEmbeddingWriter.writeJournal
                  onJournalEntryDeleted → MemoryEmbeddingWriter.deleteJournalEmbedding
              → memory_embedding (kind=journal_entry, one live row per entry id)
```

- **`useJournalNotes(from, to)`** (`data/journal/journalHooks.ts:32`) is a **`useDualQuery`** — mock
  filters `mockJournalNotes` synchronously by `occurredOn` range; real fetches
  `journalApi.list(from, to)` with `realEmpty: []`. Query key `['journal', from, to]`.
- **`useJournalActions()`** exposes `addNote`/`updateNote`/`removeNote` + `pending`. Real-mode
  mutations `invalidateQueries({ queryKey: ['journal'] })` on success. Mock-mode mutations are the
  interesting half: because `JournalPage`'s widening window means **several** `['journal', from, to]`
  cache entries can be alive simultaneously, a blanket `setQueriesData` would leak a note into a
  range it doesn't belong to — `journalRangeQueries` (`journalHooks.ts:14-22`) walks the query cache
  directly and applies a per-entry range check before `setQueryData`, and `insertByOccurredOnDesc`
  (`journalHooks.ts:26-30`) keeps each patched list sorted.
- **The embed hop is a genuinely separate transaction and thread.** `JournalService`'s
  `create`/`update`/`delete` publish the event synchronously but the listener only reacts
  `@TransactionalEventListener(phase = AFTER_COMMIT)` + `@Async` — a journal write's latency and
  success are completely unaffected by whether the companion switch is on, the listener is slow, or
  the embed call fails (failures are logged and swallowed, `JournalEmbeddingListener.java:37-45,
  48-56`). This is the same fire-and-forget idiom `TurnEmbeddingListener` and biometrics'
  `CompanionMessageEventListener` already use ([`companion.md`](companion.md), [`me.md`](me.md)
  §5.9) — `feature/journal` has **no import of `feature/companion`**; the dependency runs the other
  way (companion imports `JournalEntryEntity`/`JournalEntryRepository`/the two event records).

## 4. Data model & API

### Backend table

Migration [`202608181600_mezo-b3pp.1_create_journal_entry.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202608181600_mezo-b3pp.1_create_journal_entry.sql)
(registered in `1.0.0_master.yml`):

- **`journal_entry`** — `id uuid pk (gen_random_uuid())`, `created_by uuid fk→app_user ON DELETE
  CASCADE`, `is_deleted`, `created_at timestamptz`, `occurred_on date not null` (the day the entry
  is ABOUT, not when it was written — defaults to today server-side when the client omits it),
  `text text not null` (free prose, no length cap), `source varchar(12) not null`
  (`ck_journal_entry_source IN ('quickinput','ritual')` — `ritual` is reserved for a later W1
  slice's Napzárás capture, unused by W1.1 itself); index
  `idx_journal_entry_created_by_occurred_on (created_by, occurred_on desc)`.

`JournalEntryEntity` (`entity/JournalEntryEntity.java`) `extends OwnedEntity`, `@SQLDelete`/
`@SQLRestriction` soft delete, constants `SOURCE_QUICKINPUT`/`SOURCE_RITUAL`. Repository
(`repository/JournalEntryRepository.java`) two derived finders:
`findByIdAndCreatedByAndDeletedFalse` (the owned-lookup-or-404 idiom) and
`findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc` (the ranged
list, newest-first by day then by creation time within a day).

### The `memory_embedding` kind expansion (rides in this slice, spec §4.3)

Migration [`202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql)
widens `ck_memory_embedding_kind` from the V2.2-era `chat_turn|daily_summary|weekly_summary` to ten
values: `chat_turn, daily_summary, weekly_summary, monthly_summary, journal_entry, reflection,
gratitude, decision, activity_note, checkin_note`. **Only `journal_entry` is populated as of W1.1**
— `MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY` is the sole new constant/writer method; the other six
new kinds are schema headroom the rest of the Phase 5 W1 wave will fill (§5 below). The `(kind,
ref_id)` uniqueness and the single `MemoryEmbeddingWriter` write path are unchanged by design — see
[`companion.md`](companion.md) §4 for the full `memory_embedding` table shape.

### API (contract-first, [`api/feature/journal/journal.yml`](../../api/feature/journal/journal.yml), tag `Journal` → `JournalApi`, `JournalController implements JournalApi`, gated `mezo.feature.journal.enabled` — off ⇒ the whole `/api/journal` surface 404s and no journal beans exist)

| Method + path | Operation | Returns | Errors |
|---|---|---|---|
| `GET /api/journal?from&to` | `listJournalEntries` | `JournalEntryResponse[]`, newest first | 401 |
| `POST /api/journal` (`{text, occurredOn?, source}`) | `createJournalEntry` | `JournalEntryResponse` (201) | 400 (blank text / bad `source`) |
| `PUT /api/journal/{id}` (`{text, occurredOn?}`) | `updateJournalEntry` | `JournalEntryResponse` (200) | 400; 404 `JOURNAL_ENTRY_NOT_FOUND` |
| `DELETE /api/journal/{id}` | `deleteJournalEntry` | 204 (soft delete) | 404 `JOURNAL_ENTRY_NOT_FOUND` |

`source` is a **`pattern`**, not an `enum`, on the two request DTOs (`api_contract_conventions.md`
rule — an invalid value must 400, not 500); the response DTO's `source` is a real enum. Errors go
through `SystemRuntimeErrorException` + `SystemMessage`
(`JOURNAL_ENTRY_NOT_FOUND=A naplóbejegyzés nem található.` in `messages.properties:83`) per
[`error_handling.md`](../references/error_handling.md). `JournalService.findOwned` is the single
404 site (`service/JournalService.java:76-80`), reused by both `update` and `delete`.

### FE domain type + wire mapping

`JournalNote` (`data/journal/journalTypes.ts`) — `{id, occurredOn, text, source: 'quickinput' |
'ritual', createdAt}`. Named `JournalNote`, **deliberately not** `JournalEntry` — two unrelated
`JournalEntry` types already exist (`features/me/logic/growthJournal.ts`,
`features/insights/logic/patternHistory.ts`). `journalApi.ts` maps the generated `paths['/api/journal']`
wire types via `toJournalNote`; the mock seed (`journalMock.ts`, `mockJournalNotes`) is 5 Hungarian
entries spanning the current and previous month so month-grouping is visible in mock mode.

### Config

- **Switch:** `mezo.feature.journal.enabled` (`FeaturesConfiguration.JOURNAL_SWITCH`,
  `techcore/configuration/FeaturesConfiguration.java:179`) gates `JournalService` + `JournalController`
  **and** `JournalEmbeddingListener` (jointly with `COMPANION_SWITCH`) — off ⇒ `/api/journal` 404s,
  no journal beans exist, and the listener bean is absent so no journal embed call can ever happen.
- **`CompanionProperties.Journal`** (`feature/companion/config/CompanionProperties.java:204-207`) —
  `@Positive int decisionReviewDays` (default 30, `mezo.companion.journal.decision-review-days` in
  `application.yml:817-818`). **Not consumed by anything in W1.1** — the record exists so W1.4's
  decision journal (`decision_entry.review_due` default offset, spec §5.4) has its config knob
  landed early rather than added as a later migration-adjacent change.

## 5. Integrations

- **→ Companion (embed pipeline, wired, one-way OUT):** every journal write feeds
  `memory_embedding` through the seam in §3 above. **Contract crossing the seam:** the two event
  records `JournalEntrySavedEvent{userId, entryId}` / `JournalEntryDeletedEvent{userId, entryId}`
  (`feature/journal/service/`) — plain Spring `ApplicationEvent`s, no direct method call, so
  `feature/journal` has zero compile-time dependency on `feature/companion`. See
  [`companion.md`](companion.md) for the consuming side (`JournalEmbeddingListener`,
  `MemoryEmbeddingWriter.writeJournal`/`.deleteJournalEmbedding`) and the ArchUnit
  `feature_slices_are_cycle_free` guard this keeps satisfied (companion → journal is allowed, the
  reverse is not).
- **← QuickInput (wired):** the global `QuickInputSheet` „Napló" tile is journal's other write
  entry point, alongside `Me`'s own `+ Új bejegyzés`. See §2.
- **↔ Me (wired, hosting):** `/me/naplo` is a `ME_TABS` tab; `JournalSheet`/`JournalPage` live under
  `frontend/src/features/me/` even though the journal **domain** (types/hooks/API client) has its
  own `data/journal/` module — the same "hosted in Me, owned by its own data module" shape
  `growth.md` uses for the Growth page's history reads. See [`me.md`](me.md) §2 (`Napló`
  subsection) / §5.
- **🟣 Future W1 slices reuse this exact seam, not a new one (spec §5.2–§5.5):** W1.2 (evening
  prose reflection in Napzárás, `mezo-b3pp.2`) embeds `kind=reflection` off `ritual_day` on close;
  W1.3 (gratitude entries, `mezo-b3pp.3`) adds `gratitude_entry` in the **same** `feature/journal`
  package and embeds `kind=gratitude`; W1.4 (decision journal + review loop, `mezo-b3pp.4`) adds
  `decision_entry` (server-captured context snapshot) and embeds `kind=decision` on create **and**
  re-embeds on review; W1.5 (note-embedding catch-up, `mezo-b3pp.5`) extends the nightly
  `DailySummaryJob` sweep to embed `activity_log`/check-in notes as `kind=activity_note`/
  `checkin_note`. Every one of these is "a new `write<Kind>` method on `MemoryEmbeddingWriter`, not
  a second writer" (spec §4.3) — the CHECK constraint this slice widened already has room for all
  six.

## 6. How to use it (consume)

```ts
import { useJournalNotes, useJournalActions } from '@/data/hooks'

const { data: notes, isPending, isError, refetch } = useJournalNotes(from, to)  // JournalNote[]
const { addNote, updateNote, removeNote, pending } = useJournalActions()

await addNote('Ma jó napom volt.')                 // occurredOn defaults to today
await addNote('Késői bejegyzés', '2026-07-01')      // explicit day
await updateNote(note.id, 'Javított szöveg')        // day unchanged
await removeNote(note.id)                            // soft delete
```

- Never import `journalApi`/`mockJournalNotes` directly — go through `@/data/hooks` (barrel line
  `data/hooks.ts:60`).
- `useJournalNotes` needs both `from`/`to` bounds — there is no "all time" read; `JournalPage`'s
  widening-window pattern (§2) is the reference for a bounded-but-growing view.
- Ghost-guard obligation mirrors every other dual-mode list read: `isPending` → loading state,
  `isError && data.length === 0` → real-failure state (distinct from a genuinely empty range), else
  render the data (§2 "States").

## 7. How to extend it

- **A new journal-adjacent entry kind in the SAME domain** (the W1.3 gratitude / W1.4 decision
  pattern) — contract-first ([`api_contract_conventions.md`](../references/api_contract_conventions.md),
  a new path under `api/feature/journal/journal.yml` or a sibling fragment) → a new
  entity/repository/service method in the **same** `feature/journal` package
  ([`java_package_structure.md`](../references/java_package_structure.md)) → migration
  ([`liquibase_conventions.md`](../references/liquibase_conventions.md), remember the
  `ResetDatabase` TRUNCATE list — `journal_entry` is already in it,
  `support/ResetDatabase.java:41`) → publish the equivalent Saved/Deleted event pair → a new
  `write<Kind>`/`delete<Kind>Embedding` pair on `MemoryEmbeddingWriter` + a new
  `<Kind>EmbeddingListener` mirroring `JournalEmbeddingListener` exactly (companion-owned, gated on
  `COMPANION_SWITCH` + the new feature's own switch) → dual-mode FE hook
  (`useDualQuery` recipe in [`_platform-data-layer.md`](_platform-data-layer.md)) → both
  `pnpm test` modes green.
- **A new field on `journal_entry` itself** — same contract-first → backend → migration →
  dual-mode-hook → both-modes-green order; mirror the field in `journalMock.ts` so mock parity
  holds.
- **A new tunable** → extend `CompanionProperties.Journal` or add a sibling `JournalProperties` under
  `mezo.feature.journal.*`, never a code constant
  ([`configuration_conventions.md`](../references/configuration_conventions.md)).

## 8. Testing

- **Backend ITs** (`feature/journal/`, extend `ApiIntegrationTest`/`AbstractIntegrationTest` + real
  Postgres; data via `support/populator/JournalPopulator`, `journal_entry` in `ResetDatabase`):
  - `JournalEntryPersistenceIT` — round-trip create, newest-first range ordering across days, the
    `ck_journal_entry_source` CHECK rejecting an unknown value.
  - `JournalApiIT` — 201 with defaulted `occurredOn`, 400 on blank text / unknown `source`,
    newest-first ranged list, update (text changes, day preserved when omitted), 404 on
    not-own-entry, soft-delete vanishing from the list.
  - `JournalSwitchOffIT` — both GET and POST 404 with `mezo.feature.journal.enabled=false`.
  - `JournalEmbeddingEventIT` (`@ActiveProfiles("companion-fake")`, NOT `@Transactional` — the
    AFTER_COMMIT hop must be real, awaited via Awaitility) — a committed create produces **exactly
    one** `memory_embedding(kind=journal_entry)` row; an update re-embeds (content changes, still
    one row); a delete removes the embedding.
  - Journal cases folded into the existing `MemoryEmbeddingWriterIT` (`companion-fake` profile):
    `testWriteJournal_shouldPersistJournalUnit_whenNewEntry`,
    `testWriteJournal_shouldReembedInPlace_whenEntryEdited` (same row id, fresh vector + content),
    `testDeleteJournalEmbedding_shouldSoftDeleteRow_whenPresent`.
- **FE** (both modes green): `data/journal/journalHooks.test.tsx` (dual-mode read + the
  range-scoped mock mutations); `features/me/sheets/JournalSheet.test.tsx` (create saves via
  `addNote`; edit prefills + calls `updateNote`; delete needs the second confirm tap); the
  `features/quickinput/sheets/QuickInputSheet.test.tsx` picker-phase tests (the „Napló" tile opens
  „Mit naplózol?"; picking „Aktivitás"/„Napló" swaps to the respective sheet without closing the
  stack); `features/me/pages/JournalPage.test.tsx` (month-separator grouping, edit-on-tap, the add
  button, the empty/loading/error states, the widening „Korábbi hónapok" CTA including the
  empty-but-widenable case); `data/hooks.reexport.test.ts` + `features/me/pages/MeSection.test.tsx`
  (barrel identity + the `Napló` tab label in the sub-nav loop).
- **Gate:** `cd backend && ./mvnw clean test -Dtest='JournalEntryPersistenceIT,JournalApiIT,JournalSwitchOffIT,JournalEmbeddingEventIT,MemoryEmbeddingWriterIT'`
  (ALWAYS `clean` — Lombok+MapStruct incremental compile is flaky); `cd frontend && pnpm build &&
  pnpm test && VITE_USE_MOCK=true pnpm test`.

## 9. Decisions, gotchas & deferred

- **Decision — update-in-place re-embed, not delete+insert (spec deviation, mechanical not
  design).** Spec §5.1 describes edits re-embedding via "delete+insert on the `(kind, ref_id)`
  key". `uq_memory_embedding_kind_ref_id` spans **soft-deleted** rows (the index has no
  `where is_deleted = false` partial clause), so a soft-delete-then-insert on the same key would
  violate the unique constraint, and a hard delete would break the soft-delete-everywhere rule.
  `MemoryEmbeddingWriter.writeJournal` (`embedding/MemoryEmbeddingWriter.java:117-133`) instead
  looks up the live row by `(kind, ref_id)` and, if present, updates its `content`/`embedding`/
  `occurred_on` in place — same effect (fresh vector describing the edited text), same key, no
  constraint conflict. First write still inserts via the shared `write` helper.
- **Decision — the embed tag stays the generic `embed_memory`/`document`, `entityKind=journal_entry`
  is the discriminator (spec §11 single-writer rule).** The spec names a possible per-feature
  `journal` LLM-call tag; W1.1 has no journal-specific LLM call to tag (the embed call rides
  `MemoryEmbeddingWriter`'s existing `LlmCallContext("embed_memory", "document", kind, refId)` —
  `MemoryEmbeddingWriter.java:123-125`) — one write path, one tag family, `kind` is the only new
  axis.
- **Gotcha — `source=ritual` exists in the CHECK/entity but nothing sets it yet.** W1.1 always
  writes `SOURCE_QUICKINPUT` (both the QuickInput sheet's `create` call and the Me page's `+ Új
  bejegyzés` hardcode `source: 'quickinput'` client-side, `journalApi.ts:26`). `ritual` is reserved
  for a later slice's Napzárás-originated capture — do not repurpose it for anything else.
  `JournalSheet` never lets the caller choose a `source`.
- **Gotcha — the six new `memory_embedding` kinds are unused schema, not dead weight.** Don't add a
  "why does the CHECK allow kinds nothing writes" cleanup task — `reflection`/`gratitude`/
  `decision`/`monthly_summary`/`activity_note`/`checkin_note` are load-bearing headroom for W1.2–W1.5
  (§5), landed in one migration per spec §4.3's explicit instruction ("W1.1 carries the first
  batch") to avoid five more `alter table … drop constraint / add constraint` migrations later.
- **Deferred (spec §5.2–§5.5, bd ids assigned, not started):** evening prose reflection
  (`mezo-b3pp.2`), gratitude entries (`mezo-b3pp.3`), decision journal + review loop
  (`mezo-b3pp.4`), note-embedding catch-up for activity/check-in text (`mezo-b3pp.5`). None of
  these need a NEW embed pipeline — see §5 above.

## 10. Key files

**API contract**
- `api/feature/journal/journal.yml` — 4 endpoints (tag `Journal` → `JournalApi`), registered in
  `api/generate/merge.yml` → merged `api/openapi.yml` (bumped to 0.5.0) → `api.gen.ts` +
  `io.mrkuhne.mezo.api.*`.

**Backend — journal domain**
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/entity/JournalEntryEntity.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/JournalEntryRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/{JournalService,JournalEntrySavedEvent,JournalEntryDeletedEvent}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/mapper/JournalMapper.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/controller/JournalController.java`
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java:177-179` — `JOURNAL_SWITCH`.
- `backend/src/main/resources/application.yml:258-262` — `mezo.feature.journal.enabled`; `:815-818` — `mezo.companion.journal.decision-review-days`.
- `backend/src/main/resources/messages.properties:83` — `JOURNAL_ENTRY_NOT_FOUND`.

**Backend — embed pipeline (companion-owned)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/JournalEmbeddingListener.java` — the AFTER_COMMIT trigger.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java:114-141` — `writeJournal`/`deleteJournalEmbedding`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java` — `findByKindAndRefId` (the update-in-place lookup).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java:44-58` — `KIND_JOURNAL_ENTRY` + the widened `kind` `@Pattern`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java:203-207` — the `Journal` record.

**Backend — migrations**
- `backend/src/main/resources/db/changelog/1.0.0/script/202608181600_mezo-b3pp.1_create_journal_entry.sql`
- `backend/src/main/resources/db/changelog/1.0.0/script/202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql`
- `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml:696-708` — both changeSets registered.

**Backend — tests**
- `backend/src/test/java/io/mrkuhne/mezo/feature/journal/{JournalEntryPersistenceIT,JournalApiIT,JournalSwitchOffIT,JournalEmbeddingEventIT}.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriterIT.java` — journal cases (`testWriteJournal_*`, `testDeleteJournalEmbedding_*`).
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/JournalPopulator.java` + `support/ResetDatabase.java:41` (`journal_entry` in the TRUNCATE list).

**Frontend — data layer**
- `frontend/src/data/journal/journalTypes.ts` — `JournalNote`.
- `frontend/src/data/journal/journalApi.ts` — `journalApi` + `toJournalNote` wire mapper.
- `frontend/src/data/journal/journalMock.ts` — `mockJournalNotes` (5-entry seed).
- `frontend/src/data/journal/journalHooks.ts` — `useJournalNotes`/`useJournalActions` + the mock range-scoped mutation helpers.
- `frontend/src/data/hooks.ts:60` — barrel re-export.
- `frontend/src/test/msw/handlers.ts:1241-1265` — journal MSW fixtures.

**Frontend — UI**
- `frontend/src/features/me/sheets/JournalSheet.tsx` — create/edit/delete sheet.
- `frontend/src/features/me/pages/JournalPage.tsx` — `/me/naplo`, month-grouped read/manage view.
- `frontend/src/features/me/pages/tabs.ts:11` — `ME_TABS` `journal` entry.
- `frontend/src/app/router.tsx:50,155` — `JournalPage` import + `naplo` child route.
- `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx:22,63,79-88` — the two-option picker phase.

**Frontend — tests**
- `frontend/src/data/journal/journalHooks.test.tsx`
- `frontend/src/features/me/sheets/JournalSheet.test.tsx`
- `frontend/src/features/me/pages/JournalPage.test.tsx`
- `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx` (picker-phase cases)
- `frontend/src/data/hooks.reexport.test.ts` + `frontend/src/features/me/pages/MeSection.test.tsx` (barrel identity + tab label).

**Docs**
- Design spec: [`docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`](../superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md) §4.1, §4.3, §5.1, §11.
- Plan: [`docs/superpowers/plans/2026-08-18-w1-1-journal-embed-pipeline.md`](../superpowers/plans/2026-08-18-w1-1-journal-embed-pipeline.md).
- Roadmap: [`docs/milestones/roadmap.md`](../milestones/roadmap.md).
- References: [`docs/references/`](../references/) (`api_contract_conventions`, `liquibase_conventions`, `spring_patterns`, `testing_standards`, `configuration_conventions`, `java_package_structure`, `error_handling`).
