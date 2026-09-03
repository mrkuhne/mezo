---
title: Journal — Free-Prose Notes + Narrative Memory Embedding
type: feature-domain
status: done
updated: 2026-08-29
tags: [me, companion, backend, frontend, data-layer, phase-5]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/journal
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DecisionContextAssemblerAdapter.java
  - frontend/src/data/journal
  - frontend/src/features/me/sheets/JournalSheet.tsx
  - frontend/src/features/me/pages/JournalPage.tsx
  - api/feature/journal/journal.yml
related: [me, companion, ritual, _platform-data-layer, _platform-api-backend, _platform-notifications]
---

# Journal — Free-Prose Notes + Narrative Memory Embedding

> Two aggregates in one domain: free-prose `journal_entry` notes (W1.1, `mezo-b3pp.1`), captured in
> two taps from either the global QuickInput sheet or the dedicated `/me/naplo` page; and
> `decision_entry` decisions + their later review (W1.4, `mezo-b3pp.4`), captured via the same
> `JournalSheet` in a „Döntés" mode. Both persist server-side and embed post-commit into the
> companion's `memory_embedding` vector store (`kind=journal_entry` / `kind=decision`).
> **Status: ✅ done** (backend + FE real + FE mock, all three aggregates). Lives under the `Én` tab
> (`/me/naplo`, a full-page sibling behind the Én hub's „Napló" tile since the Design 2.0 shell
> dissolution — see [`me.md`](me.md) §2 for the surface, this doc for the domain). **W1.1 + W1.4 of the Phase 5 "deep memory & personalization" epic** (`mezo-b3pp`).
> **W1.3 (gratitude entries, `mezo-b3pp.3`) is also ✅ done** — a third aggregate in the same
> package with `kind=gratitude` embedding, capture via `JournalSheet` gratitude mode and QuickInput
> Hála tile, and a derived streak card on `/me/naplo`.
> Ritual `ReflectionStep` gratitude rows ✅ shipped as **W1.3b** (`mezo-b3pp.25`) — the same rows,
> capped at the day's remaining slots, inside Napzárás act 3 ([ritual.md](ritual.md) §2).

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

Two entry points into the **same** `JournalSheet`, plus a dedicated read/manage page.

**Design 2.0 note (`mezo-d20`, [ADR 0032](../decisions/0032-five-tab-ia-dissolved-section-shells.md) + [ADR 0033](../decisions/0033-mozaik-2-tile-language.md)):**
the journal **domain** is untouched by the redesign — same three tables, same contract, same
embedding pipeline, same hooks. What changed is the frame around it: the Me section shell
(`MeSection.tsx` + `ME_TABS`) is deleted, so `/me/naplo` is now a **full-page sibling** of the Én
hub rather than a sub-tab, reached by the hub's own „Napló" `Tile` (`EnHubPage.tsx`, whose tile
line reads „{n} napos hála-sorozat · {m} nyitott döntés" from the same `useGratitudeEntries` /
`useDecisions` reads the page uses — honest-empty, no line at all when neither is true); and the
quick-log entry moved from the retired centre-FAB tab bar onto the floating coral
**`QuickLogFab`** (`frontend/src/app/QuickLogFab.tsx`), which still opens the same
`QuickInputSheet`.

### QuickInput's „Napló" tile → a three-option picker
`QuickInputSheet`'s „Napló" tile used to jump straight into the activity log. It opens an in-place
picker phase (`'naplo-pick'`) titled **„Mit naplózol?"** with three tiles: **„Aktivitás"**
(`ActivityLogSheet`, the XP-earning activity log), **„Napló"** (`JournalSheet` in create mode) and
**„Hála"** (`JournalSheet` with `initialMode="gratitude"`, W1.3). Each replaces the picker in
place; every one of them takes an `onBack` that returns to the picker, and closing any of them
closes the whole QuickInput stack. Since the quick-log v2 pass (`mezo-d20.1.6`) the tiles are
`ClayIcon`-backed Mozaik `Tile`s rather than emoji rows (`i-lang` / `i-naplo` / `i-growth`), and
the menu row that opens the picker advertises `sub="3 mód"` — the emoji labels the old doc quoted
(„✍️ Aktivitás", „📓 Napló") are gone with the clay-icon pass
([ADR 0033](../decisions/0033-mozaik-2-tile-language.md)). The sheet itself is reached from the
floating `QuickLogFab`, not from a tab-bar centre button.

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

### `GratitudeRows` (`features/me/components/GratitudeRows.tsx`) — the shared capture block (W1.3b, `mezo-b3pp.25`)

Up to `max` textareas (default 3, `maxLength={280}`), a per-row push-to-talk mic, „+ Még egy" up to
the cap, the 8 LIFE life-area chips (single-select, tap again to clear) and an optional hint line.
**State-free and data-free by design** — rows, life area and the save all belong to the caller,
because the two callers save at different moments: `JournalSheet`'s „Hála" mode on „Mentem"
(batch `Promise.all` then close), the ritual's `ReflectionStep` on „Tovább" (fire-and-forget). That
is also what keeps the file out of `@/data/*`, the `frontend_conventions.md` rule for a component
shared across features.

The mic's target row is held in a **ref**, not state: `useVoiceInput`'s `rec.onstop` closes over the
transcript callback as it stood when recording STARTED, so a state read inside it would be stale.
Before the extraction the gratitude mic was wired to `JournalSheet`'s *note* textarea — a box
gratitude mode never renders — so a transcription taken while capturing gratitude was silently
lost; the extraction fixed it.

### `/me/naplo` — `JournalPage` (`features/me/pages/JournalPage.tsx`)
The read + manage surface. **Re-faced onto Mozaik 2.0 in `mezo-d20.6.6`** (source: the
`en-body.html` `#page-naplo` prototype) and reached from the Én hub's „Napló" tile, not from a
sub-nav tab — `ME_TABS` no longer exists. The page is a `MozaikPage tone="sage"` with a
`PageHead` carrying the **`‹ Én` back chip** (`navigate(-1)`) and the `+ Új bejegyzés` action
(opens `JournalSheet` in create mode), then a `PageHero` whose big number is the **hála streak**
(`gratitudeStreakDays`, sub-line „napos hála-sorozat · {n} bejegyzés"; both suppressed while the
gratitude read is pending rather than flashing a `0`) — the same number `GratitudeStreakCard`
derives for the tile below it, costing no extra round trip because both hooks share one react-query
key. Body content sits in a `PageBody` inside an `EntranceGroup`, so the streak card, the decision
cards and the note cards rise in a one-shot 30–50 ms stagger and then hold still. **Every behavior
below is the prior sheet-era page's, verbatim** — dual mode, honest states, the widening window,
create/edit via `JournalSheet`. Entries
render **month-grouped, newest first** (`monthLabel` via `hu-HU` `{year, month: 'long'}`, the
`MemoryJournalPanel`/`GrowthJournalCard` idiom) over a **widening date window**: `monthsBack` starts
at 3 (this month + the two before), and a **„Korábbi hónapok"** ghost button at the list's foot
grows it by 3 more months per tap (`windowFrom`, pure integer month arithmetic on the same `today`
ISO string the page already computed — never a fresh `new Date()` re-entry, so both ends of the
window share one source of truth for „now"). Tapping any entry card reopens `JournalSheet` with
`entry` set (edit mode). The cards themselves are the `mem-daycard` idiom reused verbatim from the
Memória Napló segment, with `mz-eyebrow` month separators.

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
**„Visszanézés: {reviewDue}"** while it's still ripening.

**Since `mezo-d20.6.6` the review is INLINE and `DecisionReviewSheet` no longer opens.** The gold
`mzh-deccard` carries the decision text and a `role="group"` row of five buttons labelled
„Mennyire vált be? (1–5)" (the 5 reads „5 · bevált"); tapping one replaces the card **in place**
with a sage `✓ Visszanézve · {n}/5` line carrying the `s-orb-unnepel` clay spot. This is a
deliberate **fidelity deviation in the prototype's favour** (the prototype's review is fully
inline, no sheet, no prose step) and it is documented as such in the page's own header comment.
Two consequences worth naming plainly: the sheet's **optional outcome textarea has no surface any
more** — `reviewDecision(id, rating)` is called without its third argument, so a review can no
longer carry prose (§9); and the acknowledgement is driven by a **local `decidedRatings` map keyed
by decision id**, so the sage line paints on the same render pass rather than waiting for the
mutation's cache update, with the mutation fired-and-forgotten (`void … .catch(() => {})`) and
reconciled by the next `useDecisions` refetch rather than rolled back. `openDecisions` therefore
keeps a just-rated row visible (`reviewedAt === null || decidedRatings[id] !== undefined`) until
it naturally falls out of the data. **`DecisionReviewSheet.tsx` itself was NOT deleted** — it is
still exported and still tested, it simply has no caller (§9). There is still no delete and no
edit: neither endpoint exists for a decision. A failed
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

### The note catch-up seam (W1.5, `mezo-b3pp.5`) — the narrative written OUTSIDE the journal

The two kinds W1.1 left as headroom are now written, and by a path that is **not** a listener:

```
(no listener, no new cron — the EXISTING nightly sweep)
DailySummaryJob.run()  (cron mezo.companion.summary.cron, COMPANION_SWITCH + DAILY_SUMMARY_JOB_SWITCH)
  per user: … daily summaries … → chat-turn catch-up …
  → NoteEmbeddingCatchUp.run(userId, yesterday)          (COMPANION_SWITCH-gated bean)
      guard: mezo.companion.embedding.embed-notes        (checked INSIDE the pass)
      for each NarrativeNoteSource bean (ObjectProvider<> injection):
        REAP first, always, outside the budget (mezo-b3pp.26):
          MemoryEmbeddingRepository.findRefContentByCreatedByAndKind(userId, kind)  ← stored (refId, content)
          source.liveNotes(userId, storedRefIds)                                    ← the port, NOT length-gated
          each ref-id that is ORPHANED (absent from liveNotes) OR still live but BLANK text
            → MemoryEmbeddingWriter.deleteNoteEmbedding(kind, refId)                (own @Transactional, soft delete)
        then, budget permitting:
          source.notesToEmbed(userId, through, note-min-chars)   ← the port, oldest first, length-gated
          each candidate → MemoryEmbeddingWriter.syncNote(kind, note)   (own @Transactional)
            compares the note's CAPPED text against the stored vector's content;
            unchanged → returns false, spends nothing; drifted or missing → re-embeds through
            upsert (revive-capable) and returns true, charging the budget
      run-wide budget: mezo.companion.embedding.note-batch-size (200), across BOTH sources' re-embeds only
  → memory_embedding (kind=activity_note | checkin_note, re-embedded in place on drift, reaped on orphan)
```

- **No listener behind these kinds — the nightly sweep is their only writer** (spec §5.5: one
  nightly narrative sweep, not a new cron). `DailySummaryJob` calls `NoteEmbeddingCatchUp.run` once
  per user after the summary + turn passes, wrapped in its own try/catch, and logs the count
  alongside the day count.
- **Lifecycle-aware since `mezo-b3pp.26`: the pass now runs three outcomes per kind per user, in a
  fixed order.** First, reap: `MemoryEmbeddingRepository.findRefContentByCreatedByAndKind` reads
  every live vector's `(refId, content)` for the kind — a projection, not the entity, so a
  768-float vector never travels through the sweep for a comparison it doesn't need — and
  `NarrativeNoteSource.liveNotes` (deliberately **not** length-gated, unlike `notesToEmbed`)
  answers which of those ref-ids still have a live source row, WITH their current text. Whatever
  is absent from that answer, **or present but blank/null**, gets
  `MemoryEmbeddingWriter.deleteNoteEmbedding`'d — a soft-delete of the VECTOR only, the source row
  untouched. The live-but-blank half closes a real user-reachable hole: `CheckInService.save`
  upserts `(createdBy, date, slotTime)` and happily writes a cleared `note`, so a row can stay LIVE
  while its text is gone — that row is never an `notesToEmbed` candidate again (it fails the
  length gate), so without this the OLD vector would stay recallable forever. Blank is the trigger
  here, deliberately **not** "below `note-min-chars`" — see the residue bullet below for why.
  **This reap runs unconditionally, before any budget check** — a vector whose source is gone or
  blank must stop being recallable tonight even when this source's turn starts with the run's
  budget already spent by an earlier source (IDENT-3 honesty beats throughput; a starved source
  still logs its own line). Only THEN does the budget-gated half run: `notesToEmbed`'s
  length-gated candidates each go through `MemoryEmbeddingWriter.syncNote`, which compares the
  note's text — capped to `embedding.embed-max-chars` first, because the CAPPED text is what
  actually gets stored — against the live vector's stored content. An unchanged note returns
  `false` and costs nothing; a drifted or missing one re-embeds through the revive-capable
  `upsert` (never the insert-only `write` — see the `mezo-b3pp.2` trap in §9) and returns `true`,
  charging the budget. **Comparing the raw, uncapped source text instead of the capped one would
  re-embed every over-length note on every nightly run, forever** — the capped text never changes
  once the note is longer than the cap, but the raw tail can, so only the capped comparison is
  stable.
- **The pass carries NO lower date bound** — `findNoteCandidates` filters on `occurred_on <= through`
  only, which is precisely what makes the **first run the one-time history backfill**: every live,
  length-gated row is a candidate whether or not it already has a vector, however old — `syncNote`
  decides cheaply (via the stored-content comparison) whether that candidate actually costs an
  embed call. Later runs converge for the same reason: an unchanged note is free.
- **Three tunables, three different jobs** (`mezo.companion.embedding.*`,
  `CompanionProperties.Embedding`): `note-min-chars` (80) is the **retrieval-value gate** — „fáradt
  vagyok" is not a memory, and a null `check_in.note` fails the SQL `length()` predicate so no null
  branch is needed; `note-batch-size` (200) caps the **re-embed half of the whole run per user**
  across both sources — reaps never charge it — so a long history spreads over nights instead of
  one burst (pinned by `NoteVectorLifecycleBudgetIT`); `embed-notes` is the toggle, checked
  **inside** `NoteEmbeddingCatchUp.run` so the pass **heals** it rather than bypasses it (the
  `embed-chat-turns` idiom in the same job). The two sources draw from this **one shared re-embed
  pool**, consumed in `ObjectProvider#orderedStream()` order — that decides which KIND gets its
  drift healed FIRST on a busy night (the second source's re-embeds can be starved for several
  nights), never whether its reap runs; each starved source logs its own line.
- **The one deliberate residue: a live note edited down BELOW `note-min-chars` but still
  NON-BLANK is neither re-embedded nor reaped.** It is still a LIVE row with substantive-looking
  text (`liveNotes` says so — liveness and substantiveness are different questions, and the reap
  only tests for BLANK, never for the length gate), so the reap leaves it alone; but it also drops
  out of `notesToEmbed`'s length-gated candidate set, so `syncNote` never gets a turn to notice its
  drift either. Its old vector survives, describing text the note no longer has. Reaping on the
  length gate instead was rejected: it would mean merely RAISING `note-min-chars` mass-deletes a
  user's existing vectors on the next nightly run, which is a worse failure mode than one
  known-stale vector. Recorded as a known, bounded gap — not silently accepted, not "fixed" into a
  shape that creates a bigger one. A note cleared all the way to BLANK is a DIFFERENT, unambiguous
  case and IS reaped (the bullet above) — the residue is specifically the "shortened but still
  something" middle ground.
- **Per-row isolation:** `NoteEmbeddingCatchUp.run` is deliberately **not** `@Transactional`, so
  each `MemoryEmbeddingWriter.syncNote`/`deleteNoteEmbedding` call crosses the Spring proxy in its
  **own** transaction — one bad or racing row is logged (`warn`) and skipped, the rest of the run
  continues. Same shape as the turn catch-up's log-and-continue loop.
- **The note sources sit behind a companion-owned port, not behind repository imports** —
  `feature/companion/NarrativeNoteSource`. The rationale (and the ArchUnit failure that forced it)
  is §9's port-inversion decision; the asymmetry that one adapter lives in `feature/activity` and
  the other in `feature/companion` is documented there too.
- **What is actually reachable today.** `activity_log` has **no edit and no delete surface**:
  `ActivityController`/`ActivityService` expose only create, day, categorize and history, and
  `categorize` never touches `text` — so neither drift nor a reap has a live trigger for
  `activity_note` through the API today; the sweep covers the kind anyway, and needs no new wiring
  the day an edit or delete surface lands. `check_in` has no delete, but `CheckInService.save`
  upserts on `(createdBy, date, slotTime)` and overwrites `note` in place — **that** is the live
  path that makes a stale `checkin_note` vector reachable today, and the one the reap/drift pass
  was actually built to close, including the edge case where the overwrite CLEARS the note to
  blank/null: the row stays live, so only the blank-aware reap (above) catches it — the row's
  liveness alone was never enough.

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
mirroring the DB CHECK. Repository (`repository/DecisionEntryRepository.java`) five finders: the
owned-lookup-or-404 idiom, newest-first list, a `review_due` finder `AnchorResolver` reads
directly (§5, [`_platform-notifications.md`](_platform-notifications.md) §4), and — **added W4.3
(`mezo-b3pp.17`)** — `findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(
UUID, Limit)`: reviewed decisions (`reviewedAt != null`) newest-review-first, caller-capped via
Spring Data `Limit` rather than a `Pageable`/manual `LIMIT` (no need for a total count or further
pages — the caller decides the cap up front). This is a companion read, not a journal one: the
W4.3 pragmatic-profile synthesis (`companion/profile/service/ProfileAssembler.rebuild`) reads
reviewed decision text + outcome rating as one of its inputs directly off this repository (§5).
**A fifth finder, added W5.3 (`mezo-b3pp.20`)** —
`findByCreatedByAndReviewedAtGreaterThanEqualAndReviewedAtLessThanAndOutcomeRatingIsNotNullAndDeletedFalse(
UUID, Instant from, Instant to)`: reviewed decisions inside a **half-open** `[from, to)` instant
window. Deliberately not the entity's usual `Between` shape (inclusive at both ends) — an inclusive
upper bound would put a decision reviewed at EXACTLY a calendar quarter's first instant into both
that quarter's window and the previous quarter's (whose own inclusive upper bound is that same
instant), double-counting one review into both means; found and fixed during this slice's review,
pinned by
`ProfileAssemblerIT.renderPayload_counts_a_decision_reviewed_at_the_exact_quarter_boundary_only_once`.
Also a companion read, not a journal one (§5).

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
gratitude, decision, activity_note, checkin_note`. **All ten are populated today**: `journal_entry`
(W1.1), `reflection` (W1.2), `gratitude` (W1.3), `decision` (W1.4), `activity_note`/`checkin_note`
(W1.5, `mezo-b3pp.5`) and — since W3.2 (`mezo-b3pp.13`) — `weekly_summary`/`monthly_summary`, written
by `MemoryEmbeddingWriter.writePeriodSummary` from the consolidation ladder's `period_summary` rungs
(see [`companion.md`](companion.md) §4 W3.2).
Neither W1.4, W1.5 nor W3.2 needed **a migration of its own** — the CHECK already permitted
`'decision'`, `'activity_note'`, `'checkin_note'`, `'weekly_summary'` and `'monthly_summary'`, which
is the entire point of landing all ten in one batch.
The `(kind, ref_id)` uniqueness and the single `MemoryEmbeddingWriter`
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
- **→ Companion (direct repository read, wired, one-way OUT — W4.3 `mezo-b3pp.17`):** the
  pragmatic-profile synthesis (`companion/profile/service/ProfileAssembler.rebuild`,
  [`companion.md`](companion.md) §4) reads `DecisionEntryRepository
  .findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc` directly — reviewed
  decisions feed the weekly profile prose alongside the W4.2 feedback rollups and active graph
  nodes. Unlike every OTHER seam in this section, there is **no event, no listener, no port** —
  `feature/companion` simply imports the journal repository and calls a finder, the same
  `companion → journal` compile-time edge the two embed listeners above already establish (the
  direction `feature_slices_are_cycle_free` allows); `feature/journal` has no knowledge of this
  read and no dependency back. No new finder-shaped contract was needed because the read is
  read-only and journal-internal state (`reviewedAt`, `outcomeRating`, `outcomeText`) is exactly
  what the entity already exposes.
  **A second, W5.3 (`mezo-b3pp.20`) read on the SAME repository, same one-way edge:** the same
  `ProfileAssembler` now also calls the half-open-window finder above (§4) to build the
  `DÖNTÉSI MINŐSÉG` payload section — the ANCHOR quarter's mean `outcome_rating` over reviewed
  decisions against the previous quarter's, computed in pure code and appended to the weekly/
  quarterly profile prose (the anchor is an explicit `ProfileAssembler.rebuild` argument: the
  weekly job passes the quarter it is standing in, the quarterly job the one that just finished) (full mechanics, the two gates, and the cron:
  [`companion.md`](companion.md) §4 "W5.3 quarterly deep pass"). **Honest absence carries over from
  W4.3's own rule:** a quarter with nothing reviewed contributes no line, and with NOTHING reviewed
  THIS quarter the whole section is omitted from the payload rather than rendering a bare `0,0/5` —
  which would read to the model as terrible judgement, not as an absence of data.
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
- **↔ Me (wired, hosting):** `/me/naplo` is a full-page sibling of the Én hub, reached from that
  hub's „Napló" tile (`ME_TABS` and `MeSection.tsx` are deleted — Design 2.0,
  [ADR 0032](../decisions/0032-five-tab-ia-dissolved-section-shells.md)); `JournalSheet`/`JournalPage`/
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
- **✅ W1.2 shipped the third consumer of this seam, from OUTSIDE `feature/journal` (`mezo-b3pp.2`).**
  The Napzárás evening reflection (`ritual_day.reflection_text`, [`ritual.md`](ritual.md)) embeds as
  `kind=reflection` through the new `MemoryEmbeddingWriter.writeReflection` + a
  `ReflectionEmbeddingListener` gated on `COMPANION_SWITCH` + **`RITUAL_SWITCH`** — proof that "a new
  `write<Kind>` method, not a second writer" (spec §4.3) holds for a source domain journal doesn't
  own. It also **refactored the writer**: the three duplicated re-embed blocks (journal, decision,
  reflection) collapsed into one private `upsert(createdBy, kind, refId, content, occurredOn)`, so
  `writeJournal`/`writeDecision` are now one-liners over it and the update-in-place mechanics
  documented in §9 live in exactly one method. Behaviour is unchanged — same lookup, same
  `LlmCallContext`, same insert fallback — so the journal/decision ITs pinned it without edits.
- **✅ W1.3 shipped gratitude on the same seam, inside `feature/journal` (`mezo-b3pp.3`).**
  `GratitudeEmbeddingListener` (`companion/embedding/`, same `@Async
  @TransactionalEventListener(AFTER_COMMIT)` shape, `COMPANION_SWITCH` + `JOURNAL_SWITCH` gated) calls
  `MemoryEmbeddingWriter.writeGratitude(entry)` / `.deleteGratitudeEmbedding(id)` with
  `kind=gratitude` (`KIND_GRATITUDE`), riding W1.2's shared `upsert`. No edit endpoint, so no
  create-then-edit race branch — only the create-then-delete liveness re-check.
- **✅ W1.5 shipped the fourth consumer of this seam, and the first one with NO listener
  (`mezo-b3pp.5`).** The narrative Daniel writes outside the journal — the QuickInput „Napló"
  activity entry's `activity_log.text` ([`growth.md`](growth.md)) and `check_in.note`
  ([`today.md`](today.md)) — becomes `kind=activity_note`/`checkin_note` through
  `MemoryEmbeddingWriter.syncNote(kind, note)`, driven ONLY by the nightly
  `DailySummaryJob` → `NoteEmbeddingCatchUp` pass (§3 above). **Contract crossing the seam:** the
  companion-owned port `feature/companion/NarrativeNoteSource` (`kind()` +
  `notesToEmbed(userId, through, minChars)` returning a flat `Note(id, createdBy, text, occurredOn)`
  record, plus — since `mezo-b3pp.26` — `liveNotes(userId, ids)`, deliberately not length-gated,
  the lifecycle half) — not the owning features' entities. `ActivityNoteSourceAdapter`
  (`feature/activity/service/`) implements it over `ActivityLogRepository.findNoteCandidates`/
  `findByCreatedByAndIdIn`; `CheckInNoteSourceAdapter` lives in `feature/companion/embedding/` and
  reads `CheckInRepository` directly — the asymmetry is deliberate and load-bearing, §9. **Both
  adapters are deliberately UNGATED by their feature's own switch** (unlike every listener seam
  above): history already logged must stay embeddable (and reapable) by the sweep even on a day
  activity-capture or check-in capture is switched off — the sweep, not the capture path, owns
  whether this backlog gets embedded. The adapters carry no `@ConditionalOnProperty` at all; the
  gates all sit on the consuming side — `mezo.companion.embedding.embed-notes` (checked inside the
  pass), `COMPANION_SWITCH` (removes `NoteEmbeddingCatchUp` itself), and `DAILY_SUMMARY_JOB_SWITCH`
  (`mezo.techcore.cron.daily-summary-job.enabled`), which removes the driving `DailySummaryJob`, so
  with the cron off nothing sweeps at all.
- **✅ `mezo-b3pp.26` shipped the lifecycle the W1.5 write-once shape deferred: drift re-embed +
  orphan reap.** `syncNote` replaces the old insert-only `writeNote` (§3, §9); `deleteNoteEmbedding`
  soft-deletes an orphaned vector. Both known gaps recorded when W1.5 shipped are now closed —
  except the one deliberate residue (a live note edited below `note-min-chars`, §3/§9), which is a
  bounded, documented gap rather than a bug.
- **✅ The W1 narrative-capture wave is complete as of `mezo-b3pp.5`, with `mezo-b3pp.26` closing its
  lifecycle follow-up.** All five slices ship on this one seam: `journal_entry` (W1.1), `reflection`
  (W1.2, from `feature/ritual`), `gratitude` (W1.3), `decision` (W1.4) and the listener-less
  `activity_note`/`checkin_note` pair (W1.5, now drift- and reap-aware). **W1.3b** (`mezo-b3pp.25`,
  gratitude rows in the ritual `ReflectionStep`) has also shipped, reusing the W1.3 seam unchanged.

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
  `MemoryEmbeddingWriter` — a re-embeddable kind's `write<Kind>` should be a one-liner over the
  shared private `upsert(...)`, not a fourth copy of the lookup-then-update body (`mezo-b3pp.2`) —
  + a new `<Kind>EmbeddingListener` mirroring `JournalEmbeddingListener`/
  `DecisionEmbeddingListener`/`ReflectionEmbeddingListener` (companion-owned, gated on
  `COMPANION_SWITCH` + the new feature's own switch — `ReflectionEmbeddingListener` is the worked
  example of that second switch not being journal's) → dual-mode FE hook (`useDualQuery` recipe in [`_platform-data-layer.md`](_platform-data-layer.md))
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
- **Backend ITs — the note catch-up (W1.5, `mezo-b3pp.5`)**, all under
  `feature/companion/embedding/`, all `@ActiveProfiles("companion-fake")`, data via
  `ActivityPopulator`/`CheckInPopulator` (no journal populator involved — the sources are other
  features' tables):
  - `NoteEmbeddingWriterIT` — the two `findNoteCandidates`/`liveNotes` queries through their
    adapters (`notesToEmbed` gates on length and on `through`, a null `check_in.note` is simply
    absent) and `MemoryEmbeddingWriter.syncNote` called twice for the same ref (`occurred_on` = the
    entry's own day, never the embed day; the second call is the no-drift no-op case).
  - `NoteEmbeddingCatchUpIT` — both kinds embedded in one run with the length gate applied, a
    second run writing nothing new (an unchanged note costs nothing), **a row months older than the
    daily-summary catch-up window still embedded** (that IS the one-time history backfill), a
    soft-deleted source row skipped, and another user's notes never touched.
  - `NoteEmbeddingBudgetIT` — separate from the above because it needs its own
    `note-batch-size=1` `@TestPropertySource`: with a candidate in BOTH sources exactly ONE vector
    is written, pinning that the budget caps the whole run rather than each source.
  - `NoteEmbeddingSwitchOffIT` — `embed-notes=false`: the full `DailySummaryJob.run()` produces
    zero note vectors (the toggle is honoured by the pass, not bypassed by the job).
  - `DailySummaryJobIT.testRun_shouldEmbedSubstantiveNotes_whenNotesExist` — the wiring itself: the
    nightly job's own run embeds the notes, so the pass is reached from the cron path and not only
    when called directly.
  - `NoteVectorLifecycleIT` (`mezo-b3pp.26`) — the writer- and sweep-level lifecycle cases in one
    class: `syncNote` writes on first sight, spends nothing when unchanged, re-embeds in place on a
    text change, does **not** treat a change beyond `embed-max-chars` as drift (the cap-comparison
    trap — same head, different tail, capped content unchanged), and revives a previously reaped
    vector on the SAME row (the `mezo-b3pp.2` trap — pins that revival goes through `upsert`, never
    the insert-only `write`); `deleteNoteEmbedding` soft-deletes an existing vector and no-ops on
    one that never existed. At the sweep level: a check-in's live overwrite-in-place re-embeds the
    same row (the one reachable live path today); a soft-deleted activity row's vector is reaped;
    an unchanged note run costs nothing; a live note edited below `note-min-chars` is neither
    reaped nor re-embedded (the deliberate residue, pinned by asserting the pre-edit content
    survives untouched); and one failing row does not abort the rest of the sweep.
  - `NoteVectorLifecycleBudgetIT` (`mezo-b3pp.26`) — isolated for its own `note-batch-size=1`
    `@TestPropertySource`, mirroring `NoteEmbeddingBudgetIT`'s isolation reason: a reap never
    charges the budget while a drift re-embed does (one drifted + one orphaned note, budget=1,
    both resolve in one run); and the reap-starvation regression itself — with the first source's
    fresh note spending the whole run's budget, the second source's orphaned vector is still
    reaped, only its re-embed half is starved (this pins the fix in
    `NoteEmbeddingCatchUp.embed`: the reap used to sit behind the `budget <= 0` early return, so a
    first source consuming the whole budget silently starved the second source's reap for the
    night).
- **FE** (both modes green — W1.5 has **no** frontend surface at all): `data/journal/journalHooks.test.tsx` (dual-mode read + the
  range-scoped mock mutations); `features/me/sheets/JournalSheet.test.tsx` (create saves via
  `addNote`; edit prefills + calls `updateNote`; delete needs the second confirm tap; the „Döntés"
  mode toggle saves via `addDecision` and is hidden in edit mode); the
  `features/quickinput/sheets/QuickInputSheet.test.tsx` picker-phase tests (the „Napló" tile opens
  „Mit naplózol?"; picking „Aktivitás"/„Napló"/„Hála" swaps to the respective sheet without closing
  the stack); `features/me/pages/JournalPage.test.tsx` (month-separator grouping, edit-on-tap, the add
  button, the empty/loading/error states, the widening „Korábbi hónapok" CTA including the
  empty-but-widenable case, the „Döntések" block's due/ripening chips and its own error-retry state,
  and — since the Mozaik re-face `mezo-d20.6.6` — the `‹ Én` back chip, the hero's honest
  streak line (suppressed while the gratitude read is pending, „napos hála-sorozat · N bejegyzés"
  once resolved) and the **inline** review's `✓ Visszanézve · {n}/5` acknowledgement in place of
  the retired sheet hand-off);
  `data/journal/decisionHooks.test.tsx` (dual-mode read + write, the `addDays`-based mock `reviewDue`
  pinned against a UTC-reserialization regression at a month boundary);
  `features/me/sheets/DecisionReviewSheet.test.tsx` (rating required to enable save, calls
  `reviewDecision`) — **still green, but now the only thing that mounts that sheet** (§9);
  `data/hooks.reexport.test.ts` (barrel identity). **`features/me/pages/MeSection.test.tsx` is
  deleted** with the Me shell (F8, `mezo-d20.9.1`) — there is no sub-nav loop to assert a tab label
  in; the Én hub's own „Napló" tile is covered by `features/me/pages/EnHubPage.test.tsx`;
  `features/me/components/GratitudeRows.test.tsx` (`mezo-b3pp.25`) — the extracted block: one row
  by default, „+ Még egy" up to the cap and gone at it, a `max` below 3 honoured (the ritual's
  remaining slots), the life-area chip toggling both ways, and the two voice cases that pin the
  fix — the transcript lands in the row whose mic was tapped, and appends to what that row already
  holds. The ritual half of the extension — `features/ritual/components/ReflectionStep.test.tsx`'s
  gratitude block — is documented in [`ritual.md`](ritual.md) §8.
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
- **Gate:** `cd backend && ./mvnw clean test -Dtest='JournalEntryPersistenceIT,JournalApiIT,JournalSwitchOffIT,JournalApiCompanionOffIT,JournalEmbeddingEventIT,DecisionEntryPersistenceIT,DecisionApiIT,DecisionApiCompanionOffIT,DecisionEmbeddingEventIT,GratitudeEntryPersistenceIT,GratitudeApiIT,GratitudeEmbeddingEventIT,AnchorResolverDecisionIT,MemoryEmbeddingWriterIT,NoteEmbeddingWriterIT,NoteEmbeddingCatchUpIT,NoteEmbeddingBudgetIT,NoteEmbeddingSwitchOffIT,NoteVectorLifecycleIT,NoteVectorLifecycleBudgetIT,DailySummaryJobIT' -Dmezo.test.use-testcontainers=true`
  (ALWAYS `clean` — Lombok+MapStruct incremental compile is flaky); `cd frontend && pnpm build &&
  pnpm test && VITE_USE_MOCK=true pnpm test`.

## 9. Decisions, gotchas & deferred

- **Decision — update-in-place re-embed, not delete+insert (spec deviation, mechanical not
  design).** Spec §5.1 describes edits re-embedding via "delete+insert on the `(kind, ref_id)`
  key". `uq_memory_embedding_kind_ref_id` spans **soft-deleted** rows (the index has no
  `where is_deleted = false` partial clause), so a soft-delete-then-insert on the same key would
  violate the unique constraint, and a hard delete would break the soft-delete-everywhere rule.
  `MemoryEmbeddingWriter.writeJournal` instead
  looks the row up by `(kind, ref_id)` and, if present, updates its `content`/`embedding`/
  `occurred_on` in place — same effect (fresh vector describing the edited text), same key, no
  constraint conflict. First write still inserts via the shared `write` helper. **Since `mezo-b3pp.2`
  this lookup-then-update-or-insert body lives once**, in the private
  `MemoryEmbeddingWriter.upsert(createdBy, kind, refId, content, occurredOn)`, which
  `writeJournal`/`writeDecision`/`writeReflection` all delegate to; the write-once kinds
  (`chat_turn`, `daily_summary`) keep calling the insert-only `write` directly, since a lookup they
  can never hit would be pure cost.
- **Gotcha — that lookup must IGNORE `is_deleted`, and the found branch REVIVES the row.** Same
  root cause as the bullet above, one step further: because the unique index is not partial, a
  soft-deleted vector keeps **occupying** its `(kind, ref_id)` slot. So a cleared-then-rewritten
  unit (the reflection path — `writeReflection`'s blank branch soft-deletes, and a later non-blank
  save re-publishes `RitualClosedEvent`) would find nothing through the `@SQLRestriction` filter,
  take the insert branch, and hit the constraint — which both embed listeners swallow as a warn,
  leaving the unit silently un-embeddable **forever**. `upsert` therefore reads through
  `MemoryEmbeddingRepository.findByKindAndRefIdIncludingDeleted` — **native by necessity**, since
  `@SQLRestriction` applies to derived *and* JPQL queries alike — and sets `deleted = false` next
  to the content/vector/`occurred_on` update. Safe for every kind routed through `upsert`:
  `writeJournal` is only ever reached for a still-live entry (`JournalEmbeddingListener` re-reads
  through the filter first, and re-checks liveness *after* the write, deleting again if a racing
  delete won), and decisions cannot be deleted at all. `writeSummary`'s soft-delete targets a
  *different* summary row's `ref_id` and goes through `write`, so it is untouched by this.
- **Decision — the embed tag stays the generic `embed_memory`/`document`, `entityKind=journal_entry`
  is the discriminator (spec §11 single-writer rule).** The spec names a possible per-feature
  `journal` LLM-call tag; W1.1 has no journal-specific LLM call to tag (the embed call rides
  `MemoryEmbeddingWriter`'s existing `LlmCallContext("embed_memory", "document", kind, refId)`,
  since `mezo-b3pp.2` stated once inside the shared `upsert`/`write` pair) — one write path, one tag
  family, `kind` is the only new axis.
- **Gotcha — `source=ritual` exists in the CHECK/entity but nothing sets it yet.** W1.1 always
  writes `SOURCE_QUICKINPUT` (both the QuickInput sheet's `create` call and the Me page's `+ Új
  bejegyzés` hardcode `source: 'quickinput'` client-side, `journalApi.ts:26`). `ritual` is reserved
  for a later slice's Napzárás-originated capture — do not repurpose it for anything else.
  `JournalSheet` never lets the caller choose a `source`.
- **Gotcha — the remaining `memory_embedding` kinds are unused schema, not dead weight.** Don't
  add a "why does the CHECK allow kinds nothing writes" cleanup task — `gratitude` (W1.3) and
  `monthly_summary` are load-bearing headroom (§5) that W1.1's migration landed in one go
  per spec §4.3's explicit instruction ("W1.1 carries the first batch") to avoid five more
  `alter table … drop constraint / add constraint` migrations later (`weekly_summary` is NOT part of
  that batch — it sat in the V2.1-era CHECK from the start, and is unwritten for its own reasons).
  Four of the six kinds that arrived as headroom are no longer headroom: `decision` (W1.4, §4), `reflection` (`mezo-b3pp.2`, written by
  `ReflectionEmbeddingListener` off the Napzárás close — §5, [`ritual.md`](ritual.md)) and, since
  `mezo-b3pp.5`, `activity_note`/`checkin_note` (the nightly note sweep, §3). **None of them needed
  a migration of its own, which is the whole point of the batch.**
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
- **Decision (W1.5) — the note sources went behind a companion-owned port, because ArchUnit failed
  the direct design.** The plan had `NoteEmbeddingCatchUp` importing `ActivityLogRepository`/
  `ActivityLogEntity` straight from `feature/activity`.
  `ArchitectureTest.feature_slices_are_cycle_free` — a **`FreezingArchRule`**, so only the already
  frozen cycles are tolerated and any NEW one fails the build — rejected it: `feature/activity`
  already depends on `feature/companion` (directly, `ActivityClassifier` → `CompanionLlm`, and
  transitively via `feature/quest`), so the import closed `activity → companion → activity` plus
  `activity → quest → companion → activity`. Exactly the failure mode that caught the
  journal/companion decision-context seam ([ADR 0029](../decisions/0029-invert-journal-companion-decision-context-port.md)),
  and it took the same, established fix: the **consumer-owned port**
  ([ADR 0012](../decisions/0012-consumer-owned-llm-ports.md), with
  `feature/companion/TodayActivitySource` + `feature/activity/service/DailyActivityAdapter` as the
  in-repo precedent). Companion declares what it needs — `NarrativeNoteSource`, whose `Note` record
  is flat (`id, createdBy, text, occurredOn`) so no companion class ever sees an activity ENTITY,
  and whose `ACTIVITY_NOTE`/`CHECKIN_NOTE` constants mirror `MemoryEmbeddingEntity`'s so an
  implementing feature needn't import a companion entity either — and the owning feature implements
  it. `NoteEmbeddingCatchUp` injects `ObjectProvider<NarrativeNoteSource>`, not a plain
  `List<NarrativeNoteSource>` — a `List<T>` constructor parameter with zero matching beans resolves
  to `null` in Spring (`DefaultListableBeanFactory.resolveMultipleBeans`), which fails context
  startup on the required dependency; `ObjectProvider#orderedStream()` yields an empty stream
  instead. That makes zero note sources (no implementation on the classpath, or every one switched
  off) an actually-safe no-op today, and lets a future `@ConditionalOnProperty` on either adapter
  drop it to zero without risking the context.
- **Gotcha (W1.5) — the two adapters live in DIFFERENT slices, and that asymmetry is deliberate.**
  `ActivityNoteSourceAdapter` sits in `feature/activity/service/` (the inversion described above),
  but `CheckInNoteSourceAdapter` sits in `feature/companion/embedding/` and imports
  `CheckInRepository` directly. Reason: `feature/biometrics` has **no** edge into
  `feature/companion` today, so implementing the port from inside `biometrics/checkin/service` would
  have ADDED that missing leg and closed a NEW, un-frozen 4-slice cycle (`biometrics → companion →
  meal → goal → biometrics`, the `goal ↔ biometrics` leg being a pre-existing FROZEN cycle) —
  whereas a plain `companion → biometrics` read is the direction that already exists safely in this
  pipeline. Don't "tidy" the two adapters into the same place; either move breaks the build. The
  full reasoning is in each class's javadoc, next to the code that depends on it.
- **Shipped (`mezo-b3pp.26`) — `activity_note`/`checkin_note` re-embed on drift and reap on
  orphan; the write-once follow-up is closed.** `MemoryEmbeddingWriter.syncNote` replaces the old
  insert-only `writeNote`: it compares an embed candidate's text — capped to
  `embedding.embed-max-chars` first, because that capped text is what is actually stored — against
  the live vector's stored content, and re-embeds through the revive-capable `upsert` (never the
  insert-only `write`) only when they differ, returning whether it spent an embed call so the
  nightly sweep's budget charges only real work. Comparing the RAW source text instead of the
  capped one would have re-embedded every over-length note on every single nightly run, forever,
  for a tail that never affects the stored content — the capped comparison is the only stable one.
  Routing the re-write through `upsert` rather than `write` matters because
  `uq_memory_embedding_kind_ref_id` is a PLAIN (non-partial) unique index: a reaped vector keeps
  occupying its `(kind, ref_id)` slot, so a later revive must UPDATE that row back to life, not
  INSERT a colliding one (the `mezo-b3pp.2` trap, pinned by
  `NoteVectorLifecycleIT#testSyncNote_shouldReviveTheVector_whenItWasPreviouslyReaped`).
- **Shipped (`mezo-b3pp.26`) — a source row no longer live, OR still live but cleared to blank,
  gets its vector reaped, outside the budget.** `NoteEmbeddingCatchUp.embed` now runs the reap
  FIRST and unconditionally, before any budget check, for every kind on every user's turn:
  `NarrativeNoteSource.liveNotes` (deliberately **not** length-gated) answers which stored ref-ids
  are still live, WITH their current text, and each ref-id that is either absent from that answer
  or present with null/blank text gets `MemoryEmbeddingWriter.deleteNoteEmbedding`'d — a
  soft-delete of the vector only, never the source row. This closes the IDENT-3 honesty gap the
  write-once shape originally left, on BOTH its faces: a vector whose source is gone must stop
  being recallable tonight even when a re-embed elsewhere has already spent the run's whole
  budget, AND a vector whose row survives but whose note was cleared (the one live, user-reachable
  path on `check_in` today — `CheckInService.save`'s upsert happily writes a blank `note`) must
  stop being recallable too, even though `liveNotes` alone would call that row "still there"
  (pinned by `NoteVectorLifecycleIT#testRun_shouldReapTheVector_whenALiveCheckInNoteWasClearedToBlank`).
  Deliberately BLANK, never "below `note-min-chars`" — see the residue bullet below for why that
  line is drawn there. **A real bug caught in review on the way here:** the reap originally sat
  behind the same `budget <= 0` early return as the re-embed loop, so a first source consuming the
  whole run's budget silently starved the second source's reap for the night — fixed by moving the
  reap ahead of that check, and pinned by
  `NoteVectorLifecycleBudgetIT#testRun_shouldStillReapTheSecondSource_whenTheFirstSourceExhaustedTheBudget`.
- **Shipped (`mezo-b3pp.26` final review) — an unchanged corpus no longer pays a transaction +
  select per candidate.** The re-embed loop used to call `syncNote` for EVERY candidate every
  night; `syncNote`'s own internal comparison already made that a no-op for unchanged notes, but
  the CALL itself still crossed the Spring proxy (its own transaction) and ran
  `findByKindAndRefId` — a corpus of ~2700 embedded notes paid ~2700 short transactions and
  selects every night, forever, for text that never changes. `NoteEmbeddingCatchUp.embed` now
  skips the call outright when `storedByRef`'s already-loaded content for that ref-id equals
  `MemoryEmbeddingWriter.cap(note.text())` — the SAME capped text `syncNote` itself compares
  against (`cap` is package-visible for exactly this, one definition instead of two rules that
  could drift), so `syncNote` is only reached for genuine first-writes and drifts; its own check
  stays as a cheap belt-and-braces double check. Pinned by
  `NoteEmbeddingCatchUpIT#testRun_shouldNotCallSyncNote_whenTheCorpusIsUnchanged` (a
  `@MockitoSpyBean` on `MemoryEmbeddingWriter`, since the pre-fix code already returned `written=0`
  for an unchanged run — only a call-count assertion actually pins the cost, not the outcome).
- **Known, bounded gap (`mezo-b3pp.26`) — a live note edited down BELOW `note-min-chars` is
  neither re-embedded nor reaped.** `liveNotes` says the row is still live, so the reap leaves it
  alone; but `notesToEmbed`'s length gate drops it from the embed-candidate set, so `syncNote`
  never gets a turn to notice its drift either — the note's OLD, pre-edit vector survives,
  describing text the note no longer has (pinned by
  `NoteVectorLifecycleIT#testRun_shouldNotReap_whenALiveNoteFellBelowMinChars`). This is deliberate,
  not an oversight: reaping on the length gate instead was considered and rejected, because merely
  RAISING `note-min-chars` in a future config change would then mass-delete a user's existing
  vectors on the next nightly run — a worse failure than one bounded, known-stale vector.
- **What this closes and what stays out of reach.** Both gaps above are recorded as shipped seams,
  not silently patched over — and reachability was never symmetric between the two kinds.
  `activity_log` has **no edit and no delete surface** today (`ActivityController`/`ActivityService`
  expose only create, day, categorize and history; `categorize` never touches `text`), so neither
  drift nor a reap has a live trigger for `activity_note` through the API — the sweep covers the
  kind anyway and needs no new wiring the day such a surface lands. `check_in` has no delete
  either, but `CheckInService.save` upserts on `(createdBy, date, slotTime)` and overwrites `note`
  in place — that IS a live, reachable path today, and the one this lifecycle rework was actually
  built to close.
- **Deferred — the W1 wave, including its W1.3b and `mezo-b3pp.26` follow-ons, is done.** Every W1
  slice has shipped: journal (`mezo-b3pp.1`), evening reflection (`mezo-b3pp.2`, outside this
  domain — see §5 and [`ritual.md`](ritual.md)), gratitude (`mezo-b3pp.3`), decision journal +
  review loop (`mezo-b3pp.4`) and the note-embedding catch-up (`mezo-b3pp.5`, §3/§5/§8) with its
  lifecycle follow-up (`mezo-b3pp.26`, the three bullets above) now closed except the one
  documented residue. **W1.3b** (`mezo-b3pp.25`) — gratitude rows in the ritual `ReflectionStep`,
  §2 above — has also shipped, reusing the seam in §5 with no new embed pipeline. Nothing open
  remains in the *domain*; the two Design 2.0 residues below are view-layer, not model.

- **The Design 2.0 re-face touched only the frame — and that is the whole point.** Mozaik 2.0
  ([ADR 0033](../decisions/0033-mozaik-2-tile-language.md)) is the Nth render layer over an
  unchanged journal model: `journal_entry` / `decision_entry` / `gratitude_entry`, the
  `mezo.feature.journal.enabled` gate, `JournalApi`, the embedding listeners and the whole
  `data/journal/` hook layer are byte-for-byte what W1.1–W1.5 shipped. What changed: `/me/naplo`
  stopped being a `ME_TABS` sub-tab and became a full-page sibling behind the Én hub's tile
  ([ADR 0032](../decisions/0032-five-tab-ia-dissolved-section-shells.md)); the page swapped its
  header for `MozaikPage`/`PageHead`/`PageHero`/`PageBody` + an `EntranceGroup`; and the decision
  review went inline.

- **DEFERRED — `DecisionReviewSheet.tsx` is orphaned, and with it the outcome prose.** The inline
  review (`mezo-d20.6.6`, §2) follows the prototype, which has no sheet — so nothing in the app
  mounts `features/me/sheets/DecisionReviewSheet.tsx` any more, though the file, its export and
  `DecisionReviewSheet.test.tsx` are all still in the tree and green. The functional loss is real
  and is not papered over: `reviewDecision(id, rating)` is now always called **without** its
  optional third argument, so **a review can no longer record outcome prose**. The
  `DecisionReviewRequest.outcome` field, the column and the embedding path that reads it are all
  still live on the backend — they simply have no writer from the UI. Resolving this needs a
  designed surface (a prose step inside the inline flow, or the sheet re-hung off a „részletek"
  affordance), not a hurried re-insert; until then the sheet is dead code by the F8 definition and
  is recorded here as such.

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
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java` — `writeJournal`, `deleteJournalEmbedding`, `writeDecision` (re-embeds in place on review, §5), and the private `upsert(...)` all three re-embeddable kinds share since `mezo-b3pp.2` (`writeReflection`, the ritual-sourced fifth kind, is the third caller — [`ritual.md`](ritual.md) §5).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DecisionContextAssemblerAdapter.java` — the companion-side `DecisionContextPort` adapter (ADR 0029), delegating to `ContextSnapshotAssembler#render`, gated `COMPANION_SWITCH`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java` — `findByKindAndRefId` (the live-row lookup, still the delete path's probe) and, since `mezo-b3pp.2`, the native `findByKindAndRefIdIncludingDeleted` the single shared `upsert(...)` reads through so a soft-deleted row is revived rather than re-inserted (§9).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java:44-53,63` — the kind constants (`KIND_JOURNAL_ENTRY`/`KIND_DECISION`/`KIND_REFLECTION` + W1.5's `KIND_ACTIVITY_NOTE`/`KIND_CHECKIN_NOTE`) and the widened `kind` `@Pattern` mirroring `ck_memory_embedding_kind`.

**Backend — the note catch-up + lifecycle (W1.5 `mezo-b3pp.5`, lifecycle `mezo-b3pp.26`; no listener, no migration, no FE)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/NarrativeNoteSource.java` — the companion-owned port (`kind()`, `notesToEmbed`, and — since `mezo-b3pp.26` — `liveNotes` (not length-gated), the flat `Note` record, the two kind constants); its javadoc carries the cycle rationale (§9).
- `backend/src/main/java/io/mrkuhne/mezo/feature/activity/service/ActivityNoteSourceAdapter.java` — the `activity_note` source, a plain `ActivityLogRepository` read (NOT `ActivityService` — that import would close a cycle of its own), ungated by `ACTIVITY_SWITCH`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/CheckInNoteSourceAdapter.java` — the `checkin_note` source; lives in companion, not in `biometrics/checkin/service`, for the reason in §9.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingCatchUp.java` — the pass itself: toggle check, per-kind reap-then-re-embed (§3), run-wide re-embed budget, per-row try/catch, deliberately NOT `@Transactional`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java` — `syncNote(kind, note)` (drift-aware, capped-text comparison, revive-capable `upsert`, mezo-b3pp.26) and `deleteNoteEmbedding(kind, refId)` (the reap half — §9's now-closed gaps).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DailySummaryJob.java` — the wiring: the note pass runs per user inside the EXISTING nightly cron, after the summary + turn passes.
- `backend/src/main/java/io/mrkuhne/mezo/feature/activity/repository/ActivityLogRepository.java` — `findNoteCandidates(createdBy, through, minChars)` (JPQL, `@SQLRestriction` keeps soft-deleted rows out, oldest first) and `findByCreatedByAndIdIn` (the `liveNotes` finder).
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/repository/CheckInRepository.java` — `findNoteCandidates(...)` (a null note fails the `length()` predicate in SQL, so no null branch) and `findByCreatedByAndIdIn` (the `liveNotes` finder).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java` — `findRefContentByCreatedByAndKind` (the `RefContent` projection: `(refId, content)` per live vector, what the sweep's reap/drift compare against, without dragging a 768-float vector through).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` — `Embedding.embedNotes`/`noteMinChars`/`noteBatchSize`; `backend/src/main/resources/application.yml:396-402` — `mezo.companion.embedding.embed-notes` / `note-min-chars: 80` / `note-batch-size: 200`.

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
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/{NoteEmbeddingWriterIT,NoteEmbeddingCatchUpIT,NoteEmbeddingBudgetIT,NoteEmbeddingSwitchOffIT}.java` — the W1.5 candidate/backfill/budget/toggle cases (§8).
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/{NoteVectorLifecycleIT,NoteVectorLifecycleBudgetIT}.java` (`mezo-b3pp.26`) — the drift re-embed / reap lifecycle at both the writer and sweep level, and the reap-vs-budget interaction, §8.
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
- `frontend/src/features/me/sheets/DecisionReviewSheet.tsx` — the rating + outcome review sheet. **Consumer-less since `mezo-d20.6.6`** (the review is inline on `JournalPage` now) — still exported, still tested, see §9.
- `frontend/src/features/me/pages/JournalPage.tsx` — `/me/naplo`, a `MozaikPage` full-page sibling of the Én hub (`PageHead` `‹ Én` + `+ Új bejegyzés`, `PageHero` streak number, `PageBody`/`EntranceGroup`): the month-grouped notes view + the „Döntések" block with its **inline** 1–5 review + the `GratitudeStreakCard`.
- `frontend/src/features/me/pages/EnHubPage.tsx` — the Én hub's „Napló" `Tile` → `/me/naplo`, with the honest „{n} napos hála-sorozat · {m} nyitott döntés" line (no line when neither holds). **`features/me/pages/tabs.ts` (`ME_TABS`) and `MeSection.tsx` are deleted** (F8, `mezo-d20.9.1`).
- `frontend/src/app/router.tsx` — `JournalPage` import + the flat `me/naplo` route.
- `frontend/src/shared/ui/mozaik/` (`MozaikPage`/`PageHead`/`PageHero`/`PageBody`, `Tile`) + `mozaik/motion.tsx` (`EntranceGroup`) + `frontend/src/shared/ui/clay/` (`ClaySpot name="s-orb-unnepel"` on the reviewed line) — the Mozaik 2.0 primitives the page renders through ([ADR 0033](../decisions/0033-mozaik-2-tile-language.md)).
- `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx` — the three-option picker phase (`naplo-pick` with Aktivitás/Napló/Hála as clay `Tile`s); the `'gratitude'` phase renders `JournalSheet` with `initialMode="gratitude"`, and every branch takes an `onBack` returning to the picker. Opened from `frontend/src/app/QuickLogFab.tsx`, the floating coral FAB that replaced the centre-FAB tab bar ([ADR 0032](../decisions/0032-five-tab-ia-dissolved-section-shells.md)).
- `frontend/src/features/me/logic/gratitudeStreak.ts` — `gratitudeStreakDays()` (consecutive days derived from entry dates, yesterday-grace).
- `frontend/src/features/me/components/GratitudeStreakCard.tsx` — streak card rendered on `/me/naplo` above the open-decisions block.
- `frontend/src/features/me/components/GratitudeRows.tsx` — the shared, state-free gratitude capture block (W1.3b, `mezo-b3pp.25`), extracted out of `JournalSheet` and reused by `features/ritual/components/ReflectionStep.tsx` (see [`ritual.md`](ritual.md) §2/§10).

**Frontend — tests**
- `frontend/src/data/journal/journalHooks.test.tsx`, `frontend/src/data/journal/decisionHooks.test.tsx`, `frontend/src/data/journal/gratitudeHooks.test.tsx`
- `frontend/src/features/me/sheets/JournalSheet.test.tsx`, `frontend/src/features/me/sheets/DecisionReviewSheet.test.tsx`
- `frontend/src/features/me/pages/JournalPage.test.tsx`
- `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx` (picker-phase cases including the Hála tile)
- `frontend/src/features/me/logic/gratitudeStreak.test.ts` (consecutive-day counting, yesterday-grace)
- `frontend/src/features/me/components/GratitudeStreakCard.test.tsx` (derived streak rendering, ghost copy)
- `frontend/src/features/me/components/GratitudeRows.test.tsx` (W1.3b, `mezo-b3pp.25` — §8)
- `frontend/src/data/hooks.reexport.test.ts` (barrel identity) + `frontend/src/features/me/pages/EnHubPage.test.tsx` (the hub's Napló tile) — `MeSection.test.tsx` was deleted with the shell.

**Docs**
- Design spec: [`docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`](../superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md) §4.1, §4.3, §5.1, §5.4, §11.
- Plans: [`docs/superpowers/plans/2026-08-18-w1-1-journal-embed-pipeline.md`](../superpowers/plans/2026-08-18-w1-1-journal-embed-pipeline.md), [`docs/superpowers/plans/2026-08-20-w1-4-decision-journal.md`](../superpowers/plans/2026-08-20-w1-4-decision-journal.md), [`docs/superpowers/plans/2026-08-21-w13-gratitude.md`](../superpowers/plans/2026-08-21-w13-gratitude.md).
- Roadmap: [`docs/milestones/roadmap.md`](../milestones/roadmap.md).
- References: [`docs/references/`](../references/) (`api_contract_conventions`, `liquibase_conventions`, `spring_patterns`, `testing_standards`, `configuration_conventions`, `java_package_structure`, `error_handling`).
