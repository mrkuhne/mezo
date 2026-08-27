# Note-vector lifecycle Implementation Plan (`mezo-b3pp.26`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** stop `activity_note` / `checkin_note` vectors from lying. Today they are WRITE-ONCE: editing the source row leaves the ORIGINAL vector standing (stale content recalled into chat), and a source row that stops being live leaves its vector orphaned and still recallable.

**What is actually reachable today (verified against main — the bd's framing needs one correction).**
- `activity_log` has **no edit and no delete surface at all** — `ActivityController` exposes only create / day / categorize / history, and `ActivityService.categorize` never touches `text`. So neither gap is reachable for activity notes through the API.
- `check_in` has **no delete**, but `CheckInService.save` is an **upsert on `(createdBy, date, slotTime)`** that overwrites `note` in place. Re-saving a slot with different (or shorter, or blank) text is a live, user-reachable path that makes the stored vector stale **today**.
So gap (a) is live for check-ins; gap (b) is defensive for both. The fix below is **source-of-truth based**, not event based, so it covers both regardless of which endpoints exist — and it keeps working when a delete surface eventually lands, with no new wiring. Say this plainly in the docs rather than implying live triggers that do not exist.

**Architecture:** the nightly sweep stops asking "does a vector exist?" and starts asking "does the vector still match its source?". Three outcomes per note kind, per user: a live qualifying note with no vector → embed (unchanged); a live note whose vector's content has drifted → re-embed in place; a vector whose source row is no longer live → soft-delete (reap). The content comparison and the re-embed both move **inside** `MemoryEmbeddingWriter`, because only it knows the cap that decides what "the same content" means.

**HARD CONSTRAINT (from the bd, and it has already bitten this codebase once).** `uq_memory_embedding_kind_ref_id` is a **plain, non-partial** unique index, so a soft-deleted vector keeps occupying its `(kind, ref_id)` slot. Every note re-write MUST go through `MemoryEmbeddingWriter.upsert` — which reads `MemoryEmbeddingRepository.findByKindAndRefIdIncludingDeleted` and revives the dead row — never the insert-only `write`. `write`'s own probe is `existsByKindAndRefId`, which is `@SQLRestriction`-filtered and therefore blind to the parked row: it would take the insert branch, hit the constraint, roll back, log a warn, and repeat that every single night forever. W1.2 (`mezo-b3pp.2`) hit exactly this; `upsert`'s javadoc and `RitualReflectionEmbeddingIT.testSaveReflection_shouldReviveTheVector_whenProseIsWrittenAgainAfterAClear` are the precedent.

**Tech Stack:** Java 21 / Spring Boot, JPA + Postgres + pgvector, Testcontainers ITs.

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.26)`. Conventional-commit subjects.
- **Spec §11:** integration-first tests. No new table → `support/ResetDatabase.java` and the populators stay untouched (`memory_embedding`, `activity_log`, `check_in` are all already truncated; `ActivityPopulator`/`CheckInPopulator` already exist).
- **Every embed call stays tagged** with `LlmCallContextHolder.runWith(new LlmCallContext("embed_memory", "document", kind, refId), …)` — it already is, inside `MemoryEmbeddingWriter`; do not add a second tagging site and do not bypass the existing one.
- **No API contract change, no frontend change** → no `generate:api`, no `pnpm` gate.
- **Slice-cycle discipline.** `feature.companion` must not import `feature.activity` or `feature.biometrics` repositories directly — that is the whole reason `NarrativeNoteSource` exists (read its javadoc; `ArchitectureTest#feature_slices_are_cycle_free` is a FreezingArchRule and will fail on a new cycle). Any new capability the sweep needs from a source goes on the **port**, implemented by `ActivityNoteSourceAdapter` (in `feature.activity`) and `CheckInNoteSourceAdapter` (in `feature.companion`, the documented asymmetry).
- **Reaping is a soft delete of the VECTOR only.** Never touch the source row. Never hard-delete anything.
- **Budget discipline:** a re-embed costs an embedding call and MUST consume the `note-batch-size` budget exactly like a first embed. A reap costs no LLM call and must NOT consume it.
- **Backend gate:** focused ITs only (`./mvnw clean test -Dtest='...' -Dmezo.test.use-testcontainers=true`, Docker up). Testcontainers mode is mandatory — the default fixed-DB mode races and fakes failures.
- **Docs in the same change:** `docs/features/journal.md` §9 (where both gaps are currently documented as known); regenerate `docs/CODEMAP.md`; `node scripts/lint-docs.mjs` with no new staleness.

---

## File Structure

| File | Responsibility |
|---|---|
| **Modify** `backend/.../companion/embedding/MemoryEmbeddingWriter.java` | `writeNote` → `syncNote` (upsert-based, drift-aware, compares against the CAPPED text); new `deleteNoteEmbedding`. |
| **Modify** `backend/.../companion/repository/MemoryEmbeddingRepository.java` | A projection finder returning `(refId, content)` for a user+kind, so the sweep never loads 768-float vectors it does not need. |
| **Modify** `backend/.../companion/NarrativeNoteSource.java` | One new port method: which of these ref-ids are still live, with their current text. |
| **Modify** `backend/.../activity/service/ActivityNoteSourceAdapter.java`, `backend/.../companion/embedding/CheckInNoteSourceAdapter.java` | Implement it. |
| **Modify** `backend/.../activity/repository/ActivityLogRepository.java`, the check-in repository | The finder each adapter needs. |
| **Modify** `backend/.../companion/embedding/NoteEmbeddingCatchUp.java` | Drift re-embed + reap, budget-aware, per-row isolated. |
| **Create** `backend/src/test/.../companion/embedding/NoteVectorLifecycleIT.java` | The three-outcome truth table. |
| **Modify** `docs/features/journal.md`, `docs/CODEMAP.md` | Ship state; the two §9 known-gap bullets become shipped seams. |

---

### Task 1: The writer learns drift and reap

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteVectorLifecycleIT.java` (new — Task 1 adds the writer-level cases, Task 2 the sweep-level ones)

**Interfaces:**
- Consumes: the existing private `upsert(...)` and `cap(...)`; `MemoryEmbeddingRepository.findByKindAndRefId` / `findByKindAndRefIdIncludingDeleted`; `NarrativeNoteSource.Note`.
- Produces (Task 2 calls these verbatim):
  ```java
  /** @return true iff an embedding call was actually spent (first write or drift re-embed). */
  public boolean syncNote(String kind, NarrativeNoteSource.Note note)   // @Transactional
  public void deleteNoteEmbedding(String kind, UUID refId)              // @Transactional
  ```
  and on the repository:
  ```java
  interface RefContent { UUID getRefId(); String getContent(); }
  List<RefContent> findRefContentByCreatedByAndKind(UUID createdBy, String kind);
  ```

- [ ] **Step 1: Write the failing writer-level tests**

Read `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingWriterIT.java` and `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualReflectionEmbeddingIT.java` first — the first for the harness (base class, `companion-fake` profile, populators, assertion style), the second because its revive case is the exact trap this task must not fall into. Mirror them; use this repo's `testX_shouldY_whenZ` naming. Cases:

```
testSyncNote_shouldWriteOneVector_whenTheNoteHasNoneYet
  => exactly one live memory_embedding(kind), content == the note text, returns true

testSyncNote_shouldDoNothingAndSpendNothing_whenTheContentIsUnchanged
  syncNote twice with the same text
  => still exactly one vector, its id UNCHANGED, and the second call returns false
     (assert the id so an invisible delete+insert cannot pass)

testSyncNote_shouldReembedInPlace_whenTheSourceTextChanged
  syncNote, then syncNote with different text
  => the SAME row id now carries the new content, and the call returns true

testSyncNote_shouldNotReembed_whenOnlyTheTextBeyondTheCapChanged
  THE CAP TRAP: with embed-max-chars = N, sync a note of length > N, then sync again with the
  SAME first N chars but a different tail
  => no re-embed (returns false), because the STORED content is the capped text and the vector
     must describe what is stored. Getting this wrong burns one embedding call per note per
     night forever.

testSyncNote_shouldReviveTheVector_whenItWasPreviouslyReaped
  syncNote, deleteNoteEmbedding, then syncNote again
  => exactly ONE live vector on the same (kind, ref_id) — the SAME row id revived, not a second
     row, and no unique-constraint failure
     (this is the mezo-b3pp.2 trap; it fails loudly if syncNote routes through the insert-only
      `write` instead of `upsert`)

testDeleteNoteEmbedding_shouldSoftDeleteTheVector_whenOneExists
  => findByKindAndRefId (SQLRestriction-filtered) sees nothing;
     findByKindAndRefIdIncludingDeleted still finds the row with is_deleted = true
     (assert through BOTH finders — findAll() cannot tell a soft delete from a hard one)

testDeleteNoteEmbedding_shouldDoNothing_whenThereIsNoVector
  => no exception, no row created
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd backend && ./mvnw clean test -Dtest='NoteVectorLifecycleIT' -Dmezo.test.use-testcontainers=true
```
Expected: compilation failure — `syncNote` / `deleteNoteEmbedding` do not exist.

- [ ] **Step 3: Add the repository projection**

In `MemoryEmbeddingRepository`, next to `findRefIdsByCreatedByAndKind`:

```java
    /** W1.5 lifecycle (mezo-b3pp.26): ref-id + stored content for one user's vectors of a kind —
     *  what the nightly sweep compares against the live source text to detect drift. A projection,
     *  not the entity: loading full rows here would drag a 768-float vector per note through the
     *  sweep for nothing. {@code @SQLRestriction}-filtered like every JPQL query, so a reaped
     *  vector is correctly absent — the sweep must treat "no live vector" as "needs writing", and
     *  {@link MemoryEmbeddingWriter#syncNote} then revives the parked row through the upsert path. */
    interface RefContent {
        UUID getRefId();
        String getContent();
    }

    @Query("select m.refId as refId, m.content as content from MemoryEmbeddingEntity m "
            + "where m.createdBy = :createdBy and m.kind = :kind")
    List<RefContent> findRefContentByCreatedByAndKind(@Param("createdBy") UUID createdBy,
                                                      @Param("kind") String kind);
```

- [ ] **Step 4: Replace `writeNote` with `syncNote`, and add `deleteNoteEmbedding`**

`writeNote` currently routes to the insert-only `write` and carries a javadoc admitting the gap. Replace it:

```java
    /**
     * W1.5 note unit (spec §5.5), lifecycle-aware since mezo-b3pp.26. There is no listener behind
     * these kinds — the nightly {@code NoteEmbeddingCatchUp} is their only writer — so "has this
     * note changed?" cannot be answered by an event and is answered here instead, against the
     * stored content.
     *
     * <p>The comparison is against the CAPPED text, not the raw source text, and that is
     * load-bearing: {@link #cap} is what actually gets stored, so a note longer than
     * {@code embedding.embed-max-chars} whose tail changes has NOT changed as far as its vector is
     * concerned. Comparing the raw text would re-embed such a note on every single nightly run,
     * forever, for no change in the stored content.
     *
     * <p>Routed through {@link #upsert}, never {@link #write}: a previously reaped vector keeps
     * its {@code (kind, ref_id)} slot under the plain (non-partial)
     * {@code uq_memory_embedding_kind_ref_id}, and only the upsert path looks past
     * {@code @SQLRestriction} to revive it (the mezo-b3pp.2 trap).
     *
     * @return true iff an embedding call was spent — a first write or a drift re-embed. The sweep
     *         uses this to charge its per-run budget, so an unchanged note costs nothing.
     */
    @Transactional
    public boolean syncNote(String kind, NarrativeNoteSource.Note note) {
        String capped = cap(note.text());
        Optional<MemoryEmbeddingEntity> live = memoryEmbeddingRepository.findByKindAndRefId(kind, note.id());
        if (live.isPresent() && capped.equals(live.get().getContent())) {
            return false;
        }
        upsert(note.createdBy(), kind, note.id(), note.text(), note.occurredOn());
        return true;
    }

    /** The reap half (mezo-b3pp.26): a note whose source row is no longer live must stop being
     *  recallable — the {@link #deleteJournalEmbedding} idiom, IDENT-3 honesty. Soft-deletes the
     *  VECTOR only; the source row is never touched here. */
    @Transactional
    public void deleteNoteEmbedding(String kind, UUID refId) {
        memoryEmbeddingRepository.findByKindAndRefId(kind, refId)
                .ifPresent(memoryEmbeddingRepository::delete); // @SQLDelete → soft delete
    }
```

Note for the implementer: `upsert` caps internally too, so passing `note.text()` (not `capped`) is correct and keeps a single capping site. Add whatever imports are missing (`Optional`, `MemoryEmbeddingEntity` if not already there). Delete the old `writeNote` — Task 2 updates its only caller; if anything else still calls it, stop and report rather than leaving both.

- [ ] **Step 5: Run the tests — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest='NoteVectorLifecycleIT,NoteEmbeddingWriterIT,RitualReflectionEmbeddingIT,JournalEmbeddingEventIT' -Dmezo.test.use-testcontainers=true
```
`NoteEmbeddingWriterIT` will not compile if it calls `writeNote` — update its call sites to `syncNote` (the behaviour it asserts is unchanged for a first write). Do not weaken any assertion it makes.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(companion): note vectors re-embed on drift and can be reaped (mezo-b3pp.26)"
```

---

### Task 2: The sweep stops asking "does a vector exist?"

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/NarrativeNoteSource.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/activity/service/ActivityNoteSourceAdapter.java` + `backend/src/main/java/io/mrkuhne/mezo/feature/activity/repository/ActivityLogRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/CheckInNoteSourceAdapter.java` + the check-in repository
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingCatchUp.java`
- Test: extend `NoteVectorLifecycleIT` with the sweep-level cases

**Interfaces:**
- Consumes from Task 1: `MemoryEmbeddingWriter.syncNote(String, Note) -> boolean`, `deleteNoteEmbedding(String, UUID)`, `MemoryEmbeddingRepository.findRefContentByCreatedByAndKind`.
- Produces — the new port method:
  ```java
  /** Which of {@code ids} are still LIVE rows for this user, with their current text.
   *  Deliberately NOT length-gated: liveness and substantiveness are different questions. */
  List<Note> liveNotes(UUID userId, Collection<UUID> ids);
  ```

- [ ] **Step 1: Write the failing sweep-level tests**

Read `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingCatchUpIT.java` and mirror its harness. Cases:

```
testRun_shouldReembed_whenACheckInNoteWasOverwrittenInPlace
  THE LIVE PATH: seed a check-in with a long note, sweep (one vector), then CheckInService.save
  the same (date, slotTime) with different text, sweep again
  => the same vector row id now carries the new text
  (this is reachable through the API today — check-in save is an upsert on the slot)

testRun_shouldReapTheVector_whenTheSourceRowIsNoLongerLive
  seed + sweep (one vector), soft-delete the source row through its repository, sweep again
  => the vector is soft-deleted (assert through findByKindAndRefIdIncludingDeleted, since the
     filtered finder cannot distinguish soft from hard)
  (no service-level delete surface exists for either source today — the repository write is the
   only way to reach this, and that is exactly why the sweep, not an event, is the fix)

testRun_shouldSpendNothing_whenNothingChanged
  sweep twice over an unchanged note
  => the second run reports zero writes and the vector's id is unchanged
     (guard against a re-embed-every-night regression)

testRun_shouldNotReap_whenALiveNoteFellBelowMinChars
  seed a long note, sweep, then shorten it below note-min-chars, sweep again
  => the vector is NOT reaped; it is RE-EMBEDDED with the shorter text
  (deliberate: liveness and length are different questions. Reaping on the length gate would
   mean that merely RAISING note-min-chars mass-deletes a user's existing memory on the next
   nightly run — a config change must never silently destroy vectors.)

testRun_shouldChargeTheBudgetForAReembed_butNotForAReap
  with note-batch-size = 1: one drifted note and one reapable vector
  => the reap still happens and the drift re-embed consumes the whole budget
     (mirror NoteEmbeddingBudgetIT's setup for the budget knob)

testRun_shouldKeepSweeping_whenOneRowFails
  per-row isolation is unchanged — one failing row must not abort the rest
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd backend && ./mvnw clean test -Dtest='NoteVectorLifecycleIT' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 3: Extend the port**

In `NarrativeNoteSource`, after `notesToEmbed`:

```java
    /**
     * Which of {@code ids} still exist as LIVE rows for this user, with their current text — the
     * lifecycle half of the sweep (mezo-b3pp.26). An id absent from the result is a row that is
     * gone (soft-deleted), and its vector gets reaped.
     *
     * <p>Deliberately NOT length-gated, unlike {@link #notesToEmbed}: liveness and
     * substantiveness are different questions. A note edited down below {@code note-min-chars}
     * is still LIVE and must be re-embedded with its shorter text, not reaped — otherwise merely
     * raising that config knob would mass-delete a user's existing vectors on the next run.
     *
     * <p>An empty {@code ids} must return an empty list without hitting the database.
     */
    List<Note> liveNotes(UUID userId, Collection<UUID> ids);
```

Implement in both adapters as a plain repository read, matching each one's existing style (`ActivityNoteSourceAdapter` maps `getText`/`getOccurredOn`; `CheckInNoteSourceAdapter` maps `getNote`/`getDate`). Each repository gains a finder in the style of its existing `findNoteCandidates`:

```java
    List<ActivityLogEntity> findByCreatedByAndIdIn(UUID createdBy, Collection<UUID> ids);
```
(and the check-in equivalent). Both are `@SQLRestriction`-filtered, which is exactly what "live" means here — do **not** write a native query.

- [ ] **Step 4: Rework the sweep's `embed` method**

Replace the ref-id-set logic in `NoteEmbeddingCatchUp.embed` with the three-outcome pass. Keep everything else — the budget-exhausted log, the per-row try/catch, the return count, the ordering — intact:

```java
    private int embed(NarrativeNoteSource source, UUID userId, LocalDate through, int minChars, int budget) {
        String kind = source.kind();
        if (budget <= 0) {
            log.info("Note-embedding budget already exhausted before user {} kind {} got a turn — "
                    + "starved this run, waits for the next one", userId, kind);
            return 0;
        }
        // What the vectors currently SAY, keyed by source row — the sweep compares against this
        // instead of merely asking "does a vector exist?" (mezo-b3pp.26). These kinds have no
        // listener, so drift and orphaning can only be noticed here.
        Map<UUID, String> storedByRef = memoryEmbeddingRepository
                .findRefContentByCreatedByAndKind(userId, kind).stream()
                .collect(Collectors.toMap(RefContent::getRefId, RefContent::getContent));

        // REAP first, and outside the budget: a reap spends no embedding call, and a vector whose
        // source is gone must stop being recallable tonight even if the budget is exhausted by
        // drifted notes (IDENT-3 honesty beats throughput).
        int reaped = 0;
        if (!storedByRef.isEmpty()) {
            Set<UUID> live = source.liveNotes(userId, storedByRef.keySet()).stream()
                    .map(Note::id).collect(Collectors.toSet());
            for (UUID refId : storedByRef.keySet()) {
                if (live.contains(refId)) {
                    continue;
                }
                try {
                    memoryEmbeddingWriter.deleteNoteEmbedding(kind, refId);
                    reaped++;
                } catch (Exception e) {
                    log.warn("Note-vector reap failed for user {} kind {} ref {}", userId, kind, refId, e);
                }
            }
        }
        if (reaped > 0) {
            log.info("Reaped {} orphaned note vector(s) for user {} kind {}", reaped, userId, kind);
        }

        List<Note> candidates = source.notesToEmbed(userId, through, minChars);
        int written = 0;
        for (Note note : candidates) {
            if (written >= budget) {
                log.info("Note-embedding budget reached for user {} kind {} — the rest waits for the next run",
                        userId, kind);
                break;
            }
            // Unchanged notes cost nothing and must not charge the budget — syncNote returns
            // false for them, which is the whole reason it returns a boolean.
            try {
                if (memoryEmbeddingWriter.syncNote(kind, note)) {
                    written++;
                }
            } catch (Exception e) {
                log.warn("Note-embedding failed for user {} kind {} ref {}", userId, kind, note.id(), e);
            }
        }
        return written;
    }
```

Two subtleties the implementer must not smooth over:
1. A note that is live but has drifted **below** `minChars` will not be in `candidates`, so it is neither re-embedded nor reaped — its stale vector survives. Decide this explicitly: leave it, and note the residue in the docs (Task 3). Do **not** "fix" it by reaping on the length gate; that is the config-knob landmine the port's javadoc warns about. (Fixing it properly would mean sourcing candidates by liveness rather than length, which changes what the sweep is for and belongs in its own slice.)
2. `storedByRef` is `@SQLRestriction`-filtered, so an already-reaped vector is absent and its note becomes a first-write candidate again — which is correct **only** because `syncNote` goes through `upsert` and revives the parked row. If the source is still live and qualifying, the vector comes back; that is the intended self-healing.

Add the imports (`Map`, `Set`, `Collectors`, `RefContent`) and drop the now-unused `findRefIdsByCreatedByAndKind` import if nothing else uses it (grep before deleting the repository method itself — leave it if another caller exists).

- [ ] **Step 5: Run the tests — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest='NoteVectorLifecycleIT,NoteEmbeddingCatchUpIT,NoteEmbeddingBudgetIT,NoteEmbeddingSwitchOffIT,NoteEmbeddingWriterIT' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 6: The architecture gate — the cycle rule this task could break**

```bash
cd backend && ./mvnw clean test -Dtest='ArchitectureTest' -Dmezo.test.use-testcontainers=true
```
Expected: green. `feature_slices_are_cycle_free` is a FreezingArchRule — if the port method was implemented by importing an activity/biometrics repository from `feature.companion` instead of going through the adapter, this is what catches it.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature backend/src/test/java/io/mrkuhne/mezo/feature
git commit -m "feat(companion): the note sweep re-embeds drifted vectors and reaps orphans (mezo-b3pp.26)"
```

---

### Task 3: Docs + gates

**Files:**
- Modify: `docs/features/journal.md` — §9 carries both gaps as KNOWN; they become shipped seams. Also the W1.5 section wherever `writeNote`/write-once is described, and §8's test list. Bump `updated:`.
- Modify: `docs/CODEMAP.md` (regenerate).

- [ ] **Step 1: Rewrite the §9 gap bullets as shipped behaviour**

The prose must now say:
- The sweep compares the stored vector's content against the live source text and **re-embeds in place on drift**; unchanged notes cost nothing and do not charge the budget.
- A vector whose source row is no longer live is **reaped** (the vector soft-deleted, the source untouched), outside the budget, because honesty beats throughput.
- The comparison is against the **capped** text (`embedding.embed-max-chars`), because that is what is stored — comparing the raw text would re-embed every over-length note every night forever.
- Re-writes go through `upsert`, never the insert-only `write`, because `uq_memory_embedding_kind_ref_id` is plain (non-partial) and a reaped vector keeps its slot — the `mezo-b3pp.2` trap. A reaped-then-revived note reuses the SAME row.

Be honest about what is and is not reachable, the way this repo's docs are elsewhere:
- `activity_log` has **no edit and no delete surface** today, so neither gap is reachable for activity notes through the API; the sweep covers them anyway and needs no new wiring when a surface lands.
- `check_in` has no delete, but `CheckInService.save` upserts on `(createdBy, date, slotTime)` and overwrites `note` in place — **the live path** that made a stale vector reachable today.
- **The one residue:** a live note edited down below `note-min-chars` leaves its old vector standing — it drops out of the candidate set, so it is neither re-embedded nor reaped. Reaping on the length gate was rejected deliberately: raising that config knob would then mass-delete existing vectors on the next run. Name this as a known, bounded gap rather than leaving it silent.

- [ ] **Step 2: Regenerate the codemap and lint the docs**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs 2>&1 | tail -5
```
Expected: `--check` passes; `lint-docs` no NEW findings versus the pre-edit baseline (capture it by running the linter once before editing).

- [ ] **Step 3: Focused backend gate**

```bash
cd backend && ./mvnw clean test -Dtest='NoteVectorLifecycleIT,NoteEmbeddingCatchUpIT,NoteEmbeddingBudgetIT,NoteEmbeddingSwitchOffIT,NoteEmbeddingWriterIT,RitualReflectionEmbeddingIT,JournalEmbeddingEventIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 4: Commit**

```bash
git add docs/features/journal.md docs/CODEMAP.md
git commit -m "docs(features): journal — note vectors re-embed on drift and reap on orphan (mezo-b3pp.26)"
```

---

## Self-Review

- **bd coverage.** (a) stale-on-edit → Task 1's drift comparison + Task 2's sweep rework. (b) orphan-on-delete → `deleteNoteEmbedding` + the reap pass. The bd's own fix shape ("compare the stored content against the source text and re-embed on drift; reap vectors whose source row is no longer live") is implemented literally. The bd's HARD CONSTRAINT is honoured by routing `syncNote` through `upsert`, and pinned by `testSyncNote_shouldReviveTheVector_whenItWasPreviouslyReaped` — which fails loudly if someone reverts to `write`.
- **Where this plan corrects the bd.** The bd implies both gaps are user-reachable. `activity_log` has neither an edit nor a delete endpoint, and `check_in` has no delete — the only live path is the check-in slot upsert overwriting `note`. Recorded in the docs rather than papered over.
- **What this plan adds beyond the bd:** the cap comparison (without it, every over-length note burns an embedding call nightly, forever — a cost bug introduced by the fix itself), the budget rule (re-embeds charge, reaps do not), and the explicit rejection of length-gated reaping with its reasoning.
- **Placeholders.** Production code is literal. Test bodies are named cases with exact seed→act→assert, deferring harness boilerplate to the four existing note/embedding ITs they must mirror.
- **Type consistency.** `syncNote(String, Note) -> boolean` and `deleteNoteEmbedding(String, UUID)` as declared in Task 1 are exactly what Task 2 calls. `RefContent` is produced in Task 1 Step 3 and consumed in Task 2 Step 4. `liveNotes(UUID, Collection<UUID>) -> List<Note>` is declared in Task 2 Step 3 and called in Step 4. `NarrativeNoteSource.Note` is the existing record `(UUID id, UUID createdBy, String text, LocalDate occurredOn)`.
