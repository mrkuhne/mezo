---
title: Journal — Free-Prose Notes + Narrative Memory Embedding
type: feature-domain
status: done
updated: 2026-08-21
tags: [me, companion, backend, frontend, data-layer, phase-5]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/journal
  - backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/DecisionService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/JournalEmbeddingListener.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/DecisionEmbeddingListener.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DecisionContextAssemblerAdapter.java
  - frontend/src/data/journal
  - frontend/src/features/me/sheets/JournalSheet.tsx
  - frontend/src/features/me/sheets/DecisionReviewSheet.tsx
  - frontend/src/features/me/pages/JournalPage.tsx
  - api/feature/journal/journal.yml
related: [me, companion, _platform-data-layer, _platform-api-backend, _platform-notifications]
---

# Journal — Free-Prose Notes + Narrative Memory Embedding

> Two aggregates in one domain: free-prose `journal_entry` notes (W1.1, `mezo-b3pp.1`), captured in
> two taps from either the global QuickInput sheet or the dedicated `/me/naplo` page; and
> `decision_entry` decisions + their later review (W1.4, `mezo-b3pp.4`), captured via the same
> `JournalSheet` in a „Döntés" mode. Both persist server-side and embed post-commit into the
> companion's `memory_embedding` vector store (`kind=journal_entry` / `kind=decision`).
> **Status: ✅ done** (backend + FE real + FE mock, all three aggregates). Lives under the `Me` tab
> (`ME_TABS` entry `journal`, `/me/naplo`) — see [`me.md`](me.md) §2 for the surface, this doc for
> the domain. **W1.1 + W1.4 of the Phase 5 "deep memory & personalization" epic** (`mezo-b3pp`).
> **W1.3 (gratitude entries, `mezo-b3pp.3`) is also ✅ done** — a third aggregate in the same
> package with `kind=gratitude` embedding, capture via `JournalSheet` gratitude mode and QuickInput
> Hála tile, and a derived streak card on `/me/naplo`. Ritual `ReflectionStep` gratitude rows
> 🟣 deferred to W1.3b (W1.2 unmerged).

## 1. Summary

**Journal** is the narrative-capture domain of Phase 5's W1 wave. It now holds two aggregates that
ship the **same** embed pipeline twice over:

- **`journal_entry`** (W1.1, `mezo-b3pp.1`) — free prose, no structure, no scoring: one free-text
  field, one optional date, no tags, no AI processing of the entry itself. The value W1.1 shipped is
  the **pipe**, not an app on top of it.
- **`decision_entry`** (W1.4, `mezo-b3pp.4`) — a decision captured **with its context frozen at the
  moment of the decision** (server-side, never client-supplied, never returned over the wire) and a
  later, optional review that records how it played out. Where `journal_entry` is unstructured
  reflection, `decision_entry` is a lightweight decision journal + review loop: capture now, get
  reminded later, look back honestly.

Three things ship together (the first two from W1.1, the third added by W1.4):
- **The `journal_entry` aggregate** (`feature/journal`) — a small, independent CRUD domain: create,
  ranged list (newest first), update (text and/or day), soft-delete. Own contract, own switch.
- **The embed seam into `feature/companion`** — every create/update/delete publishes a Spring
  event; a companion-owned `@Async AFTER_COMMIT` listener keeps the entry's vector row in
  `memory_embedding` in sync through the **existing single write path**,
  `MemoryEmbeddingWriter` (companion.md §"Embed pipeline" / §4). Journal never touches
  `memory_embedding` or `EmbeddingPort` itself — the memory write is entirely companion's.
- **The `decision_entry` aggregate** (`feature/journal`, same package, `DecisionService`) — create
  (server-captures the context snapshot + defaults `reviewDue`), list (newest-first, no params),
  review (stamps the outcome, re-runnable). Own `DecisionEntrySavedEvent` → `DecisionEmbeddingListener`
  → `MemoryEmbeddingWriter.writeDecision` seam, mirroring `journal_entry`'s exactly, plus a
  `decision_review` push category ([`_platform-notifications.md`](_platform-notifications.md) §4) that
  reminds Daniel on the decision's own `review_due` day.

Status per layer: **backend** ✅ (`feature/journal` — 2 tables, `JournalService`/`DecisionService`,
one `JournalController` implementing both, switch-gated; companion's `JournalEmbeddingListener`/
`DecisionEmbeddingListener` + `MemoryEmbeddingWriter.writeJournal`/`.writeDecision`/
`.deleteJournalEmbedding`), **FE real** ✅ (`JournalSheet` create/edit/delete + Döntés capture mode +
`JournalPage` at `/me/naplo` with its open-decisions block + `DecisionReviewSheet`, all wired through
`@/data/hooks`), **FE mock** ✅ (deterministic seeds for both aggregates, dual-mode hooks). Driving
design spec: [`2026-08-18-phase5-deep-memory-personalization-design.md`](../superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md)
§4.1 (data model), §4.3 (the `memory_embedding` kind expansion), §5.1 (W1.1 slice spec), §5.4 (W1.4
decision-journal slice spec), §11 (cross-cutting conventions). Plans of record:
[`2026-08-18-w1-1-journal-embed-pipeline.md`](../superpowers/plans/2026-08-18-w1-1-journal-embed-pipeline.md),
[`2026-08-20-w1-4-decision-journal.md`](../superpowers/plans/2026-08-20-w1-4-decision-journal.md).

## 2. User-facing behavior

Two entry points into the **same** `JournalSheet`, plus a dedicated read/manage page:

### QuickInput's „Napló" tile → a two-option picker
`QuickInputSheet`'s „Napló" tile used to jump straight into the activity log. It now opens an
in-place picker phase (`'naplo-pick'`, `QuickInputSheet.tsx:79-88`) titled **„Mit naplózol?"** with
two tiles: **„✍️ Aktivitás"** (unchanged — opens `ActivityLogSheet`, the XP-earning activity log)
and **„📓 Napló"** (opens `JournalSheet` in create mode). Both replace the picker in place — closing
either closes the whole QuickInput stack (`QuickInputSheet.tsx:61-63`).

### `JournalSheet` (`features/me/sheets/JournalSheet.tsx`) — create + edit + delete, plus „Döntés" and „Hála" capture modes
One free-text `<textarea>` (no length cap, placeholder „Írd le, mi jár a fejedben…", autofocus) plus
an optional `<input type="date">` defaulting to today, plus a mic button reusing the shared
`useVoiceInput` hook (`features/insights/logic/useVoiceInput`, the `ChatPage` composer idiom — the
transcript is **appended** to whatever's already typed, not overwritten). Header eyebrow „Napló",
title „Mi jár a fejedben?" in create mode / „Bejegyzés szerkesztése" in edit mode (`entry` prop
set). CTAs „Mégse" / „Mentem" — save calls `addNote` (create) or `updateNote` (edit) then closes.
**Edit mode only** additionally offers **„Törlés" behind a two-step confirm („Törlés" →
„Biztosan törlöd?", `var(--error)` styling, the `EditGoalSheet` idiom) → `removeNote`.

**Create mode** additionally offers a three-chip mode toggle — **„Napló" / „Döntés" / „Hála"**
(both mode toggles are internal, ephemeral `useState`, always reset to `'note'` on remount,
`initialMode` prop exists for QuickInput's direct-open path). **„Hála" mode** (W1.3, `mezo-b3pp.3`)
renders 1–3 text rows (expandable via „+ Még egy" up to 3), each with a mic button and a `maxLength={280}`
constraint; an optional **life-area chip row** (`LIFE_SKILLS` from `@/features/progression/logic/levelUpMeta`,
the 8 LIFE keys) applies to every saved row. Save posts each non-empty row through `addEntry(text, lifeArea, occurredOn)`
(`useGratitudeActions`, Task 5) and closes. `JournalSheetProps.initialMode?: 'note' | 'decision' | 'gratitude'`
(default `'note'`) lets QuickInput open the sheet directly in gratitude mode (no picker step).

**QuickInput Hála tile** (W1.3): `QuickInputSheet.tsx` phase `'gratitude'` renders
`<JournalSheet onClose={onClose} initialMode="gratitude" />`; the naplo-pick grid gained a
`<Tile emoji="🙏" label="Hála" onClick={() => setPhase('gratitude')} />` tile.

**Create mode only** (`!entry`) additionally renders a two-chip mode toggle — **„Napló" / „Döntés"**
(`aria-pressed`, the house `.chip[aria-pressed='true']` idiom, no extra CSS class needed) — internal,
ephemeral `useState`, always resets to `'note'` on remount, no prop to open the sheet pre-set to
decision mode. Switching to **„Döntés"** (title „Milyen döntést hoztál?", date row label „Döntés
napja") repoints the same textarea at a decision and, on save, calls `addDecision(text, date)`
(`useDecisionActions`, W1.4 `mezo-b3pp.4`) instead of `addNote` — a day-count-free horizon hint
paragraph („…és szólunk, amikor itt az ideje, hogy visszanézzük, hogyan sült el.") renders under the
card, deliberately never naming `mezo.companion.journal.decision-review-days` as a number. Editing an
existing note never shows the toggle — there is no note→decision conversion, and `mode` is always
`'note'` whenever `entry` is set.

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

### `/me/naplo` open-decisions block + `DecisionReviewSheet` (W1.4, `mezo-b3pp.4`)
Above the notes list, `JournalPage` renders a **„Döntések"** block — but only when at least one
decision is unreviewed (`reviewedAt === null`); a fully-reviewed history has no dedicated surface in
this slice. Each card shows the decided-on day label and a chip: **„Nézd vissza"** (amber wash) once
the decision's own `reviewDue` day has arrived (`isDecisionDue`, `data/journal/decisionHooks.ts`), or
**„Visszanézés: {reviewDue}"** while it's still ripening. Tapping a card opens
**`DecisionReviewSheet`** (`features/me/sheets/DecisionReviewSheet.tsx`) — title „Hogyan sült el?",
eyebrow „Döntés · {dayLabel}", a required 1–5 rating (`role="group"` of `aria-pressed` chips, label
„Mennyire vált be? (1–5)"), an optional outcome textarea (accessible name „Hogyan sült el —
részletek"), CTAs „Mégse" / „Mentem" (disabled until a rating is chosen). Save calls `reviewDecision`
(`useDecisionActions`) — no delete, no edit, neither endpoint exists for a decision. A failed
decisions fetch (`isError && openDecisions.length === 0`) renders a compact one-line `GhostState`
(„Nem sikerült betölteni a döntéseket." + „Újra" retry) instead of silently vanishing; a
stale-but-present list on a later failed refetch falls through to the normal block, matching the
notes list's own stale-data behavior.

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
                                          (lost the insert race? retry ONCE on a re-read)
                                          (a racing delete won? clean up the orphaned vector)
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
- **No nightly self-heal for journal embeds (unlike `chat_turn`'s `findUnembeddedTurnIds` sweep)** —
  spec §5.5 scopes W1.5's catch-up job to `activity_note`/`checkin_note` only, so
  `JournalEmbeddingListener` handles its own two races inline instead: a fast create-then-edit can
  run both entries' AFTER_COMMIT handlers concurrently (Boot's default multi-threaded
  `applicationTaskExecutor`), so `onJournalEntrySaved` catches the loser's
  `DataIntegrityViolationException` on `uq_memory_embedding_kind_ref_id` and retries **once**,
  re-reading the entry first so the retry embeds the latest text; and because the saved/deleted
  listeners are unordered, a create-then-delete can otherwise leave a live vector for a dead entry
  — after a successful write the listener re-checks the entry's liveness and calls
  `deleteJournalEmbedding` if it's gone (`companion/embedding/JournalEmbeddingListener.java`).

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

### Backend table — `decision_entry` (W1.4, `mezo-b3pp.4`)

Migration [`202608201200_mezo-b3pp.4_create_decision_entry.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202608201200_mezo-b3pp.4_create_decision_entry.sql)
(registered in `1.0.0_master.yml`):

- **`decision_entry`** — `id uuid pk (gen_random_uuid())`, `created_by uuid fk→app_user`, `is_deleted`,
  `created_at timestamptz`, `decided_on date not null` (defaults to today server-side when omitted),
  `decision_text text not null`, `context_snapshot jsonb not null` (`DecisionContextEnvelope`, a
  server-rendered `ContextSnapshotAssembler.render` output frozen **at create time** — **never
  client-supplied, never returned over the wire in either direction**; a client-supplied value is
  silently ignored, pinned by `DecisionApiIT`), `review_due date not null` (defaults to
  `decided_on + mezo.companion.journal.decision-review-days`, 30), `reviewed_at timestamptz`
  (null = unreviewed), `outcome_rating smallint` (`ck_decision_entry_outcome_rating BETWEEN 1 AND 5`),
  `outcome_text text`; index `idx_decision_entry_created_by_review_due (created_by, review_due)`.

`DecisionEntryEntity` (`entity/DecisionEntryEntity.java`) `extends OwnedEntity`, `@SQLDelete`/
`@SQLRestriction` soft delete, `@JdbcTypeCode(SqlTypes.JSON)` on `contextSnapshot`, `@Min(1)`/`@Max(5)`
mirroring the DB CHECK. Repository (`repository/DecisionEntryRepository.java`) three finders: the
owned-lookup-or-404 idiom, newest-first list, and a `review_due` finder `AnchorResolver` reads
directly (§5, [`_platform-notifications.md`](_platform-notifications.md) §4).

### Backend table — `gratitude_entry` (W1.3, `mezo-b3pp.3`)

Migration [`202608211200_mezo-b3pp.3_create_gratitude_entry.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202608211200_mezo-b3pp.3_create_gratitude_entry.sql)
(registered in `1.0.0_master.yml`):

- **`gratitude_entry`** — `id uuid pk (gen_random_uuid())`, `created_by uuid fk→app_user ON DELETE CASCADE`,
  `is_deleted`, `created_at timestamptz`, `occurred_on date not null` (defaults to today server-side when omitted),
  `text varchar(280) not null` (≤ 280 chars, enforced at column + entity `@Size(max = 280)`),
  `life_area varchar(16)` nullable (`ck_gratitude_entry_life_area` on the 8 LIFE keys:
  `mindfulness|mindset|cooking|financial|productivity|learning|connection|recovery`);
  index `idx_gratitude_entry_created_by_occurred_on (created_by, occurred_on desc)`.

`GratitudeEntryEntity` (`entity/GratitudeEntryEntity.java`) `extends OwnedEntity`, `@SQLDelete`/
`@SQLRestriction` soft delete, `@Pattern` on `lifeArea`. Repository
(`repository/GratitudeEntryRepository.java`) two finders: the owned-lookup-or-404 idiom and the
ranged list, newest-first by day then by creation time within a day — same shape as `journal_entry`.

### The `memory_embedding` kind expansion (rides in W1.1, spec §4.3)

Migration [`202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql)
widens `ck_memory_embedding_kind` from the V2.2-era `chat_turn|daily_summary|weekly_summary` to ten
values: `chat_turn, daily_summary, weekly_summary, monthly_summary, journal_entry, reflection,
gratitude, decision, activity_note, checkin_note`. **`journal_entry` (W1.1) and `decision` (W1.4) are
now both populated** — `MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY`/`KIND_DECISION` are the two
constants with a writer method so far; the other five kinds remain schema headroom the rest of the
Phase 5 W1 wave will fill (§5 below). W1.4 needed **no migration** of its own for this — the CHECK
already permitted `'decision'`. The `(kind, ref_id)` uniqueness and the single `MemoryEmbeddingWriter`
write path are unchanged by design — see [`companion.md`](companion.md) §4 for the full
`memory_embedding` table shape.

### API (contract-first, [`api/feature/journal/journal.yml`](../../api/feature/journal/journal.yml), tag `Journal` → `JournalApi`, `JournalController implements JournalApi`, gated `mezo.feature.journal.enabled` — off ⇒ the whole `/api/journal` surface 404s and no journal beans exist)

| Method + path | Operation | Returns | Errors |
|---|---|---|---|
| `GET /api/journal?from&to` | `listJournalEntries` | `JournalEntryResponse[]`, newest first | 401 |
| `POST /api/journal` (`{text, occurredOn?, source}`) | `createJournalEntry` | `JournalEntryResponse` (201) | 400 (blank text / bad `source`) |
| `PUT /api/journal/{id}` (`{text, occurredOn?}`) | `updateJournalEntry` | `JournalEntryResponse` (200) | 400; 404 `JOURNAL_ENTRY_NOT_FOUND` |
| `DELETE /api/journal/{id}` | `deleteJournalEntry` | 204 (soft delete) | 404 `JOURNAL_ENTRY_NOT_FOUND` |

`source` is a **`pattern`**, not an `enum`, on `CreateJournalEntryRequest` (`api_contract_conventions.md`
rule — an invalid value must 400 via bean validation, not 500 via a failed Jackson enum deserialize);
`UpdateJournalEntryRequest` carries no `source` field at all (`{text, occurredOn?}` only — an edit
never changes where an entry came from), and the response DTO's `source` is a real enum. Errors go
through `SystemRuntimeErrorException` + `SystemMessage`
(`JOURNAL_ENTRY_NOT_FOUND=A naplóbejegyzés nem található.` in `messages.properties:83`) per
[`error_handling.md`](../references/error_handling.md). `JournalService.findOwned` is the single
404 site (`service/JournalService.java:76-80`), reused by both `update` and `delete`.

### API — decision endpoints (W1.4, `mezo-b3pp.4`, same contract file, same `JournalApi`/`JournalController`)

| Method + path | Operation | Returns | Errors |
|---|---|---|---|
| `GET /api/journal/decision` | `listDecisionEntries` | `DecisionEntryResponse[]`, newest first — **no query params** (deliberate: every non-deleted decision, small per-user volume, no range concept the way notes have) | 401 |
| `POST /api/journal/decision` (`{decisionText, decidedOn?}`) | `createDecisionEntry` | `DecisionEntryResponse` (201) | 400 (blank text) |
| `PUT /api/journal/decision/{id}/review` (`{outcomeRating, outcomeText?}`) | `reviewDecisionEntry` | `DecisionEntryResponse` (200) | 400; 404 `DECISION_ENTRY_NOT_FOUND` |

**`DecisionEntryResponse` never carries `contextSnapshot` — on neither `POST` nor `GET`, in either
direction.** `context_snapshot` is rendered and stored **entirely server-side**
(`ContextSnapshotAssembler.render`, called from `DecisionService.create`); the contract has no field
for it at all, so there is nothing for a client to send or read. **There is no delete AND no update
endpoint for decisions this slice** — a decision, once made, stays in the record with its original
text/day even if its review never happens; only journal notes have both. **The review endpoint is deliberately re-runnable, no
409** — `PUT .../review` always overwrites `reviewedAt`/`outcomeRating`/`outcomeText`, so a second,
more honest review after further reflection is a feature, not an error path to guard against; see §9
for why this shows up as an unreachable-but-kept prefill path in `DecisionReviewSheet` today.
Errors go through the same `SystemRuntimeErrorException` + `SystemMessage` convention
(`DECISION_ENTRY_NOT_FOUND=A döntés nem található.`, `messages.properties:84`, right after
`JOURNAL_ENTRY_NOT_FOUND`).

### API — gratitude endpoints (W1.3, `mezo-b3pp.3`, same contract file, same `JournalApi`/`JournalController`)

| Method + path | Operation | Returns | Errors |
|---|---|---|---|
| `GET /api/journal/gratitude?from&to` | `listGratitudeEntries` | `GratitudeEntryResponse[]`, newest first | 400 (bad dates) |
| `POST /api/journal/gratitude` (`{text, lifeArea?, occurredOn?}`) | `createGratitudeEntry` | `GratitudeEntryResponse` (201) | 400 (blank/long text, unknown `lifeArea`) |
| `DELETE /api/journal/gratitude/{id}` | `deleteGratitudeEntry` | 204 (soft delete) | 404 `GRATITUDE_ENTRY_NOT_FOUND` |

`GratitudeEntryResponse` — `{id, occurredOn, text, lifeArea: string|null, createdAt}`.
`CreateGratitudeEntryRequest` — `{text: string (min 1, max 280), lifeArea: string|null (pattern: LIFE keys), occurredOn: string|null}`.
`lifeArea` is a **`pattern`** (not `enum`) on the request — invalid values 400 via bean validation.
Errors go through the same convention (`GRATITUDE_ENTRY_NOT_FOUND=A hálabejegyzés nem található.`,
`messages.properties:85`, after `DECISION_ENTRY_NOT_FOUND`). `GratitudeService.findOwned` is the
single 404 site, reused by `delete`.

### FE domain type + wire mapping

`JournalNote` (`data/journal/journalTypes.ts`) — `{id, occurredOn, text, source: 'quickinput' |
'ritual', createdAt}`. Named `JournalNote`, **deliberately not** `JournalEntry` — two unrelated
`JournalEntry` types already exist (`features/me/logic/growthJournal.ts`,
`features/insights/logic/patternHistory.ts`). `journalApi.ts` maps the generated `paths['/api/journal']`
wire types via `toJournalNote`; the mock seed (`journalMock.ts`, `mockJournalNotes`) is 5 Hungarian
entries spanning the current and previous month so month-grouping is visible in mock mode.

`DecisionEntry` (`data/journal/decisionTypes.ts`) — `{id, decidedOn, decisionText, reviewDue,
reviewedAt: string | null, outcomeRating: number | null, outcomeText: string | null, createdAt}` — no
`contextSnapshot` field, matching the wire contract above. `decisionApi.ts` maps
`paths['/api/journal/decision']`/`paths['/api/journal/decision/{id}/review']` via `toDecisionEntry`
(normalizing an omitted `reviewedAt`/`outcomeRating`/`outcomeText` to `null`, never `undefined`); the
mock seed (`decisionMock.ts`) covers all three states — ripening, due, reviewed.

### Config

- **Switch:** `mezo.feature.journal.enabled` (`FeaturesConfiguration.JOURNAL_SWITCH`,
  `techcore/configuration/FeaturesConfiguration.java:179`) gates `JournalService`/`DecisionService` +
  `JournalController` **and** `JournalEmbeddingListener`/`DecisionEmbeddingListener` (jointly with
  `COMPANION_SWITCH`) — off ⇒ `/api/journal` (both notes and decisions) 404s, no journal beans exist,
  and neither listener bean exists so no embed call can ever happen.
- **`JournalProperties`** (`feature/journal/config/JournalProperties.java`, own `@ConfigurationProperties`
  record, ADR 0029) — `@Positive int decisionReviewDays` (default 30,
  `mezo.companion.journal.decision-review-days` in `application.yml:821-822`; the prefix stayed on
  `mezo.companion.journal.*` deliberately when the record moved out of `CompanionProperties.Journal`,
  so neither the YAML key nor the design spec's configured key needed to change). Landed in W1.1
  unconsumed, ahead of need; **W1.4's `DecisionService` now consumes it** to default
  `decision_entry.review_due = decidedOn + decisionReviewDays` when the caller doesn't (the client
  never computes or overrides `reviewDue`).

## 5. Integrations

- **→ Companion (embed pipeline, wired, one-way OUT — `journal_entry`):** every journal write feeds
  `memory_embedding` through the seam in §3 above. **Contract crossing the seam:** the two event
  records `JournalEntrySavedEvent{entryId}` / `JournalEntryDeletedEvent{entryId}` (no `userId` —
  mezo is single-user, so an owner id on the event could never discriminate anything; the listener
  re-reads the entry by id anyway) (`feature/journal/service/`) — plain Spring `ApplicationEvent`s,
  no direct method call, so
  `feature/journal` has zero compile-time dependency on `feature/companion`. See
  [`companion.md`](companion.md) for the consuming side (`JournalEmbeddingListener`,
  `MemoryEmbeddingWriter.writeJournal`/`.deleteJournalEmbedding`) and the ArchUnit
  `feature_slices_are_cycle_free` guard this keeps satisfied (companion → journal is allowed, the
  reverse is not — see the decision-context seam below for the ONE place `feature/journal` needs
  something FROM the companion, and how it stays on the same one-way rule).
- **→ Companion (embed pipeline, wired, one-way OUT — `decision`, W1.4 `mezo-b3pp.4`):** the exact
  same shape as the note seam above, one event type: `DecisionEntrySavedEvent{decisionId}`, published
  after both `create` **and** `review` commit. `DecisionEmbeddingListener`
  (`feature/companion/embedding/`, `@TransactionalEventListener(phase = AFTER_COMMIT)` + `@Async`,
  gated on `COMPANION_SWITCH` + `JOURNAL_SWITCH`) re-reads the decision and calls
  `MemoryEmbeddingWriter.writeDecision` — first write inserts a `kind=decision` row holding
  `decisionText` alone; **the review re-embed updates the SAME row in place** with `decisionText +
  "\n\nKimenet (N/5): outcomeText"`, so what the companion recalls always includes the outcome once
  one exists. **No delete-race cleanup in this listener** (unlike `JournalEmbeddingListener`'s) —
  there is no delete endpoint for decisions (§4), so there is no analogue of a racing delete to guard
  against; if a future slice ever adds decision deletion, this listener needs that guard added at
  that time.
- **← Companion (context-snapshot read, wired, ADR 0029): the ONE place `feature/journal` needs
  something FROM the companion, kept one-way via a journal-owned port.** `DecisionService.create`
  needs the companion's rendered context-snapshot text at write time (§4's `context_snapshot`); a
  direct `ContextSnapshotAssembler` import would have closed a `journal ↔ companion` cycle (companion
  already imports journal for the two listeners above) — `ArchitectureTest.feature_slices_are_cycle_free`
  caught exactly this as a NEW cycle during review and failed the build. Fixed with the same
  consumer-owned-port idiom [ADR 0012](../decisions/0012-consumer-owned-llm-ports.md) established:
  `feature/journal/service/DecisionContextPort` (one method, `render(userId, today)`) is owned here;
  `feature/companion/service/DecisionContextAssemblerAdapter` implements it by delegating straight to
  `ContextSnapshotAssembler#render`, gated `COMPANION_SWITCH` alone. `DecisionService` consumes it
  through `ObjectProvider<DecisionContextPort>` — companion off ⇒ no adapter bean ⇒ empty
  `snapshotText`, the exact honest-degraded behavior from before the fix (IDENT-3, pinned by
  `DecisionApiCompanionOffIT`), unchanged by the inversion. The cross-feature edge this creates
  (`companion → journal`, the adapter importing the journal-owned interface) runs the SAME direction
  the rest of this seam already runs, so no new cycle. Full rationale: [ADR
  0029](../decisions/0029-invert-journal-companion-decision-context-port.md).
- **← QuickInput (wired):** the global `QuickInputSheet` „Napló" tile is journal's other write
  entry point, alongside `Me`'s own `+ Új bejegyzés`. See §2.
- **↔ Me (wired, hosting):** `/me/naplo` is a `ME_TABS` tab; `JournalSheet`/`JournalPage`/
  `DecisionReviewSheet` live under `frontend/src/features/me/` even though the journal **domain**
  (types/hooks/API client for both aggregates) has its own `data/journal/` module — the same "hosted
  in Me, owned by its own data module" shape `growth.md` uses for the Growth page's history reads.
  See [`me.md`](me.md) §2 (`Napló` subsection) / §5.
- **→ Push notifications (wired, one-way OUT — `decision_review`, W1.4 `mezo-b3pp.4`):**
  `AnchorResolver` reads `DecisionEntryRepository` directly (a fourth backend-native anchor source,
  alongside gym/medication/ritual) and fires a `decision_review` push for every unreviewed decision
  whose `review_due` lands exactly on today (never `<=` — an overdue decision does not re-fire; it is
  carried instead by the `/me/naplo` „Nézd vissza" chip, §2, so the push never nags every morning
  after the due day passes). Full category shape (default ON, lead 0, dedup suffix) lives in
  [`_platform-notifications.md`](_platform-notifications.md) §4 — this is the one seam in the domain
  that is **not** the embed pipeline.
|- **🟣 Future W1 slices reuse the embed seam above, not a new one (spec §5.2–§5.5):** W1.2 (evening
  prose reflection in Napzárás, `mezo-b3pp.2`) embeds `kind=reflection` off `ritual_day` on close;
  W1.3 (gratitude entries, `mezo-b3pp.3`) adds `gratitude_entry` in the **same** `feature/journal`
  package and embeds `kind=gratitude`; W1.5 (note-embedding catch-up, `mezo-b3pp.5`) extends the
  nightly `DailySummaryJob` sweep to embed `activity_log`/check-in notes as `kind=activity_note`/
  `checkin_note`. Every one of these is "a new `write<Kind>` method on `MemoryEmbeddingWriter`, not a
  second writer" (spec §4.3) — the CHECK constraint W1.1 widened already has room for all of them;
  W1.4 (decision journal + review loop) is the pattern in production, not future, as of this doc.
  **W1.3 is now ✅ done** — `GratitudeEmbeddingListener` (`companion/embedding/`, same `@Async
  @TransactionalEventListener(AFTER_COMMIT)` shape, `COMPANION_SWITCH` + `JOURNAL_SWITCH` gated)
  calls `MemoryEmbeddingWriter.writeGratitude(entry)` / `.deleteGratitudeEmbedding(id)` with
  `kind=gratitude`, `KIND_GRATITUDE`. No delete-race cleanup needed (gratitude has no edit endpoint).

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

```ts
import { useDecisions, useDecisionActions, isDecisionDue } from '@/data/hooks'

const { data: decisions, isPending, isError, refetch } = useDecisions()  // DecisionEntry[], no params
const { addDecision, reviewDecision, pending } = useDecisionActions()

await addDecision('Váltok edzéstervet.')                        // decidedOn defaults to today, reviewDue server-derived
await reviewDecision(decision.id, 4, 'Bejött, kicsit fárasztó volt az első hét.')  // re-runnable, no 409

isDecisionDue(decision, localDateString())   // pure: reviewedAt === null && reviewDue <= today
```

```ts
import { useGratitudeEntries, useGratitudeActions } from '@/data/hooks'

const { data: entries, isPending, isError, refetch } = useGratitudeEntries(from, to)  // GratitudeEntry[]
const { addEntry, removeEntry, pending } = useGratitudeActions()

await addEntry('Jó kávé ma.', 'cooking')                          // lifeArea optional, occurredOn defaults to today
await addEntry('Anyám hívott.', 'connection', '2026-08-20')        // explicit day
await removeEntry(entry.id)                                         // soft delete

// Streak is derived client-side:
import { gratitudeStreakDays } from '@/features/me/logic/gratitudeStreak'
const streak = gratitudeStreakDays(entries.map(e => e.occurredOn), localDateString())
// counts consecutive days with ≥1 entry, walking back from today (or yesterday if today empty)
```

- Never import `journalApi`/`mockJournalNotes`/`decisionApi`/`decisionMock` directly — go through
  `@/data/hooks` (barrel line `data/hooks.ts:60` and the line right after it).
- `useJournalNotes` needs both `from`/`to` bounds — there is no "all time" read; `JournalPage`'s
  widening-window pattern (§2) is the reference for a bounded-but-growing view. `useDecisions()` takes
  **no params** — every non-deleted decision, always (§4).
- Ghost-guard obligation mirrors every other dual-mode list read: `isPending` → loading state,
  `isError && data.length === 0` → real-failure state (distinct from a genuinely empty range), else
  render the data (§2 "States").
- No delete/update action exists for decisions — don't build UI affordances for either; `reviewDue`
  is always server-computed (or mock-derived via `addDays`, never hand-rolled `Date` arithmetic that
  re-serializes through `.toISOString()` — that silently loses a calendar day at a positive UTC
  offset, the exact bug the mock `addDecision` branch had to fix).

## 7. How to extend it

- **A new journal-adjacent entry kind in the SAME domain** (the W1.3 gratitude pattern, and the W1.4
  decision pattern now shipped) — contract-first ([`api_contract_conventions.md`](../references/api_contract_conventions.md),
  a new path under `api/feature/journal/journal.yml` or a sibling fragment) → a new
  entity/repository/service method in the **same** `feature/journal` package
  ([`java_package_structure.md`](../references/java_package_structure.md)) → migration
  ([`liquibase_conventions.md`](../references/liquibase_conventions.md), remember the
  `ResetDatabase` TRUNCATE list — `journal_entry`/`decision_entry` are already in it,
  `support/ResetDatabase.java:41`) → publish the equivalent Saved event (+ a Deleted event too, only
  if the new kind is actually deletable — `decision_entry` isn't, so it has no
  `DecisionEntryDeletedEvent`) → a new `write<Kind>`/`delete<Kind>Embedding` pair on
  `MemoryEmbeddingWriter` + a new `<Kind>EmbeddingListener` mirroring `JournalEmbeddingListener`/
  `DecisionEmbeddingListener` (companion-owned, gated on `COMPANION_SWITCH` + the new feature's own
  switch) → dual-mode FE hook (`useDualQuery` recipe in [`_platform-data-layer.md`](_platform-data-layer.md))
  → both `pnpm test` modes green.
- **A new field on `journal_entry` itself** — same contract-first → backend → migration →
  dual-mode-hook → both-modes-green order; mirror the field in `journalMock.ts` so mock parity
  holds.
- **A new tunable** → extend the journal-owned `JournalProperties` (`feature/journal/config/`, ADR
  0029; prefix `mezo.companion.journal.*`, kept from its `CompanionProperties.Journal` origin) or add
  a sibling `*Properties` record under `mezo.feature.journal.*` for anything unrelated to the
  companion-snapshot lineage, never a code constant
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
  - `JournalApiCompanionOffIT` — the companion-off / journal-on quadrant (spec §5.1's "both
    switches honest when off"): with `mezo.feature.companion.enabled=false`, full journal CRUD
    still answers 2xx (the listener bean is entirely absent — both-switches
    `@ConditionalOnProperty`) and produces **zero** `memory_embedding` rows.
  - `JournalEmbeddingEventIT` (`@ActiveProfiles("companion-fake")`, NOT `@Transactional` — the
    AFTER_COMMIT hop must be real, awaited via Awaitility) — a committed create produces **exactly
    one** `memory_embedding(kind=journal_entry)` row; an update re-embeds (content changes, still
    one row); a delete removes the embedding.
  - Journal cases folded into the existing `MemoryEmbeddingWriterIT` (`companion-fake` profile):
    `testWriteJournal_shouldPersistJournalUnit_whenNewEntry`,
    `testWriteJournal_shouldReembedInPlace_whenEntryEdited` (same row id, fresh vector + content),
    `testDeleteJournalEmbedding_shouldSoftDeleteRow_whenPresent`.
- **Backend ITs — decisions (W1.4, `mezo-b3pp.4`)**, same infra, `decision_entry` also in
  `ResetDatabase`, `JournalPopulator.createDecision(...)`:
  - `DecisionEntryPersistenceIT` — `contextSnapshot` jsonb round-trip, the `review_due` finder over a
    mix of reviewed/unreviewed/different-day rows, an out-of-range `outcomeRating` rejected — the
    entity's `@Min`/`@Max` bean validation fires (`ConstraintViolationException`) before
    `ck_decision_entry_outcome_rating` is ever reached, the same distinction
    `JournalEntryPersistenceIT`'s own `@Pattern`-vs-`ck_journal_entry_source` case draws.
  - `DecisionApiIT` — create (defaults `decidedOn`/`reviewDue`), the client-supplied `contextSnapshot`
    is silently ignored (round-trips through the real `ContextSnapshotAssembler`, asserts the injected
    string is absent and the real assembler's marker is present), list newest-first, review (stamps
    `reviewedAt`/`outcomeRating`/`outcomeText`, confirmed re-runnable — no "already reviewed" 409
    case exists because none is wanted), 404 on not-own-decision.
  - `JournalSwitchOffIT` — the two decision-surface 404 cases (`mezo.feature.journal.enabled=false`).
  - `DecisionApiCompanionOffIT` — the companion-off / journal-on quadrant for decisions: a direct
    bean-absence assertion on `DecisionEmbeddingListener` (`ApplicationContext.getBeanProvider`) plus a
    POST that still succeeds with an empty stored `contextSnapshot.snapshotText()` and zero
    `memory_embedding` rows.
  - `DecisionEmbeddingEventIT` (`@ActiveProfiles("companion-fake")`, NOT `@Transactional`) — a
    committed create produces **exactly one** `memory_embedding(kind=decision)` row; a committed
    review re-embeds the SAME row with the outcome appended.
  - `AnchorResolverDecisionIT` (`feature/notification/`) — the `decision_review` push anchor: fires on
    the due day, suppressed once reviewed, suppressed once the due day has passed (never `<=`), two
    decisions due the same day yield two anchors with distinct dedup suffixes. Full category detail:
    [`_platform-notifications.md`](_platform-notifications.md) §4/§8.
- **FE** (both modes green): `data/journal/journalHooks.test.tsx` (dual-mode read + the
  range-scoped mock mutations); `features/me/sheets/JournalSheet.test.tsx` (create saves via
  `addNote`; edit prefills + calls `updateNote`; delete needs the second confirm tap; the „Döntés"
  mode toggle saves via `addDecision` and is hidden in edit mode); the
  `features/quickinput/sheets/QuickInputSheet.test.tsx` picker-phase tests (the „Napló" tile opens
  „Mit naplózol?"; picking „Aktivitás"/„Napló" swaps to the respective sheet without closing the
  stack); `features/me/pages/JournalPage.test.tsx` (month-separator grouping, edit-on-tap, the add
  button, the empty/loading/error states, the widening „Korábbi hónapok" CTA including the
  empty-but-widenable case, the „Döntések" block's due/ripening chips and its own error-retry state);
  `data/journal/decisionHooks.test.tsx` (dual-mode read + write, the `addDays`-based mock `reviewDue`
  pinned against a UTC-reserialization regression at a month boundary);
  `features/me/sheets/DecisionReviewSheet.test.tsx` (rating required to enable save, calls
  `reviewDecision`); `data/hooks.reexport.test.ts` + `features/me/pages/MeSection.test.tsx` (barrel
  identity + the `Napló` tab label in the sub-nav loop).
- **Backend ITs — gratitude (W1.3, `mezo-b3pp.3`)**, same infra, `gratitude_entry` also in
  `ResetDatabase`, `JournalPopulator.createGratitude(...)`:
  - `GratitudeEntryPersistenceIT` — round-trip create with lifeArea, newest-first range ordering,
    `ck_gratitude_entry_life_area` CHECK rejecting an unknown value.
  - `GratitudeApiIT` — 201 with defaulted `occurredOn`, 400 on text too long / unknown `lifeArea`,
    soft-delete vanishing from the list, 404 on unknown id.
  - `GratitudeEmbeddingEventIT` (`@ActiveProfiles("companion-fake")`, NOT `@Transactional`) — a
    committed create produces **exactly one** `memory_embedding(kind=gratitude)` row; a delete
    removes the embedding.
  - Gratitude cases folded into `MemoryEmbeddingWriterIT`: `testWriteGratitude_*`,
    `testDeleteGratitudeEmbedding_*`.
- **Gate:** `cd backend && ./mvnw clean test -Dtest='JournalEntryPersistenceIT,JournalApiIT,JournalSwitchOffIT,JournalApiCompanionOffIT,JournalEmbeddingEventIT,DecisionEntryPersistenceIT,DecisionApiIT,DecisionApiCompanionOffIT,DecisionEmbeddingEventIT,AnchorResolverDecisionIT,MemoryEmbeddingWriterIT'`
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
- **Gotcha — the remaining five `memory_embedding` kinds are unused schema, not dead weight.** Don't
  add a "why does the CHECK allow kinds nothing writes" cleanup task — `reflection`/`gratitude`/
  `monthly_summary`/`activity_note`/`checkin_note` are load-bearing headroom for W1.2/W1.3/W1.5
  (§5), landed in one migration per spec §4.3's explicit instruction ("W1.1 carries the first
  batch") to avoid five more `alter table … drop constraint / add constraint` migrations later.
  `decision` (the sixth) is no longer headroom — W1.4 populates it (§4).
- **Decision (W1.4) — no delete AND no update (edit) endpoint for decisions this slice.** A decision,
  once captured, stays in the record permanently with its original `decisionText`/`decidedOn` — there
  is no `DELETE /api/journal/decision/{id}`, no `PUT /api/journal/decision/{id}` (unlike
  `journal_entry`, which has both), no `removeDecision`/`updateDecision` action, and
  `DecisionEmbeddingListener` correspondingly has no delete-race cleanup (§5). The **only** write a
  decision can receive after creation is a review (`PUT .../review`, next bullet) — that endpoint
  stamps the outcome fields, never the decision's own text or day. This was a deliberate scope cut,
  not an oversight: a decision journal's value is the honest, unedited record, including decisions
  someone might want to "un-make" or rewrite from the UI — that's a product call for a later slice,
  not this one.
- **Decision (W1.4) — the review endpoint is deliberately re-runnable, no 409 on a second review.**
  `PUT .../review` always overwrites; a decision can be reviewed, then reviewed again more honestly
  later, with no "already reviewed" guard anywhere in the stack (backend or FE). This is why
  `DecisionReviewSheet` prefills its rating/outcome fields from an already-reviewed decision even
  though nothing in the shipped UI can reach that state today (see the next gotcha).
- **Decision (W1.4) — `GET /api/journal/decision` deliberately takes no query parameters.** Unlike
  `journal_entry`'s ranged `from`/`to` list, every non-deleted decision is returned, always — decision
  volume per user is expected to stay small (a handful a month, not a daily habit like notes), so a
  range concept would add API surface for no real benefit yet.
- **Decision (W1.4) — the `decision_review` push fires on the `review_due` day ONLY, never `<=`.** An
  overdue, unreviewed decision does not keep re-firing a push every day past its due date — that would
  read as nagging. Instead, an overdue decision is carried by the persistent „Nézd vissza" chip on
  `/me/naplo` (§2), which the user sees on their own schedule rather than being pushed at daily.
- **Gotcha (W1.4) — `DecisionReviewSheet`'s prefill-from-already-reviewed path is currently
  unreachable, and that's intentional, not dead code.** `JournalPage`'s „Döntések" block only lists
  **unreviewed** decisions (`reviewedAt === null`, §2), so the sheet is never opened on an
  already-reviewed one today — there is no review-history surface in this slice. The prefill logic is
  kept anyway because the backend `PUT .../review` is re-runnable (previous bullet): a future
  review-history surface can reopen this exact sheet on an already-reviewed decision with zero backend
  or sheet changes, only a new list source.
- **Deferred (spec §5.2–§5.5, bd ids assigned):** evening prose reflection (`mezo-b3pp.2`, not
  started), note-embedding catch-up for activity/check-in text (`mezo-b3pp.5`, not started).
  Gratitude entries (`mezo-b3pp.3`) **shipped** — see this doc throughout. Ritual `ReflectionStep`
  gratitude rows 🟣 deferred to W1.3b (`mezo-b3pp.3b`, blocked by W1.2 `mezo-b3pp.2` unmerged).
  Decision journal + review loop (`mezo-b3pp.4`) **shipped**. None of the remaining slices need a
  NEW embed pipeline — see §5 above.

## 10. Key files

**API contract**
- `api/feature/journal/journal.yml` — 10 endpoints (tag `Journal` → `JournalApi`): 4 `journal_entry`
  (W1.1) + 3 `decision_entry` (W1.4) + 3 `gratitude_entry` (W1.3) — `GET`/`POST /api/journal/gratitude`,
  `DELETE /api/journal/gratitude/{id}`. Registered in `api/generate/merge.yml` → merged
  `api/openapi.yml` → `api.gen.ts` + `io.mrkuhne.mezo.api.*`.

**Backend — journal domain (all three aggregates, one package)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/entity/{JournalEntryEntity,DecisionEntryEntity,DecisionContextEnvelope,GratitudeEntryEntity}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/{JournalEntryRepository,DecisionEntryRepository,GratitudeEntryRepository}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/{JournalService,JournalEntrySavedEvent,JournalEntryDeletedEvent,DecisionService,DecisionEntrySavedEvent,GratitudeService,GratitudeEntrySavedEvent,GratitudeEntryDeletedEvent}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/mapper/{JournalMapper,DecisionMapper,GratitudeMapper}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/controller/JournalController.java` — implements the whole `JournalApi` (all three aggregates; a second controller was rejected, §7/task-2 report — `skipDefaultInterface: true` bundles every `Journal`-tagged operation into one generated interface).
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java:177-179` — `JOURNAL_SWITCH` (gates all three aggregates).
- `backend/src/main/resources/application.yml:259-262` — `mezo.feature.journal.enabled`; `:821-822` — `mezo.companion.journal.decision-review-days` (consumed by `DecisionService` since W1.4).
- `backend/src/main/resources/messages.properties:83-85` — `JOURNAL_ENTRY_NOT_FOUND`, `DECISION_ENTRY_NOT_FOUND`, `GRATITUDE_ENTRY_NOT_FOUND`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/config/JournalProperties.java` — `decisionReviewDays` (ADR 0029; moved out of `CompanionProperties.Journal`, same YAML prefix).
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/DecisionContextPort.java` — the journal-owned read seam for the companion's context-snapshot text (ADR 0029), consumed by `DecisionService` via `ObjectProvider`; keeps `feature/journal` free of a direct `feature/companion` import.

**Backend — embed pipeline (companion-owned)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/JournalEmbeddingListener.java` — the `journal_entry` AFTER_COMMIT trigger.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/DecisionEmbeddingListener.java` — the `decision_entry` AFTER_COMMIT trigger (create + review); no delete-race handling (§9).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/GratitudeEmbeddingListener.java` — the `gratitude_entry` AFTER_COMMIT trigger (create + delete); no edit-race cleanup (gratitude has no edit endpoint).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java:119-137` (`writeJournal`), `:138-150` (`deleteJournalEmbedding`), `:151-176` (`writeDecision` — re-embeds in place on review, §5), `:177-195` (`writeGratitude`, `deleteGratitudeEmbedding`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DecisionContextAssemblerAdapter.java` — the companion-side `DecisionContextPort` adapter (ADR 0029), delegating to `ContextSnapshotAssembler#render`, gated `COMPANION_SWITCH`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java` — `findByKindAndRefId` (the update-in-place lookup, shared by all writers).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java:44-62` — `KIND_JOURNAL_ENTRY`/`KIND_DECISION`/`KIND_GRATITUDE` + the widened `kind` `@Pattern`.

**Backend — the `decision_review` push category (documented fully in [`_platform-notifications.md`](_platform-notifications.md) §4/§10)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/domain/NotificationCategory.java` — `DECISION_REVIEW` enum entry.
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AnchorResolver.java` — `decisionReviewAnchors(owner, date)`, reads `DecisionEntryRepository` directly.

**Backend — migrations**
- `backend/src/main/resources/db/changelog/1.0.0/script/202608181600_mezo-b3pp.1_create_journal_entry.sql`
- `backend/src/main/resources/db/changelog/1.0.0/script/202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql`
- `backend/src/main/resources/db/changelog/1.0.0/script/202608201200_mezo-b3pp.4_create_decision_entry.sql` — `decision_entry` table (W1.4 needed no `memory_embedding`-kind migration — the CHECK already permitted `'decision'`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202608211200_mezo-b3pp.3_create_gratitude_entry.sql` — `gratitude_entry` table (W1.3); `gratitude_entry` added to `ResetDatabase` TRUNCATE list.
- `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` — all four changeSets registered.

**Backend — tests**
- `backend/src/test/java/io/mrkuhne/mezo/feature/journal/{JournalEntryPersistenceIT,JournalApiIT,JournalSwitchOffIT,JournalApiCompanionOffIT,JournalEmbeddingEventIT,DecisionEntryPersistenceIT,DecisionApiIT,DecisionApiCompanionOffIT,DecisionEmbeddingEventIT,GratitudeEntryPersistenceIT,GratitudeApiIT,GratitudeEmbeddingEventIT}.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/notification/AnchorResolverDecisionIT.java` — the `decision_review` anchor (§8; full test lives with the notification suite since it's `AnchorResolver`'s code, not journal's).
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriterIT.java` — journal + decision + gratitude cases (`testWriteJournal_*`/`testDeleteJournalEmbedding_*`, `testWriteDecision_*`, `testWriteGratitude_*`/`testDeleteGratitudeEmbedding_*`).
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/JournalPopulator.java` — `createNote`/`createDecision`/`createGratitude`; `support/ResetDatabase.java:41` (`journal_entry`, `decision_entry`, `gratitude_entry` in the TRUNCATE list).

**Frontend — data layer**
- `frontend/src/data/journal/journalTypes.ts` — `JournalNote`. `frontend/src/data/journal/decisionTypes.ts` — `DecisionEntry`. `frontend/src/data/journal/journalTypes.ts` also — `GratitudeEntry`.
- `frontend/src/data/journal/journalApi.ts` — `journalApi` + `toJournalNote` wire mapper. `frontend/src/data/journal/decisionApi.ts` — `decisionApi` + `toDecisionEntry` wire mapper.
- `frontend/src/data/journal/gratitudeApi.ts` — `gratitudeApi` + `toEntry` wire mapper.
- `frontend/src/data/journal/journalMock.ts` — `mockJournalNotes` (5-entry seed). `frontend/src/data/journal/decisionMock.ts` — 3-row seed (ripening/due/reviewed).
- `frontend/src/data/journal/gratitudeMock.ts` — `mockGratitudeEntries` (6-entry seed, 4 consecutive days).
- `frontend/src/data/journal/journalHooks.ts` — `useJournalNotes`/`useJournalActions` + the mock range-scoped mutation helpers. `frontend/src/data/journal/decisionHooks.ts` — `useDecisions`/`useDecisionActions`/`isDecisionDue`.
- `frontend/src/data/journal/gratitudeHooks.ts` — `useGratitudeEntries`/`useGratitudeActions` (dual-mode, `useDualQuery` with `mockData`, queryKey `['gratitude', from, to]`).
- `frontend/src/data/hooks.ts:60-63` — all three domains' barrel re-exports.
- `frontend/src/test/msw/handlers.ts:1241-1270` — journal + gratitude MSW fixtures.

**Frontend — UI**
- `frontend/src/features/me/sheets/JournalSheet.tsx` — create/edit/delete sheet + the „Napló" / „Döntés" / „Hála" mode toggle (create mode only); `initialMode` prop for QuickInput.
- `frontend/src/features/me/sheets/DecisionReviewSheet.tsx` — the rating + outcome review sheet.
- `frontend/src/features/me/pages/JournalPage.tsx` — `/me/naplo`, month-grouped notes view + the „Döntések" open-decisions block + the `GratitudeStreakCard`.
- `frontend/src/features/me/pages/tabs.ts:11` — `ME_TABS` `journal` entry.
- `frontend/src/app/router.tsx:50,155` — `JournalPage` import + `naplo` child route.
- `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx:22,63-65,79-89` — the three-option picker phase (`naplo-pick` with Aktivitás/Napló/Hála); `'gratitude'` phase renders JournalSheet with `initialMode="gratitude"`.
- `frontend/src/features/me/logic/gratitudeStreak.ts` — `gratitudeStreakDays()` (consecutive days derived from entry dates, yesterday-grace).
- `frontend/src/features/me/components/GratitudeStreakCard.tsx` — streak card rendered on `/me/naplo` above the open-decisions block.

**Frontend — tests**
- `frontend/src/data/journal/journalHooks.test.tsx`, `frontend/src/data/journal/decisionHooks.test.tsx`, `frontend/src/data/journal/gratitudeHooks.test.tsx`
- `frontend/src/features/me/sheets/JournalSheet.test.tsx`, `frontend/src/features/me/sheets/DecisionReviewSheet.test.tsx`
- `frontend/src/features/me/pages/JournalPage.test.tsx`
- `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx` (picker-phase cases including the Hála tile)
- `frontend/src/features/me/logic/gratitudeStreak.test.ts` (consecutive-day counting, yesterday-grace)
- `frontend/src/features/me/components/GratitudeStreakCard.test.tsx` (derived streak rendering, ghost copy)
- `frontend/src/data/hooks.reexport.test.ts` + `frontend/src/features/me/pages/MeSection.test.tsx` (barrel identity + tab label).

**Docs**
- Design spec: [`docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`](../superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md) §4.1, §4.3, §5.1, §5.4, §11.
- Plans: [`docs/superpowers/plans/2026-08-18-w1-1-journal-embed-pipeline.md`](../superpowers/plans/2026-08-18-w1-1-journal-embed-pipeline.md), [`docs/superpowers/plans/2026-08-20-w1-4-decision-journal.md`](../superpowers/plans/2026-08-20-w1-4-decision-journal.md), [`docs/superpowers/plans/2026-08-21-w13-gratitude.md`](../superpowers/plans/2026-08-21-w13-gratitude.md).
- Roadmap: [`docs/milestones/roadmap.md`](../milestones/roadmap.md).
- References: [`docs/references/`](../references/) (`api_contract_conventions`, `liquibase_conventions`, `spring_patterns`, `testing_standards`, `configuration_conventions`, `java_package_structure`, `error_handling`).
