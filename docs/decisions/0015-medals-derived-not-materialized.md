# 0015 — Medals are replayed from `exercise_set`, not stored

- **Status:** Accepted
- **Date:** 2026-07-30
- **Driver:** mezo-wp6n

## Context

Nothing in mezo compared a *logged* set against anything: the mid-workout "Personal Record" toast
was a scripted demo (`weight ≥ 105` on exercise 0's third set, a hardcoded date in the copy), and the
workout summary's `· PR ✨` suffix came from a `max_strength` skill level-up (an XP-threshold
crossing), not a broken record. The medal-collection feature (design:
[`2026-07-30-medal-collection-design.md`](../superpowers/specs/2026-07-30-medal-collection-design.md))
closes that gap with five medal types — `WEIGHT`, `REPS_AT_WEIGHT`, `E1RM`, `SESSION_VOLUME` (tier
`RECORD`) and `TARGET_HIT` (tier `TARGET`) — evaluated per logged set against the user's own history
and against the session's prescription.

The neighbouring engine, `ExerciseRecordService` (best set / e1RM / session volume / reps-at-weight
per exercise identity, backing the `Gyakorlatok` tab), already answers a structurally identical
question by aggregating over *all* the user's working sets in memory on every read
(`ExerciseRecordService.java:49`) — single-user data volume (low thousands of sets) makes that
trivially fast. Its own design record explicitly deferred the harder, live version of this problem:
[`2026-06-12-exercise-records-design.md`](../superpowers/specs/2026-06-12-exercise-records-design.md)'s
"Out of scope (YAGNI)" section (`:121-125`) shelved **live PR detection / toast during an active
workout** and a **materialized `exercise_record` table**, to "revisit when PR-feed/notifications are
wanted." Building the live-feedback feature now is exactly that revisit — and it turns out no
materialized table is needed after all.

## Decision

**A medal is not a stored fact.** It is a consequence of the `exercise_set` rows, recomputed by
chronological replay per exercise identity — no `set_medal`/`exercise_medal` table exists.
`MedalService` (`feature/train/service/MedalService.java`) loads the owner's working sets once,
groups them by identity (the same `"c:{catalogId}"`/`"n:{name}"` idiom `ExerciseRecordService` and
`ExerciseHistoryResolver` already use, read over `findIdentityRowsIncludingDeleted` so a soft-deleted
day-edit row still counts), and replays them in a **total chronological order** (`setInstant` →
`setIndex` → `id` — needed because Postgres `now()` is transaction-scoped, so two sets committed in
the same transaction would otherwise tie and make the outcome DB-row-order dependent) through the
pure `MedalEvaluator` (`feature/train/service/MedalEvaluator.java`, no Spring, no DB — the
`ProgressionDecider` idiom) to yield `list`/`forSet`/`forSet`-session reads. This reverses the 2026-06-12
YAGNI call above: the "materialized record table" that call assumed a live-PR feature would need
never had to be built.

**Reasons, mirroring the design spec §4:**
- **It cannot drift.** Editing or deleting a past set automatically corrects the medal history — a
  materialized table would keep asserting a record the data no longer supports.
- **Backfill is free.** The four RECORD types replay over the *entire* existing set history with no
  migration script, one-shot job, or reconciliation path — the cabinet is populated on first open.
- **It matches the neighbouring engine's own precedent and its cost profile** — `MedalService`'s
  replay is the same order of magnitude, over the same rows, as `ExerciseRecordService`'s existing
  in-memory aggregation.

## Consequences

**Accepted costs — recorded here honestly, not just the upside:**
- **Recompute-on-read.** The cabinet (`GET /api/train/medals`) recomputes the full replay on every
  open. At single-user volume this is milliseconds; if it ever isn't, the escape hatch is a cache in
  front of `MedalService`, not a table.
- **No "new / unseen medal" state is possible, by construction.** Whether a medal has been "seen" is
  mutable state — it cannot be derived from `exercise_set` the way the medal itself can. v1 therefore
  ships with **no unseen badge and no record notification** on the cabinet; a medal is either derivable
  right now or it doesn't exist. This was already ruled out of scope for other reasons (§2 non-goals:
  no push notifications on a record), but it is worth stating plainly that the storage model
  *forecloses* it, not just defers it — adding it later means adding the first piece of actually-stored
  medal state, not flipping a switch.
- **Two evaluators, one truth.** The frontend ports the same §6 rules into `medalEvaluator.ts` for mock
  mode (seeded from the mock plan's `lastWeek`, since `SESSION_VOLUME` is deliberately not evaluated in
  mock mode). Nothing enforces the two stay in sync beyond the FE test table being a deliberate mirror
  of the backend's — a shared source was judged not worth it for one ported function (design spec §13).

**The one thing that had to be persisted, and why it's unavoidable:** `TARGET_HIT` needs the
prescription (`target_weight_kg`, `target_reps`) that was *in force when the set was logged*.
`ProgressionSignal` is recomputed from the *latest* history on every read (`SetRecommendationService`),
so it cannot be reconstructed retroactively for a past set — a pure-derivation model has nothing to
replay a target from unless the target itself rides the row. `exercise_set` therefore gains two
nullable columns, written server-side from the client-supplied snapshot at log time
(`202607301900_mezo-wp6n_exercise_set_target.sql`): `target_weight_kg NUMERIC(6,2)` and
`target_reps INTEGER`. Null means "no prescription was in force" (first session, engine switch off, or
a row that predates this change) — such a set can never earn a `TARGET_HIT`, and is not treated as a
miss either. Consequence: **the four RECORD types backfill for free over all existing history;
`TARGET_HIT` accrues only going forward** from the columns' introduction.

## Alternatives considered

- **A materialized `set_medal`/`exercise_medal` table, written at log time.** Rejected: it would drift
  the moment a past set is edited or deleted (soft-delete + day-edit reinsert already happens
  routinely elsewhere in Train), needing its own reconciliation job — exactly the failure mode the
  derived model avoids by construction. It would also require a backfill migration/job to populate
  history for the four RECORD types, where the derived model gets that backfill for free.
- **A table, kept only to carry an "unseen" flag for a future notification feature.** Rejected for now:
  medal "unseen" state and record push notifications are explicitly out of scope for this feature
  (design spec §2 non-goals). Building the storage ahead of the feature would be exactly the kind of
  speculative table the 2026-06-12 YAGNI call was right to defer the first time; if/when unseen-state
  is actually wanted, it can be added as its own small mutable table without touching the medal
  derivation itself.
- **A shared Java/TypeScript rule module for the evaluator.** Rejected: porting one pure function
  (`MedalEvaluator` → `medalEvaluator.ts`) twice, kept honest by a mirrored test table, was judged
  cheaper than standing up cross-language code generation for a single-feature rule set.
