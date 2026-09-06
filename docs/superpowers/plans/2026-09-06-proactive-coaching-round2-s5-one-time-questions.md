# Proactive Coaching Round 2 · S5 — Once-Ever Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the **once-ever question** mechanism — an advice card that asks the user ONE honest question, exactly once per user for the whole life of the account, captures the one-tap answer through the existing feedback path, stores it as a `knowledge_fact`, and then does **nothing else** — and ship its first two questions: the round-2 spec's item (17) *feature abandonment* and item (18) *flat exercise feedback*.

**Architecture:** Slice S5 of `docs/superpowers/specs/2026-09-05-proactive-coaching-round2-design.md` §c / §(17) / §(18). No new flag, no new cron, no new endpoint, no FE change. A new `OneTimeQuestionService` (the `SetupCheckService` idiom, but "once ever" instead of "at most weekly") is called by the existing `SetupCheckJob` right after the setup checks; two pure detectors decide whether a question has anything to ask; delivery is the ordinary `AdviceCardService` path with a new **verbatim** bypass so the LLM cannot rewrite a question into advice. The answer arrives on the existing `PUT /api/companion/feedback` (`artifactKind=feed_message`) path, which now publishes an event; a proactive listener turns the 👍/👎 into one `knowledge_fact` row with the new `question` source.

**Tech Stack:** Spring Boot backend (`backend/`), Liquibase SQL changesets, JUnit ITs extending `AbstractIntegrationTest`, Awaitility for the one async hop. **No frontend work in this slice.**

**Driving issue:** `mezo-d58h.7.5` (child of `mezo-d58h.7`, created in Task 0). Branch: `feat/proactive-round2-s5-one-time-questions`.

---

## The five things that make this slice dangerous

**1. "Once ever" dies to soft deletes.** The spec's dedupe is the envelope-key read `SetupCheckService.inReEmitWindow` uses — and that read goes through JPA, i.e. through `@SQLRestriction("is_deleted = false")` on `CompanionMessageEntity`. A question card that gets **superseded** the same afternoon (any flag outranks it — questions rank next-to-last) is soft-deleted, becomes invisible to that read, and the question comes back tomorrow. And the day after. The dedupe in this slice is therefore a **native query that deliberately sees soft-deleted rows** (`QUESTION_ASKED_SQL` in Task 5). Decided consequence, do not "fix" it back: a question that was displaced before the user ever saw it is **burned forever**. That is the cheaper failure — no mutation follows from an answer, so an unasked question costs nothing, while a question that re-asks every week is exactly the pestering the spec rules out.

**2. The LLM would rewrite the question into advice.** `AdviceCardService.deliver` unconditionally runs `AdviceProseGenerator.write`, whose prompt orders the model to write "2-3 mondatos tanácsot … mondd meg, mi a következő apró lépés" and **forbids numerals**. Run a question through it and you get a coaching paragraph with the question — and the 👍/👎 answer key — dissolved out of it. Task 1 adds a `verbatim` component to `AdviceCandidate`; a verbatim candidate's `fallbackProse` IS the card body and the LLM is never called. This is also why the question's facts may contain numbers at all: `ProseNumberGuard` never runs on this card.

**3. `habit_day` rows are written by the app, not by the user.** `HabitService.ensureRows`/`ensureRow` materialize a `pending` row for every active habit def on **any read** of the habit surface, and a cron later closes stale rows to `missed`. Counting `habit_day` rows as "usage" would therefore report the mind family as heavily used by a user who never touched it — and would count rows created *by the abandonment window itself*. Only `status = 'done'` counts (Task 3). The same care applies family-wide: `ai_message` counts `role = 'user'` only (the assistant's own replies are not usage).

**4. A verdict on a question card is an ANSWER, not an effectiveness vote.** `FeedbackLearningService` rolls every `feed_message` verdict into `surface:feed_message` (and the style/down-reason histogram). Left alone, a 👎 meaning "no, it just faded" would teach the rollup that the companion's cards are unhelpful — the system would learn a lie from its own survey. Task 7 excludes question cards from every rollup scope, through a new `FeedMessageKindSource` method (the port inversion already in place — `companion` must never import `proactive` to learn what a question key is).

**5. The spec's migration sentence is half wrong.** It says one migration widens the flag-key CHECK *and* "the setup-key set with the 2 question keys". There is **no setup-key CHECK** anywhere in the schema — `setupKey` lives inside the `content` jsonb, unconstrained (verified: nothing in `db/changelog` mentions `setup_key`). And S5 adds no flag key, so `ck_companion_flag_log_flag_key` is untouched too. The one real DB change in this slice is unrelated to both: `ck_knowledge_fact_source` must gain `'question'`, or the answer write dies at insert time on a CHECK (Task 6).

---

## Decisions already made — do not re-litigate

- **Questions are delivered by the existing `SetupCheckJob`, not a new cron.** The spec forbids a new cron near the dawn cluster; the setup-check pass (06:10) is already a per-user, per-day, two-switch fan-out with per-user exception isolation. The questions run as a second call in the same loop, after the setup checks.
- **Shared daily budget, enforced twice.** `OneTimeQuestionService` refuses to speak at all when today already has an `advice` row (the explicit budget gate the spec asks for), and the questions additionally rank next-to-last in `AdvicePriority` so a card raised later that day wins the contest anyway. Both are deliberate: the gate makes the intent legible and the log honest, the rank makes the invariant hold even if a future caller skips the gate.
- **One question per run, ordered first-wins** (`feature_abandonment` before `flat_feedback`) — the `SetupCheckService` ordering idiom. Never two questions in one day, because never two `advice` rows in one day.
- **Question keys rank immediately before `all_healthy`** — below every flag AND below the setup checks. A survey question must never displace a health signal. `all_healthy` stays last so `AdvicePriorityTest`'s tail assertion still means what it says.
- **The answer is a 👍/👎 on the existing feedback path** (spec §c), and the card states the mapping in its own `suggestions` lines ("👍 — …" / "👎 — …"). No contract change, no FE change. **Accepted limitation:** the sheet still prints the generic „Segített?" label above the chips for `kind=advice` rows (`MezoMessagesSheet.tsx:60`). A follow-up bd issue is filed in Task 8 for the FE label; it is explicitly NOT in this slice.
- **The answer is stored as ONE `knowledge_fact` with `source='question'`, rewritten in place on a flip.** Not a `learned_fact` candidate: the user already answered explicitly, so routing it through the Tudástár accept/reject inbox would ask the same thing twice. `include_in_prompt` stays at its default `true` — "he deliberately shelved journaling" is exactly the kind of fact the companion should carry into every prompt.
- **Nothing else follows from an answer** (spec: "no mutation"). No feature hiding, no data exclusion, no change to any rule's inputs — item (18)'s answer does NOT alter what `JointOveruseRule` reads.
- **Silence is the default everywhere.** An empty table means "never used", which is not abandonment; fewer than 8 feedback-carrying workouts means "not enough data", not "flat". Both stay quiet.
- **No new flag key, no `FlagKey`/`FlagEvaluator`/flag-CHECK work in this slice.** Questions are a setup-tier delivery, not a detection flag.

---

## Global Constraints

- **Adherence-neutral firing policy** (spec-wide): too little data ⇒ silence, never a negative signal. Every honesty gate gets its own silence test.
- **Every threshold is config** (`QuestionProperties`, Bean-Validation ranges, `application.yml` defaults). No numbers in the detector classes.
- **Switches:** every new bean is `@ConditionalOnProperty(name = {COMPANION_SWITCH, PROACTIVE_SWITCH}, havingValue = "true")` — the `SetupCheckService` layout. `FeedMessageKindService` (Task 7) keeps its COMPANION-only condition; do not add the proactive switch to it, the nightly rollup must still resolve it.
- **ArchUnit (CI):** services in `..service..`, entities in `..entity..`, repositories in `..repository..`, constructor DI only, no class-level `@Transactional`, no Spring `@Value`. Directions used here — `proactive → {journal, habit, ritual, needs, train, companion}` — are all pre-existing and one-way; **`companion` must never import `proactive`** (that is why Task 7 goes through `FeedMessageKindSource`). Run the ArchUnit test, do not take this on trust.
- **Liquibase changesets are immutable**; the new file is timestamped after the newest existing one (`202609061700_mezo-d58h.7.4_flag_key_trace_meal_rhythm_drift.sql`) and registered in `1.0.0_master.yml`. CI's `lint` job runs `node scripts/lint-liquibase.mjs`.
- **Backend runs REQUIRE** `-Dmezo.test.use-testcontainers=true`, and Maven's OWN exit code — never a pipeline's. "Tests run: 0", or a `-Dtest` filter matching nothing, is a FAILURE to report, not a pass. **ITs run under Surefire in this repo** (`docs/infrastructure/local-dev-testing.md`): the focused command is `backend/mvnw -f backend/pom.xml test -Dtest='…'` from the worktree root — `-Dit.test=… verify` silently runs the WHOLE suite, which OOM-dies on this machine.
- Run everything from **this worktree root**; never `cd` to the primary repo. Commit subjects carry `(mezo-d58h.7.5)` plus the `Co-Authored-By:` trailer. Regenerate `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`) in the same change as any new file, and AFTER any docs edit.

---

## File Structure

| File | Responsibility |
|---|---|
| `proactive/service/AdviceCandidate.java` (M) | `verbatim` component + `fromQuestion` factory |
| `proactive/service/AdviceCardService.java` (M) | skip the LLM for a verbatim candidate |
| `proactive/config/QuestionProperties.java` (C) | `mezo.proactive.questions` thresholds |
| `proactive/service/FeatureAbandonmentDetector.java` (C) | item (17) trigger logic |
| `proactive/service/FlatFeedbackDetector.java` (C) | item (18) trigger logic |
| `proactive/service/OneTimeQuestionService.java` (C) | keys, texts, budget gate, once-ever dedupe, delivery |
| `proactive/service/QuestionAnswerService.java` (C) | verdict → one `knowledge_fact`, rewritten in place |
| `proactive/service/QuestionAnswerListener.java` (C) | async AFTER_COMMIT hop off the feedback write |
| `proactive/service/SetupCheckJob.java` (M) | second call in the same per-user loop |
| `proactive/service/AdvicePriority.java` (M) | two `ORDER` entries |
| `proactive/service/FeedMessageKindService.java` (M) | `answerArtifactIds` implementation |
| `proactive/repository/CompanionMessageRepository.java` (M) | native once-ever dedupe read |
| `companion/feedback/service/MessageFeedbackService.java` (M) | publish `MessageFeedbackRecordedEvent` |
| `companion/feedback/service/MessageFeedbackRecordedEvent.java` (C) | the event record |
| `companion/feedback/service/FeedMessageKindSource.java` (M) | `answerArtifactIds` port method |
| `companion/feedback/service/FeedbackLearningService.java` (M) | drop answer verdicts from every scope |
| `companion/entity/KnowledgeFactEntity.java` (M) | `SOURCE_QUESTION` + `@Pattern` mirror |
| `companion/repository/KnowledgeFactRepository.java` (M) | `findByCreatedByAndSourceAndDeletedFalse` |
| `journal/repository/{JournalEntry,GratitudeEntry,DecisionEntry}Repository.java` (M) | count + exists seams |
| `habit/repository/HabitDayRepository.java` (M) | status-scoped count + exists seams |
| `ritual/repository/RitualDayRepository.java` (M), `needs/repository/NeedsDayRepository.java` (M) | count + exists seams |
| `companion/repository/AiMessageRepository.java` (M) | role-scoped count + exists seams |
| `train/repository/ExerciseFeedbackRepository.java` (M) | newest-first capped read |
| `db/.../202609061800_mezo-d58h.7.5_knowledge_fact_source_question.sql` (C) + `1.0.0_master.yml` (M) | `ck_knowledge_fact_source` widening |
| `application.yml` (M) | `mezo.proactive.questions` defaults |
| `support/populator/CreatedAtBackdater.java` (C, test) | the age seam every (17) test needs |
| `support/populator/TrainPopulator.java` (M, test) | `createFeedbackAt` for ordered feedback rows |
| `feature/proactive/QuestionPropertiesIT.java` (C, test) | config binds + ranges |
| `feature/proactive/FeatureAbandonmentDetectorIT.java` (C, test) | item (17) |
| `feature/proactive/FlatFeedbackDetectorIT.java` (C, test) | item (18) |
| `feature/proactive/OneTimeQuestionServiceIT.java` (C, test) | once-ever, budget, verbatim |
| `feature/proactive/QuestionAnswerIT.java` (C, test) | answer → fact, flip, async wiring |
| `feature/proactive/OneTimeQuestionSwitchOffIT.java` (C, test) | switch-off proof |
| `feature/proactive/service/AdvicePriorityTest.java` (M, test) | the two new keys + the reflection guard |
| `feature/proactive/AdviceCardServiceIT.java` (M, test) | verbatim bypass |
| `feature/companion/FeedbackLearningServiceIT.java` (M, test) | answer verdicts excluded |
| `docs/features/proactive.md`, `docs/features/companion.md`, `docs/CODEMAP.md` (M) | docs |

---

### Task 0: issue + branch

- [ ] **Step 1: Create the driving issue and cut the branch.**

```bash
bd create "Round 2 S5 — once-ever question mechanism + (17) + (18)" -t feature -p 2 --parent mezo-d58h.7 -d "Spec 2026-09-05 §c: a once-ever question card (setup-tier, shared daily budget), the answer captured through the existing feedback path and stored as a knowledge_fact. Two questions: (17) feature abandonment, (18) flat exercise feedback. No mutation follows." && git switch -c feat/proactive-round2-s5-one-time-questions
```

- [ ] **Step 2: Claim it** (substitute the id bd printed if it is not `mezo-d58h.7.5`; every commit subject below uses it).

```bash
bd update mezo-d58h.7.5 --claim
```

---

### Task 1: the verbatim advice candidate

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceCandidate.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceCardService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/AdviceCardServiceIT.java` (modify)

**Why first:** every later task delivers through `AdviceCardService`, and until this exists the question text cannot survive delivery.

**Interfaces:**
- Produces: `AdviceCandidate.fromQuestion(String questionKey, String eyebrow, List<String> facts, List<String> answers, String questionText)` → a candidate with `setupKey == questionKey`, `interventionKey == null`, `verbatim == true`.
- Produces: `boolean AdviceCandidate.verbatim()` — `false` on every pre-existing factory.

- [ ] **Step 1: Write the failing test.** Append to `AdviceCardServiceIT`:

```java
    /** S5 round 2 (mezo-d58h.7.5): a verbatim candidate's body is its own text, character for
     *  character. The fake LLM would answer with its own sentence for any prompt it is given, so
     *  an unchanged body is proof the generator was never called — not merely that it agreed. */
    @Test
    void testDeliver_shouldUseTheCandidateTextVerbatim_whenTheCandidateIsVerbatim() {
        UUID owner = userPopulator.createUser().getId();
        String question = "Tudatosan tetted félre, vagy csak kikopott? 👍 / 👎";

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner,
            AdviceCandidate.fromQuestion("question_feature_abandonment", "Mezo · kérdés",
                List.of("Az elmúlt 30 napban nem volt bejegyzés."), List.of("👍 — igen", "👎 — nem"),
                question));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().body()).containsExactly(question);
        assertThat(card.orElseThrow().getContent().setupKey()).isEqualTo("question_feature_abandonment");
        assertThat(card.orElseThrow().getContent().suggestions())
            .containsExactly("👍 — igen", "👎 — nem");
        assertThat(card.orElseThrow().getContent().facts())
            .containsExactly("Az elmúlt 30 napban nem volt bejegyzés.");
    }
```

- [ ] **Step 2: Run it and watch it fail.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='AdviceCardServiceIT' -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `fromQuestion` does not exist.

- [ ] **Step 3: Add the component and the factory.** In `AdviceCandidate.java`, add the javadoc line and the component, and pass `false` from the two existing factories:

```java
 * @param verbatim        true when the card's body must be {@code fallbackProse} EXACTLY — the
 *                        once-ever questions (S5 round 2, bd mezo-d58h.7.5, spec §c). The advice
 *                        prompt orders the model to write coaching advice and forbids numerals;
 *                        a question run through it comes back as advice with the 👍/👎 answer key
 *                        dissolved out of it. False for every flag- and setup-sourced candidate:
 *                        those ARE advice, and their wording is the model's job.
 */
public record AdviceCandidate(String adviceKey, String interventionKey, String setupKey,
                              String eyebrow, List<String> facts, List<String> suggestions,
                              String fallbackProse, boolean verbatim) {

    /** A flag-sourced candidate: the library entry key rides along for cooldown/rollup/push. */
    public static AdviceCandidate fromFlag(String flagKey, String interventionKey, String eyebrow,
                                           List<String> facts, List<String> suggestions,
                                           String fallbackProse) {
        return new AdviceCandidate(flagKey, interventionKey, null, eyebrow, facts, suggestions,
            fallbackProse, false);
    }

    /** A setup-sourced candidate: no library entry, so no push anchor and no per-entry rollup. */
    public static AdviceCandidate fromSetupCheck(String checkKey, String eyebrow,
                                                 List<String> suggestions, String fallbackProse) {
        return new AdviceCandidate(checkKey, null, checkKey, eyebrow, List.of(), suggestions,
            fallbackProse, false);
    }

    /** A once-ever QUESTION (S5 round 2, bd mezo-d58h.7.5): setup-tier identity (it rides the same
     *  {@code setupKey} envelope slot, which is what the once-ever dedupe reads), its own evidence
     *  list, the two one-tap answers as suggestions, and a body the LLM never touches. */
    public static AdviceCandidate fromQuestion(String questionKey, String eyebrow,
                                               List<String> facts, List<String> answers,
                                               String questionText) {
        return new AdviceCandidate(questionKey, null, questionKey, eyebrow, facts, answers,
            questionText, true);
    }
}
```

- [ ] **Step 4: Honour it in the card service.** In `AdviceCardService.deliver`, replace the single prose line:

```java
        // S5 round 2 (bd mezo-d58h.7.5): a verbatim candidate (the once-ever questions) is its own
        // body — AdviceProseGenerator's prompt would turn a question into advice and drop the
        // 👍/👎 answer key. Nothing else about delivery changes: same gate, same rank, same row.
        String prose = candidate.verbatim()
            ? candidate.fallbackProse()
            : adviceProseGenerator.write(userId, candidate);
```

Add to the class javadoc, after the "Lock hold time" paragraph:

```java
 * <p><b>Verbatim candidates</b> (S5 round 2, bd mezo-d58h.7.5) skip the LLM call entirely, so for
 * a question card the lock hold time above collapses to the two queries around it.
```

- [ ] **Step 5: Run the test.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='AdviceCardServiceIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS, every pre-existing test in the class included.

- [ ] **Step 6: Commit.**

```bash
git add -A && git commit -m "feat(proactive): verbatim advice candidates for once-ever questions (mezo-d58h.7.5)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: the read seams and the age seam

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/JournalEntryRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/GratitudeEntryRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/DecisionEntryRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/repository/HabitDayRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/repository/RitualDayRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/needs/repository/NeedsDayRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/AiMessageRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/ExerciseFeedbackRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/CreatedAtBackdater.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/support/populator/UsageSeamIT.java` (create)

**Fixture facts discovered while executing (they bite every later task too):** `journal_entry.source` is CHECK-constrained to `quickinput|ritual` (not `manual`); `exercise_feedback` carries FKs to BOTH `workout_session` and `exercise`, so a debrief fixture needs a real mesocycle → template day → exercise → instance chain (one template exercise is enough — uniqueness is per (instance, exercise)); and a populator method that runs a native update needs its own `@Transactional`.

**Why:** item (17) is entirely a statement about `created_at`, and `@CreationTimestamp` writes `now()` on every insert — without a backdating seam every abandonment test would be vacuous (nothing can be older than 30 days). Item (18) needs feedback rows in a **known** order, which `createFeedback` cannot give either.

**Interfaces:**
- Produces: `long countByCreatedBy(UUID)` / `boolean existsByCreatedByAndCreatedAtAfter(UUID, Instant)` on the journal (×3), ritual and needs repositories.
- Produces: `long countByCreatedByAndStatus(UUID, String)` / `boolean existsByCreatedByAndStatusAndCreatedAtAfter(UUID, String, Instant)` on `HabitDayRepository`.
- Produces: `long countByCreatedByAndRole(UUID, String)` / `boolean existsByCreatedByAndRoleAndCreatedAtAfter(UUID, String, Instant)` on `AiMessageRepository`.
- Produces: `List<ExerciseFeedbackEntity> findByCreatedByOrderByCreatedAtDesc(UUID, Limit)` on `ExerciseFeedbackRepository`.
- Produces: `CreatedAtBackdater.backdate(String table, UUID rowId, Instant createdAt)` and `backdateAll(String table, UUID owner, Instant createdAt)`.
- Produces: `TrainPopulator.createFeedbackAt(UUID createdBy, UUID workoutSessionId, UUID exerciseId, int pump, int jointPain, int workload, Instant createdAt)`.

- [ ] **Step 1: Write the failing seam IT.** Create `backend/src/test/java/io/mrkuhne/mezo/support/populator/UsageSeamIT.java`:

```java
package io.mrkuhne.mezo.support.populator;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;

/**
 * S5 round 2 (bd mezo-d58h.7.5): the three seams the question detectors are untestable without —
 * a countable/existence read per usage table, a way to make a row OLD (@CreationTimestamp writes
 * now() and nothing else can), and feedback rows in a KNOWN order.
 */
class UsageSeamIT extends AbstractIntegrationTest {

    @Autowired private JournalPopulator journalPopulator;
    @Autowired private JournalEntryRepository journalEntryRepository;
    @Autowired private HabitPopulator habitPopulator;
    @Autowired private HabitDayRepository habitDayRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private ExerciseFeedbackRepository exerciseFeedbackRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CreatedAtBackdater createdAtBackdater;

    @Test
    void testBackdate_shouldMoveARowOutOfTheRecentWindow() {
        UUID owner = userPopulator.createUser().getId();
        UUID entryId = journalPopulator.createEntry(owner, LocalDate.now(), "régi", "manual").getId();
        Instant since = Instant.now().minus(30, ChronoUnit.DAYS);

        assertThat(journalEntryRepository.existsByCreatedByAndCreatedAtAfter(owner, since)).isTrue();
        createdAtBackdater.backdate("journal_entry", entryId, Instant.now().minus(60, ChronoUnit.DAYS));

        assertThat(journalEntryRepository.countByCreatedBy(owner)).isEqualTo(1L);
        assertThat(journalEntryRepository.existsByCreatedByAndCreatedAtAfter(owner, since)).isFalse();
    }

    /** The habit trap in one assertion: a `pending` row is the APP's write (HabitService
     *  materializes one per active def on any read), so only `done` may ever count as usage. */
    @Test
    void testHabitCount_shouldCountDoneRowsOnly() {
        UUID owner = userPopulator.createUser().getId();
        habitPopulator.row(owner, LocalDate.now(), "water", HabitDayEntity.STATUS_PENDING);
        habitPopulator.row(owner, LocalDate.now().minusDays(1), "water", HabitDayEntity.STATUS_DONE);

        assertThat(habitDayRepository.countByCreatedByAndStatus(owner, HabitDayEntity.STATUS_DONE))
            .isEqualTo(1L);
        assertThat(habitDayRepository.countByCreatedByAndStatus(owner, HabitDayEntity.STATUS_PENDING))
            .isEqualTo(1L);
    }

    @Test
    void testFeedbackRead_shouldComeBackNewestFirstAndCapped() {
        UUID owner = userPopulator.createUser().getId();
        UUID sessionOld = UUID.randomUUID();
        UUID sessionNew = UUID.randomUUID();
        trainPopulator.createFeedbackAt(owner, sessionOld, UUID.randomUUID(), 3, 1, 2,
            Instant.now().minus(10, ChronoUnit.DAYS));
        trainPopulator.createFeedbackAt(owner, sessionNew, UUID.randomUUID(), 3, 1, 2,
            Instant.now().minus(1, ChronoUnit.DAYS));

        List<ExerciseFeedbackEntity> rows =
            exerciseFeedbackRepository.findByCreatedByOrderByCreatedAtDesc(owner, Limit.of(1));

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getWorkoutSessionId()).isEqualTo(sessionNew);
    }
}
```

- [ ] **Step 2: Run it and watch it fail.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='UsageSeamIT' -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — none of the three seams exist.

- [ ] **Step 3: Add the repository reads.** To `JournalEntryRepository`, `GratitudeEntryRepository`, `RitualDayRepository` and `NeedsDayRepository` add (each entity carries `@SQLRestriction("is_deleted = false")`, so a derived query is already soft-delete-correct — that is why these have no `AndDeletedFalse` suffix):

```java
    /** Feature-abandonment usage reads (S5 round 2, bd mezo-d58h.7.5, spec §(17)): how much of
     *  this surface the user has EVER written, and whether anything landed inside the idle
     *  window. {@code @SQLRestriction} on the entity already excludes soft-deleted rows. */
    long countByCreatedBy(UUID createdBy);

    boolean existsByCreatedByAndCreatedAtAfter(UUID createdBy, Instant createdAt);
```

To `DecisionEntryRepository` add the same pair (it already imports `Instant`).

To `HabitDayRepository` add the status-scoped pair, with the trap in its javadoc:

```java
    /** Feature-abandonment usage reads (S5 round 2, bd mezo-d58h.7.5, spec §(17)) — STATUS-SCOPED
     *  on purpose. {@code habit_day} rows are written by the APP ({@link
     *  io.mrkuhne.mezo.feature.habit.service.HabitService} materializes a {@code pending} row per
     *  active def on any read; the stale-close pass writes {@code missed}), so only
     *  {@code done} rows are evidence that the USER touched the surface. */
    long countByCreatedByAndStatus(UUID createdBy, String status);

    boolean existsByCreatedByAndStatusAndCreatedAtAfter(UUID createdBy, String status, Instant createdAt);
```

To `AiMessageRepository` add the role-scoped pair:

```java
    /** Feature-abandonment usage reads (S5 round 2, bd mezo-d58h.7.5, spec §(17)) — ROLE-SCOPED:
     *  the assistant's own replies are not the user using the chat. */
    long countByCreatedByAndRole(UUID createdBy, String role);

    boolean existsByCreatedByAndRoleAndCreatedAtAfter(UUID createdBy, String role, Instant createdAt);
```

To `ExerciseFeedbackRepository` add (plus `import org.springframework.data.domain.Limit;` and `import java.time.Instant;` is not needed here):

```java
    /** Flat-feedback detection (S5 round 2, bd mezo-d58h.7.5, spec §(18)): the newest debrief rows
     *  first, capped by the caller. Rows carry no workout date of their own — {@code created_at}
     *  IS when the debrief was tapped, which is exactly the ordering the question is about. */
    List<ExerciseFeedbackEntity> findByCreatedByOrderByCreatedAtDesc(UUID createdBy, Limit limit);
```

- [ ] **Step 4: Add the backdating seam.** Create `backend/src/test/java/io/mrkuhne/mezo/support/populator/CreatedAtBackdater.java`:

```java
package io.mrkuhne.mezo.support.populator;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.transaction.annotation.Transactional;

/**
 * Makes a row OLD (S5 round 2, bd mezo-d58h.7.5). {@code OwnedEntity.createdAt} is
 * {@code @CreationTimestamp} + {@code updatable = false}, so JPA cannot write it and every
 * populator-made row is born "now" — which would make every feature-abandonment test vacuous
 * (nothing can sit outside a 30-day idle window). A native update is the only way in; the
 * {@code @PersistenceContext} field is the house test-support exception to constructor DI
 * (the {@code CompanionMessagePopulator.rawInsertKind} idiom).
 *
 * <p>The table name is checked against an allow-list rather than interpolated blind: these are
 * the usage tables the question detectors read, and a typo should fail loudly here instead of
 * silently updating nothing.
 */
@TestComponent
public class CreatedAtBackdater {

    private static final Set<String> TABLES = Set.of(
        "journal_entry", "gratitude_entry", "decision_entry",
        "habit_day", "ritual_day", "needs_day", "ai_message", "exercise_feedback");

    @PersistenceContext
    private EntityManager em;

    /** One row by id. */
    @Transactional
    public void backdate(String table, UUID rowId, Instant createdAt) {
        em.createNativeQuery("update " + checked(table) + " set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", rowId).executeUpdate();
        em.flush();
        em.clear();
    }

    /** Every row this owner has in the table — the usual shape of an abandonment fixture. */
    @Transactional
    public void backdateAll(String table, UUID owner, Instant createdAt) {
        em.createNativeQuery(
                "update " + checked(table) + " set created_at = :at where created_by = :owner")
            .setParameter("at", createdAt).setParameter("owner", owner).executeUpdate();
        em.flush();
        em.clear();
    }

    private static String checked(String table) {
        if (!TABLES.contains(table)) {
            throw new IllegalArgumentException("Not a usage table: " + table);
        }
        return table;
    }
}
```

- [ ] **Step 5: Add the ordered-feedback populator.** In `TrainPopulator`, next to the existing `createFeedback` overloads (add `import java.time.Instant;` if absent):

```java
    /** A debrief row with an explicit {@code created_at} (S5 round 2, bd mezo-d58h.7.5): the
     *  flat-feedback detector groups the NEWEST rows into workouts, so a fixture needs the order
     *  to be a fact rather than an insertion-time accident. Written, then backdated natively —
     *  {@code created_at} is {@code updatable = false}. */
    @Transactional
    public ExerciseFeedbackEntity createFeedbackAt(UUID createdBy, UUID workoutSessionId,
        UUID exerciseId, int pump, int jointPain, int workload, Instant createdAt) {
        ExerciseFeedbackEntity f = createFeedback(createdBy, workoutSessionId, exerciseId, pump,
            jointPain, workload);
        em.createNativeQuery("update exercise_feedback set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", f.getId()).executeUpdate();
        em.flush();
        em.clear();
        return exerciseFeedbackRepository.findById(f.getId()).orElseThrow();
    }
```

If `TrainPopulator` has no `EntityManager` yet, add the field with the same house exception comment:

```java
    /** Native backdating of {@code created_at} ({@code updatable = false}) — field-injected
     *  {@code @PersistenceContext} is the house test-support exception to constructor DI. */
    @PersistenceContext
    private EntityManager em;
```

- [ ] **Step 6: Run the seam IT.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='UsageSeamIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS (3 tests).

- [ ] **Step 7: Commit.**

```bash
git add -A && git commit -m "test(proactive): usage read + created_at seams for the S5 questions (mezo-d58h.7.5)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: config + the feature-abandonment detector (item 17)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/QuestionProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FeatureAbandonmentDetector.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/FeatureAbandonmentDetectorIT.java` (create)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/QuestionPropertiesIT.java` (create)

**Interfaces:**
- Consumes: the Task 2 repository reads.
- Produces: `QuestionProperties` (`featureAbandonment().idleDays()`, `featureAbandonment().minPriorRows()`, `flatFeedback().windowWorkouts()`, `flatFeedback().maxFeedbackRows()`).
- Produces: `FeatureAbandonmentDetector.detect(UUID userId)` → `Optional<Abandonment>` where `Abandonment(String family, long priorRows, int idleDays)` and `family ∈ {FAMILY_MIND, FAMILY_CHAT}`.

- [ ] **Step 1: Write the failing detector IT.** Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/FeatureAbandonmentDetectorIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.proactive.service.FeatureAbandonmentDetector;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.CreatedAtBackdater;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec §(17)): a feature family that was GENUINELY used before
 * (≥ minPriorRows rows) but has nothing new inside the idle window. An empty table means "never
 * used", which is not abandonment — that case must stay silent, and does so here by its own test.
 */
class FeatureAbandonmentDetectorIT extends AbstractIntegrationTest {

    private static final Instant LONG_AGO = Instant.now().minus(120, ChronoUnit.DAYS);

    @Autowired private FeatureAbandonmentDetector detector;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private HabitPopulator habitPopulator;
    @Autowired private AiConversationPopulator aiConversationPopulator;
    @Autowired private AiMessagePopulator aiMessagePopulator;
    @Autowired private CreatedAtBackdater createdAtBackdater;
    @Autowired private UserPopulator userPopulator;

    /** 10 old journal entries and nothing since ⇒ the mind family is abandoned. */
    @Test
    void testDetect_shouldFire_whenTheMindFamilyWasUsedAndThenWentQuiet() {
        UUID owner = userPopulator.createUser().getId();
        seedJournal(owner, 10);

        var verdict = detector.detect(owner);

        assertThat(verdict).isPresent();
        assertThat(verdict.orElseThrow().family()).isEqualTo(FeatureAbandonmentDetector.FAMILY_MIND);
        assertThat(verdict.orElseThrow().priorRows()).isEqualTo(10L);
        assertThat(verdict.orElseThrow().idleDays()).isEqualTo(30);
    }

    /** The honesty gate: never used is not abandoned. */
    @Test
    void testDetect_shouldStaySilent_whenTheFamilyWasNeverReallyUsed() {
        UUID owner = userPopulator.createUser().getId();
        seedJournal(owner, 3); // < minPriorRows

        assertThat(detector.detect(owner)).isEmpty();
    }

    /** One fresh row anywhere in the family keeps the whole family alive. */
    @Test
    void testDetect_shouldStaySilent_whenSomethingInTheFamilyIsStillFresh() {
        UUID owner = userPopulator.createUser().getId();
        seedJournal(owner, 10);
        habitPopulator.row(owner, LocalDate.now(), "water", HabitDayEntity.STATUS_DONE);

        assertThat(detector.detect(owner)).isEmpty();
    }

    /** The habit trap: `pending` rows are the APP's writes, so they are neither prior USE nor
     *  freshness. Ten pending rows created today must not revive an abandoned family — and must
     *  not, on their own, make an unused family look used either. */
    @Test
    void testDetect_shouldIgnorePendingHabitRows() {
        UUID owner = userPopulator.createUser().getId();
        seedJournal(owner, 10);
        for (int i = 0; i < 10; i++) {
            habitPopulator.row(owner, LocalDate.now().minusDays(i), "water",
                HabitDayEntity.STATUS_PENDING);
        }

        assertThat(detector.detect(owner))
            .hasValueSatisfying(v -> assertThat(v.family())
                .isEqualTo(FeatureAbandonmentDetector.FAMILY_MIND));
    }

    /** Mind is checked first; with mind alive, an abandoned chat is still found. */
    @Test
    void testDetect_shouldFindTheChatFamily_whenOnlyItWentQuiet() {
        UUID owner = userPopulator.createUser().getId();
        journalPopulator.createEntry(owner, LocalDate.now(), "ma is írtam", "manual");
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        for (int i = 0; i < 10; i++) {
            aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "kérdés " + i);
        }
        createdAtBackdater.backdateAll("ai_message", owner, LONG_AGO);

        var verdict = detector.detect(owner);

        assertThat(verdict).isPresent();
        assertThat(verdict.orElseThrow().family()).isEqualTo(FeatureAbandonmentDetector.FAMILY_CHAT);
    }

    /** The assistant's own replies are not the user using the chat. */
    @Test
    void testDetect_shouldIgnoreAssistantMessages_forTheChatFamily() {
        UUID owner = userPopulator.createUser().getId();
        journalPopulator.createEntry(owner, LocalDate.now(), "ma is írtam", "manual");
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        for (int i = 0; i < 10; i++) {
            aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "válasz " + i);
        }
        createdAtBackdater.backdateAll("ai_message", owner, LONG_AGO);

        assertThat(detector.detect(owner)).isEmpty();
    }

    private void seedJournal(UUID owner, int rows) {
        for (int i = 0; i < rows; i++) {
            journalPopulator.createEntry(owner, LocalDate.now().minusDays(40L + i), "régi " + i, "manual");
        }
        createdAtBackdater.backdateAll("journal_entry", owner, LONG_AGO);
    }
}
```

> **Note for the implementer:** check `AiConversationPopulator`'s actual factory name before running (`grep -n "public " backend/src/test/java/io/mrkuhne/mezo/support/populator/AiConversationPopulator.java`) and use it — the conversation is only scaffolding for the messages.

- [ ] **Step 2: Run it and watch it fail.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='FeatureAbandonmentDetectorIT' -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `FeatureAbandonmentDetector` does not exist.

- [ ] **Step 3: Write the config record.** Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/QuestionProperties.java`:

```java
package io.mrkuhne.mezo.feature.proactive.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Once-ever question tuning (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §c) — every threshold
 * is config, never code. Own record rather than another field on {@code SetupCheckProperties}:
 * questions are a different genre (asked once, ever; no re-emit window at all), and the
 * {@code FlagProperties}/{@code SetupCheckProperties} precedent is one record per genre.
 *
 * <p>There is deliberately NO cron and NO re-emit window here. The pass rides
 * {@code SetupCheckJob}'s existing schedule (the spec forbids a new cron near the dawn cluster),
 * and "once ever" is enforced by the envelope-key dedupe in {@code OneTimeQuestionService}, not by
 * a window that could be re-opened by a config edit.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive.questions")
public record QuestionProperties(

    @NotNull @Valid FeatureAbandonment featureAbandonment,

    @NotNull @Valid FlatFeedback flatFeedback
) {

    public record FeatureAbandonment(
        /** Nothing new in the family for this many days ⇒ the family reads as shelved. */
        @Min(7) @Max(365) int idleDays,
        /** Honesty gate: fewer rows than this EVER means "never really used" — silence, because
         *  an empty table is not abandonment (spec §(17)). */
        @Min(1) @Max(1000) int minPriorRows
    ) {
    }

    public record FlatFeedback(
        /** How many of the most recent feedback-carrying workouts must be identical. */
        @Min(3) @Max(50) int windowWorkouts,
        /** Read cap for the newest-first debrief scan. Single-user volumes (spec §12): the whole
         *  window is grouped in memory, and the OLDEST workout inside the cap is dropped because
         *  the cap may have cut it in half. */
        @Min(50) @Max(2000) int maxFeedbackRows
    ) {
    }
}
```

- [ ] **Step 4: Add the defaults.** In `backend/src/main/resources/application.yml`, immediately after the `setup-checks:` block (which ends with `min-bedtime-samples: 4`), at the same indentation:

```yaml
    questions:
      # Round 2 S5 (mezo-d58h.7.5, spec 2026-09-05 §c): once-ever questions. No cron of their own
      # — SetupCheckJob runs them right after the setup checks, inside the same per-user loop — and
      # no re-emit window: each question fires exactly once per user, ever.
      feature-abandonment:
        # Spec §(17): "zero new rows in the last 30 days".
        idle-days: 30
        # Spec §(17): "genuinely used before (≥10 domain rows total)". Below this the family was
        # never really used, and never-used is not abandoned.
        min-prior-rows: 10
      flat-feedback:
        # Spec §(18): "across the last 8 logged workouts".
        window-workouts: 8
        # ~25 debrief rows per workout would still cover 16 workouts; the oldest workout inside
        # the cap is discarded as possibly truncated.
        max-feedback-rows: 400
```

- [ ] **Step 5: Write the detector.** Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FeatureAbandonmentDetector.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.needs.repository.NeedsDayRepository;
import io.mrkuhne.mezo.feature.proactive.config.QuestionProperties;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec 2026-09-05 §(17)): which feature FAMILY the user genuinely
 * used and then stopped touching. There is no usage-events table, so the signal is derived from
 * the domain tables' own {@code created_at} — the row IS the interaction.
 *
 * <p><b>Two families, fixed order.</b> {@code mind} (journal + gratitude + decisions + habits +
 * ritual + needs) is checked before {@code chat}. They are separate questions to ask, so a live
 * journal must not hide a chat that went silent months ago, and vice versa — but only ONE question
 * is ever asked, so the order has to be decided somewhere and it is decided here.
 *
 * <p><b>Trap: not every row is a user action.</b> {@code habit_day} rows are materialized by
 * {@code HabitService} on any read ({@code pending}) and closed by a cron ({@code missed}) — only
 * {@code done} counts. {@code ai_message} holds the assistant's replies too — only
 * {@code role = 'user'} counts. Counting either naively would make an untouched surface look
 * heavily used, and would let the app's own writes revive an abandoned family.
 *
 * <p><b>Honesty gate:</b> fewer than {@code minPriorRows} rows EVER means the family was never
 * really used, which is not abandonment — {@link Optional#empty()}, never a question.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class FeatureAbandonmentDetector {

    /** Journal + gratitude + decisions + habits + ritual + needs — the "mind" surfaces. */
    public static final String FAMILY_MIND = "mind";
    /** The AI chat, as its own family (spec §(17): "separately: AI chat"). */
    public static final String FAMILY_CHAT = "chat";

    /** @param family    {@link #FAMILY_MIND} or {@link #FAMILY_CHAT}
     *  @param priorRows how much the user wrote there BEFORE going quiet (the card's evidence)
     *  @param idleDays  the window that came back empty (the card's evidence) */
    public record Abandonment(String family, long priorRows, int idleDays) {
    }

    private final JournalEntryRepository journalEntryRepository;
    private final GratitudeEntryRepository gratitudeEntryRepository;
    private final DecisionEntryRepository decisionEntryRepository;
    private final HabitDayRepository habitDayRepository;
    private final RitualDayRepository ritualDayRepository;
    private final NeedsDayRepository needsDayRepository;
    private final AiMessageRepository aiMessageRepository;
    private final QuestionProperties properties;

    /** The first abandoned family, or empty when both are alive (or neither was ever used). */
    @Transactional(readOnly = true)
    public Optional<Abandonment> detect(UUID userId) {
        QuestionProperties.FeatureAbandonment cfg = properties.featureAbandonment();
        Instant since = Instant.now().minus(cfg.idleDays(), ChronoUnit.DAYS);
        Optional<Abandonment> mind = verdict(FAMILY_MIND, mindRows(userId),
            mindFresh(userId, since), cfg);
        return mind.isPresent() ? mind
            : verdict(FAMILY_CHAT, chatRows(userId), chatFresh(userId, since), cfg);
    }

    private static Optional<Abandonment> verdict(String family, long priorRows, boolean fresh,
                                                 QuestionProperties.FeatureAbandonment cfg) {
        if (fresh || priorRows < cfg.minPriorRows()) {
            return Optional.empty();
        }
        return Optional.of(new Abandonment(family, priorRows, cfg.idleDays()));
    }

    private long mindRows(UUID userId) {
        return journalEntryRepository.countByCreatedBy(userId)
            + gratitudeEntryRepository.countByCreatedBy(userId)
            + decisionEntryRepository.countByCreatedBy(userId)
            + habitDayRepository.countByCreatedByAndStatus(userId, HabitDayEntity.STATUS_DONE)
            + ritualDayRepository.countByCreatedBy(userId)
            + needsDayRepository.countByCreatedBy(userId);
    }

    private boolean mindFresh(UUID userId, Instant since) {
        return journalEntryRepository.existsByCreatedByAndCreatedAtAfter(userId, since)
            || gratitudeEntryRepository.existsByCreatedByAndCreatedAtAfter(userId, since)
            || decisionEntryRepository.existsByCreatedByAndCreatedAtAfter(userId, since)
            || habitDayRepository.existsByCreatedByAndStatusAndCreatedAtAfter(
                userId, HabitDayEntity.STATUS_DONE, since)
            || ritualDayRepository.existsByCreatedByAndCreatedAtAfter(userId, since)
            || needsDayRepository.existsByCreatedByAndCreatedAtAfter(userId, since);
    }

    private long chatRows(UUID userId) {
        return aiMessageRepository.countByCreatedByAndRole(userId, AiMessageEntity.ROLE_USER);
    }

    private boolean chatFresh(UUID userId, Instant since) {
        return aiMessageRepository.existsByCreatedByAndRoleAndCreatedAtAfter(
            userId, AiMessageEntity.ROLE_USER, since);
    }
}
```

- [ ] **Step 6: Write the config IT.** Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/QuestionPropertiesIT.java` (the `HydrationPropertiesIT` / `FlagPropertiesIT` idiom):

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.config.QuestionProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Round 2 S5 (bd mezo-d58h.7.5): the shipped defaults bind and match the spec's numbers. */
class QuestionPropertiesIT extends AbstractIntegrationTest {

    @Autowired private QuestionProperties properties;

    @Test
    void testDefaults_shouldMatchTheSpec() {
        assertThat(properties.featureAbandonment().idleDays()).isEqualTo(30);
        assertThat(properties.featureAbandonment().minPriorRows()).isEqualTo(10);
        assertThat(properties.flatFeedback().windowWorkouts()).isEqualTo(8);
        assertThat(properties.flatFeedback().maxFeedbackRows()).isGreaterThanOrEqualTo(50);
    }
}
```

- [ ] **Step 7: Run both ITs.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='FeatureAbandonmentDetectorIT,QuestionPropertiesIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS (7 tests). A failure in `testDetect_shouldFindTheChatFamily…` that says the MIND family fired instead means the fixture's fresh journal row was backdated too — check that `seedJournal` is not called in that test.

- [ ] **Step 8: Commit.**

```bash
git add -A && git commit -m "feat(proactive): feature-abandonment detector for the S5 question (mezo-d58h.7.5)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: the flat-feedback detector (item 18)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FlatFeedbackDetector.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/FlatFeedbackDetectorIT.java` (create)

**Interfaces:**
- Consumes: `ExerciseFeedbackRepository.findByCreatedByOrderByCreatedAtDesc(UUID, Limit)` (Task 2), `QuestionProperties.flatFeedback()` (Task 3).
- Produces: `FlatFeedbackDetector.detect(UUID userId)` → `Optional<FlatFeedback>` where `FlatFeedback(int workload, int jointPain, int workouts)`.

- [ ] **Step 1: Write the failing IT.** Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/FlatFeedbackDetectorIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.FlatFeedbackDetector;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec §(18)): the last 8 feedback-carrying workouts all carrying
 * the SAME (workload, jointPain) pair — likely reflex-clicked. Fewer than 8 is not flat, it is
 * not enough data, and stays silent.
 */
class FlatFeedbackDetectorIT extends AbstractIntegrationTest {

    @Autowired private FlatFeedbackDetector detector;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testDetect_shouldFire_whenTheLastEightWorkoutsCarryTheSamePair() {
        UUID owner = userPopulator.createUser().getId();
        seedWorkouts(owner, 8, 2, 1);

        var verdict = detector.detect(owner);

        assertThat(verdict).isPresent();
        assertThat(verdict.orElseThrow().workload()).isEqualTo(2);
        assertThat(verdict.orElseThrow().jointPain()).isEqualTo(1);
        assertThat(verdict.orElseThrow().workouts()).isEqualTo(8);
    }

    /** Honesty gate: seven workouts is not a pattern, it is a short history. */
    @Test
    void testDetect_shouldStaySilent_whenThereAreTooFewWorkouts() {
        UUID owner = userPopulator.createUser().getId();
        seedWorkouts(owner, 7, 2, 1);

        assertThat(detector.detect(owner)).isEmpty();
    }

    /** One differing workload anywhere in the window is variance — the user IS answering. */
    @Test
    void testDetect_shouldStaySilent_whenTheWorkloadVaries() {
        UUID owner = userPopulator.createUser().getId();
        seedWorkouts(owner, 8, 2, 1);
        trainPopulator.createFeedbackAt(owner, UUID.randomUUID(), UUID.randomUUID(), 3, 1, 3,
            Instant.now().minus(1, ChronoUnit.HOURS)); // newest workout, different workload

        assertThat(detector.detect(owner)).isEmpty();
    }

    /** Same for the joint-pain half: the pair must be flat, not just one of its halves. */
    @Test
    void testDetect_shouldStaySilent_whenTheJointPainVaries() {
        UUID owner = userPopulator.createUser().getId();
        seedWorkouts(owner, 8, 2, 1);
        trainPopulator.createFeedbackAt(owner, UUID.randomUUID(), UUID.randomUUID(), 3, 3, 2,
            Instant.now().minus(1, ChronoUnit.HOURS)); // newest workout, different jointPain

        assertThat(detector.detect(owner)).isEmpty();
    }

    /** A workout with SEVERAL exercises is still one workout — and every one of its rows counts
     *  towards flatness, so a single differing exercise inside an otherwise flat workout speaks. */
    @Test
    void testDetect_shouldStaySilent_whenOneExerciseInsideAWorkoutDiffers() {
        UUID owner = userPopulator.createUser().getId();
        seedWorkouts(owner, 8, 2, 1);
        UUID newest = UUID.randomUUID();
        trainPopulator.createFeedbackAt(owner, newest, UUID.randomUUID(), 3, 1, 2,
            Instant.now().minus(2, ChronoUnit.HOURS));
        trainPopulator.createFeedbackAt(owner, newest, UUID.randomUUID(), 3, 1, 3,
            Instant.now().minus(1, ChronoUnit.HOURS));

        assertThat(detector.detect(owner)).isEmpty();
    }

    /** One debrief row per workout, newest last-seeded so the ordering is explicit. */
    private void seedWorkouts(UUID owner, int workouts, int workload, int jointPain) {
        for (int i = 0; i < workouts; i++) {
            trainPopulator.createFeedbackAt(owner, UUID.randomUUID(), UUID.randomUUID(),
                3, jointPain, workload, Instant.now().minus(workouts - i, ChronoUnit.DAYS));
        }
    }
}
```

- [ ] **Step 2: Run it and watch it fail.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='FlatFeedbackDetectorIT' -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `FlatFeedbackDetector` does not exist.

- [ ] **Step 3: Write the detector.** Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FlatFeedbackDetector.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.config.QuestionProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec 2026-09-05 §(18)): zero variance in {@code workload} AND
 * {@code jointPain} across the last {@code windowWorkouts} feedback-carrying workouts — the shape
 * of a debrief that is being reflex-clicked rather than answered.
 *
 * <p><b>"Workout" means a workout, not a row.</b> {@code exercise_feedback} is one row per
 * (instance, exercise), so the rows are grouped by {@code workout_session_id} first and the window
 * is counted in GROUPS. Every row inside those groups then has to carry the same pair: a single
 * differing exercise inside an otherwise flat workout is variance, and variance is an answer.
 *
 * <p><b>The cap can cut a workout in half.</b> The scan reads the newest {@code maxFeedbackRows}
 * rows, so the OLDEST group in that read may be missing its earlier rows — and a missing row could
 * be the one that differs. That group is therefore discarded whenever the cap was actually hit,
 * before the window is taken. Silence from an under-filled window is the honest answer.
 *
 * <p><b>Honesty gate:</b> fewer than {@code windowWorkouts} usable groups ⇒ {@link Optional#empty()}.
 * Too little data is never a finding.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class FlatFeedbackDetector {

    /** @param workload the single workload value every row carried (the card's evidence)
     *  @param jointPain the single joint-pain value every row carried
     *  @param workouts how many workouts that held for */
    public record FlatFeedback(int workload, int jointPain, int workouts) {
    }

    private final ExerciseFeedbackRepository exerciseFeedbackRepository;
    private final QuestionProperties properties;

    @Transactional(readOnly = true)
    public Optional<FlatFeedback> detect(UUID userId) {
        QuestionProperties.FlatFeedback cfg = properties.flatFeedback();
        List<ExerciseFeedbackEntity> rows = exerciseFeedbackRepository
            .findByCreatedByOrderByCreatedAtDesc(userId, Limit.of(cfg.maxFeedbackRows()));

        Map<UUID, List<ExerciseFeedbackEntity>> byWorkout = new LinkedHashMap<>();
        for (ExerciseFeedbackEntity row : rows) {
            byWorkout.computeIfAbsent(row.getWorkoutSessionId(), key -> new ArrayList<>()).add(row);
        }
        List<UUID> workouts = new ArrayList<>(byWorkout.keySet());
        if (rows.size() >= cfg.maxFeedbackRows() && !workouts.isEmpty()) {
            // The oldest group inside the cap may be truncated — drop it rather than judge it.
            workouts.remove(workouts.size() - 1);
        }
        if (workouts.size() < cfg.windowWorkouts()) {
            return Optional.empty();
        }
        List<ExerciseFeedbackEntity> window = workouts.subList(0, cfg.windowWorkouts()).stream()
            .flatMap(id -> byWorkout.get(id).stream()).toList();
        int workload = window.get(0).getWorkload();
        int jointPain = window.get(0).getJointPain();
        boolean flat = window.stream().allMatch(
            row -> row.getWorkload() == workload && row.getJointPain() == jointPain);
        return flat
            ? Optional.of(new FlatFeedback(workload, jointPain, cfg.windowWorkouts()))
            : Optional.empty();
    }
}
```

- [ ] **Step 4: Run the IT.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='FlatFeedbackDetectorIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit.**

```bash
git add -A && git commit -m "feat(proactive): flat exercise-feedback detector for the S5 question (mezo-d58h.7.5)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: the once-ever question service

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/CompanionMessageRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/OneTimeQuestionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdvicePriority.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/SetupCheckJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/OneTimeQuestionServiceIT.java` (create)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/OneTimeQuestionSwitchOffIT.java` (create)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/AdvicePriorityTest.java` (modify)

**Interfaces:**
- Consumes: `FeatureAbandonmentDetector.detect`, `FlatFeedbackDetector.detect`, `AdviceCandidate.fromQuestion`, `AdviceCardService.deliver`.
- Produces: `OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT` = `"question_feature_abandonment"`, `QUESTION_FLAT_FEEDBACK` = `"question_flat_feedback"`, `EYEBROW` = `"Mezo · kérdés"`, `runFor(UUID) → Optional<CompanionMessageEntity>`, and `answerTexts(String questionKey, String verdict) → Optional<String>` (used by Task 6).
- Produces: `CompanionMessageRepository.questionAlreadyAsked(UUID, String) → boolean`.

- [ ] **Step 1: Write the failing service IT.** Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/OneTimeQuestionServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.OneTimeQuestionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.CreatedAtBackdater;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec §c): a question is asked ONCE, ever; never on a day that
 * already has a card; and its body reaches the user exactly as written.
 *
 * <p>{@code @ActiveProfiles("companion-fake")} follows {@code SetupCheckServiceIT} — delivery goes
 * through {@code AdviceCardService}, which resolves the prose generator even when (as here) the
 * verbatim path never calls it.
 */
@ActiveProfiles("companion-fake")
class OneTimeQuestionServiceIT extends AbstractIntegrationTest {

    @Autowired private OneTimeQuestionService oneTimeQuestionService;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private JournalEntryRepository journalEntryRepository;
    @Autowired private CreatedAtBackdater createdAtBackdater;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRunFor_shouldAskTheAbandonmentQuestion_whenTheMindFamilyWentQuiet() {
        UUID owner = abandonedMindUser();

        Optional<CompanionMessageEntity> card = oneTimeQuestionService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getKind()).isEqualTo(CompanionMessageEntity.KIND_ADVICE);
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT);
        assertThat(card.orElseThrow().getContent().eyebrow()).isEqualTo(OneTimeQuestionService.EYEBROW);
        // Verbatim: the body is the question itself, and it ends in the two one-tap answers.
        assertThat(card.orElseThrow().getContent().body()).hasSize(1);
        assertThat(card.orElseThrow().getContent().suggestions()).hasSize(2);
        assertThat(card.orElseThrow().getContent().facts()).isNotEmpty();
    }

    /** Once ever: a second sweep on a LATER day, with the trigger still true, says nothing. */
    @Test
    void testRunFor_shouldNeverAskTheSameQuestionTwice() {
        UUID owner = abandonedMindUser();
        assertThat(oneTimeQuestionService.runFor(owner)).isPresent();
        // Move the card off today so the day-budget gate is not what silences the second run.
        companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                owner, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE)
            .ifPresent(row -> {
                row.setMessageDate(LocalDate.now().minusDays(3));
                companionMessageRepository.saveAndFlush(row);
            });

        assertThat(oneTimeQuestionService.runFor(owner)).isEmpty();
    }

    /** The trap this slice exists to avoid: a question card that a flag SUPERSEDED is soft-deleted
     *  and invisible to every JPA read — but it was still asked, so it must never come back. */
    @Test
    void testRunFor_shouldNeverAskAgain_whenTheQuestionCardWasSuperseded() {
        UUID owner = abandonedMindUser();
        CompanionMessageEntity asked = oneTimeQuestionService.runFor(owner).orElseThrow();
        companionMessageRepository.delete(asked); // @SQLDelete → soft delete, the supersession path
        companionMessageRepository.flush();

        assertThat(oneTimeQuestionService.runFor(owner)).isEmpty();
    }

    /** Shared daily budget: a question never stacks with the day's advice card. */
    @Test
    void testRunFor_shouldStaySilent_whenTodayAlreadyHasAnAdviceCard() {
        UUID owner = abandonedMindUser();
        companionMessagePopulator.createAdvice(owner, LocalDate.now(), FlagKey.SLEEP_DEBT,
            "sleep_recover_tonight", "Mezo · észrevétel", "…", List.of(), List.of("…"), Instant.now());

        assertThat(oneTimeQuestionService.runFor(owner)).isEmpty();
        // …and the incumbent is untouched.
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                owner, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE).orElseThrow()
            .getContent().adviceKey()).isEqualTo(FlagKey.SLEEP_DEBT);
    }

    /** Nothing to ask about ⇒ nothing is asked (and nothing is burned). */
    @Test
    void testRunFor_shouldStaySilent_whenNoQuestionTriggers() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(oneTimeQuestionService.runFor(owner)).isEmpty();
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
            owner, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE)).isEmpty();
    }

    /** 10 journal entries, all older than the idle window, nothing since. */
    private UUID abandonedMindUser() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 0; i < 10; i++) {
            journalPopulator.createEntry(owner, LocalDate.now().minusDays(40L + i), "régi " + i, "manual");
        }
        createdAtBackdater.backdateAll("journal_entry", owner, Instant.now().minus(120, ChronoUnit.DAYS));
        assertThat(journalEntryRepository.countByCreatedBy(owner)).isEqualTo(10L);
        return owner;
    }
}
```

- [ ] **Step 2: Run it and watch it fail.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='OneTimeQuestionServiceIT' -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `OneTimeQuestionService` does not exist.

- [ ] **Step 3: Add the once-ever dedupe read.** In `CompanionMessageRepository` (add `import org.springframework.data.jpa.repository.Query;` and `import org.springframework.data.repository.query.Param;` if absent):

```java
    /** The ONCE-EVER dedupe (round 2 S5, bd mezo-d58h.7.5, spec §c): has this question EVER been
     *  asked to this user?
     *
     *  <p>Native, and deliberately WITHOUT {@code is_deleted = false}. Every JPA read of this
     *  table goes through {@code @SQLRestriction("is_deleted = false")}, and a question card that
     *  a later flag SUPERSEDED is soft-deleted by exactly that path ({@code AdviceCardService}) —
     *  so a JPA-based dedupe would forget the question and re-ask it the next day, and the day
     *  after. Seeing the deleted rows is the whole point. The accepted cost is the mirror case: a
     *  question displaced before the user ever saw it is burned for good, which costs nothing
     *  (no mutation follows from an answer) and is far cheaper than pestering. */
    @Query(value = """
        select exists(
            select 1 from companion_message
            where created_by = :createdBy and content ->> 'setupKey' = :questionKey)
        """, nativeQuery = true)
    boolean questionAlreadyAsked(@Param("createdBy") UUID createdBy,
                                 @Param("questionKey") String questionKey);
```

- [ ] **Step 4: Write the service.** Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/OneTimeQuestionService.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Once-ever questions (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §c) — the "ask once, remember
 * the answer, change nothing" genre. A variant of {@link SetupCheckService}: same ordered
 * first-wins shape, same setup-tier {@code advice} delivery, same envelope {@code setupKey} slot —
 * but the re-emit window is not "weekly", it is NEVER.
 *
 * <p><b>Budget (spec §c):</b> at most one question per day, and a question never stacks with an
 * advice card — so this service refuses to speak at all on a day that already has one. That gate
 * is belt AND braces with the severity table ({@link AdvicePriority} ranks both question keys
 * next-to-last, above only {@code all_healthy}), and both are deliberate: the gate makes the
 * intent legible in the log, the rank keeps the invariant true for any future caller.
 *
 * <p><b>Once-ever</b> is {@link CompanionMessageRepository#questionAlreadyAsked} — a native read
 * that sees soft-deleted rows, because a superseded question card WAS asked. See that method's
 * javadoc for the trade this closes.
 *
 * <p><b>The card is verbatim</b> ({@link AdviceCandidate#fromQuestion}): the advice prompt would
 * rewrite a question into coaching advice and dissolve the 👍/👎 answer key out of it. That is
 * also why the facts here may carry numbers — {@code ProseNumberGuard} never runs on this card.
 *
 * <p><b>Nothing follows from an answer</b> except one remembered fact ({@link QuestionAnswerService}).
 * No feature is hidden, no data is excluded, no rule's inputs change.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class OneTimeQuestionService {

    /** Spec §(17): a feature family that was genuinely used and then went quiet. */
    public static final String QUESTION_FEATURE_ABANDONMENT = "question_feature_abandonment";
    /** Spec §(18): eight workouts of identical debrief values. */
    public static final String QUESTION_FLAT_FEEDBACK = "question_flat_feedback";
    /** The question tier's own eyebrow — visibly not a „Mezo · észrevétel" advice card. */
    public static final String EYEBROW = "Mezo · kérdés";

    private static final String ANSWER_UP_ABANDONMENT = "👍 — tudatosan tettem félre";
    private static final String ANSWER_DOWN_ABANDONMENT = "👎 — csak kikopott, visszatérnék hozzá";
    private static final String ANSWER_UP_FLAT = "👍 — tényleg ennyire egyforma";
    private static final String ANSWER_DOWN_FLAT = "👎 — inkább reflexből koppintom";

    private static final String MIND_LABEL = "a napló, a szokások, az esti rituálé és az Életjelek";
    private static final String CHAT_LABEL = "a velem való beszélgetés";

    private final CompanionMessageRepository companionMessageRepository;
    private final FeatureAbandonmentDetector featureAbandonmentDetector;
    private final FlatFeedbackDetector flatFeedbackDetector;
    private final AdviceCardService adviceCardService;

    /** The question asked today, or empty — which is the normal case for almost every day of the
     *  app's life (each question exists exactly once per user, ever). */
    @Transactional
    public Optional<CompanionMessageEntity> runFor(UUID userId) {
        if (companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                userId, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE).isPresent()) {
            log.info("Question skipped for user {}: today's card budget is already spent", userId);
            return Optional.empty();
        }
        Optional<CompanionMessageEntity> abandonment = abandonmentQuestion(userId);
        return abandonment.isPresent() ? abandonment : flatFeedbackQuestion(userId);
    }

    /** The two one-tap answers of a question, as the FACT they stand for — the answer-capture
     *  side ({@link QuestionAnswerService}) needs exactly this mapping and must not re-invent it.
     *  Empty for an unknown key or an unknown verdict: an answer we cannot read is not a fact. */
    public Optional<String> answerFact(String questionKey, String verdict) {
        boolean up = MessageFeedbackEntity.VERDICT_UP.equals(verdict);
        boolean down = MessageFeedbackEntity.VERDICT_DOWN.equals(verdict);
        if (!up && !down) {
            return Optional.empty();
        }
        return switch (questionKey) {
            case QUESTION_FEATURE_ABANDONMENT -> Optional.of(up
                ? "A napló/szokás/rituálé/Életjel felületeket TUDATOSAN tette félre — ne ajánlgasd őket."
                : "A napló/szokás/rituálé/Életjel felületek egyszerűen kikoptak nála, és szívesen "
                    + "visszatérne hozzájuk.");
            case QUESTION_FLAT_FEEDBACK -> Optional.of(up
                ? "Az edzés-visszajelzései tényleg stabilan azonosak — vedd őket készpénznek."
                : "Az edzés-visszajelzéseit gyakran reflexből koppintja; adatminőségi fenntartással "
                    + "kezeld őket.");
            default -> Optional.empty();
        };
    }

    /** Every fact text a question can ever produce — the flip-detection input (Task 6). */
    public List<String> allAnswerFacts(String questionKey) {
        return java.util.stream.Stream
            .of(MessageFeedbackEntity.VERDICT_UP, MessageFeedbackEntity.VERDICT_DOWN)
            .map(verdict -> answerFact(questionKey, verdict))
            .flatMap(Optional::stream)
            .toList();
    }

    /** The knowledge-fact category each question's answer belongs to (ck_knowledge_fact_category). */
    public static String categoryOf(String questionKey) {
        return QUESTION_FLAT_FEEDBACK.equals(questionKey) ? "train" : "life";
    }

    private Optional<CompanionMessageEntity> abandonmentQuestion(UUID userId) {
        if (companionMessageRepository.questionAlreadyAsked(userId, QUESTION_FEATURE_ABANDONMENT)) {
            return Optional.empty();
        }
        return featureAbandonmentDetector.detect(userId).flatMap(verdict -> {
            String label = FeatureAbandonmentDetector.FAMILY_CHAT.equals(verdict.family())
                ? CHAT_LABEL : MIND_LABEL;
            List<String> facts = List.of(
                "Az elmúlt %d napban semmi új nem került ide.".formatted(verdict.idleDays()),
                "Korábban összesen %d bejegyzés született itt.".formatted(verdict.priorRows()));
            String text = ("Feltűnt, hogy %s mostanában érintetlen maradt. Nem baj — csak szeretném "
                + "tudni, hogyan gondoljak rá: tudatosan tetted félre, vagy egyszerűen csak "
                + "kikopott? A válaszod megjegyzem, és semmi más nem történik tőle.").formatted(label);
            return ask(userId, QUESTION_FEATURE_ABANDONMENT, facts,
                List.of(ANSWER_UP_ABANDONMENT, ANSWER_DOWN_ABANDONMENT), text);
        });
    }

    private Optional<CompanionMessageEntity> flatFeedbackQuestion(UUID userId) {
        if (companionMessageRepository.questionAlreadyAsked(userId, QUESTION_FLAT_FEEDBACK)) {
            return Optional.empty();
        }
        return flatFeedbackDetector.detect(userId).flatMap(verdict -> {
            List<String> facts = List.of(
                "Az utolsó %d edzés visszajelzése végig ugyanaz volt.".formatted(verdict.workouts()),
                "Terhelés: %d, ízületi panasz: %d — minden alkalommal."
                    .formatted(verdict.workload(), verdict.jointPain()));
            String text = "Az utolsó edzéseidnél a terhelés- és ízületi visszajelzés mindig ugyanaz "
                + "volt. Ez lehet, hogy tényleg ennyire stabil — vagy csak reflexből koppintod. "
                + "Melyik igaz? Megjegyzem a válaszod, és semmi mást nem csinálok vele.";
            return ask(userId, QUESTION_FLAT_FEEDBACK, facts,
                List.of(ANSWER_UP_FLAT, ANSWER_DOWN_FLAT), text);
        });
    }

    private Optional<CompanionMessageEntity> ask(UUID userId, String questionKey,
                                                 List<String> facts, List<String> answers,
                                                 String text) {
        Optional<CompanionMessageEntity> card = adviceCardService.deliver(userId,
            AdviceCandidate.fromQuestion(questionKey, EYEBROW, facts, answers, text));
        if (card.isEmpty()) {
            // Nothing was written, so nothing was asked — the question stays available. (Only
            // reachable if a card landed between the budget gate and the delivery lock.)
            log.info("Question {} was not delivered for user {} — it stays unasked", questionKey, userId);
        } else {
            log.info("Question {} asked for user {} — once, ever", questionKey, userId);
        }
        return card;
    }
}
```

- [ ] **Step 5: Rank the two keys.** In `AdvicePriority.ORDER`, insert between `FlagKey.MOMENTUM_AT_RISK` and `FlagKey.ALL_HEALTHY`:

```java
        OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT,
        OneTimeQuestionService.QUESTION_FLAT_FEEDBACK,
```

and add to the class javadoc:

```java
 * <p>Round 2 S5 (bd mezo-d58h.7.5): the two once-ever QUESTION keys sit at the very tail, above
 * only {@code all_healthy} — a survey question must never displace a health signal, a setup card,
 * or even a momentum nudge. {@code OneTimeQuestionService} also refuses to speak at all on a day
 * that already has a card, so in practice a question only ever fills an otherwise empty day.
```

- [ ] **Step 6: Extend the enumeration guard.** In `AdvicePriorityTest`, add the question keys to the live-constant reflection in `testOrder_shouldContainOnlyLiveConstants` (right after the `SetupCheckService` loop) and pin their rank:

```java
        for (Field f : OneTimeQuestionService.class.getDeclaredFields()) {
            if (Modifier.isPublic(f.getModifiers()) && Modifier.isStatic(f.getModifiers())
                    && f.getType() == String.class && f.getName().startsWith("QUESTION_")) {
                try {
                    liveKeys.add((String) f.get(null));
                } catch (IllegalAccessException e) {
                    throw new AssertionError(e);
                }
            }
        }
```

and a new test:

```java
    /** Round 2 S5 (bd mezo-d58h.7.5): a once-ever question is the least urgent thing the system
     *  can say. It ranks below every flag AND below the setup checks — and still above
     *  {@code all_healthy}, which must stay the tail. */
    @Test
    void testRankOf_shouldRankQuestionsBelowEverythingButAllHealthy() {
        assertThat(AdvicePriority.rankOf(SetupCheckService.CHECK_PLAN_FEASIBILITY))
            .isLessThan(AdvicePriority.rankOf(OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT));
        assertThat(AdvicePriority.rankOf(FlagKey.MOMENTUM_AT_RISK))
            .isLessThan(AdvicePriority.rankOf(OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT));
        assertThat(AdvicePriority.rankOf(OneTimeQuestionService.QUESTION_FLAT_FEEDBACK))
            .isLessThan(AdvicePriority.rankOf(FlagKey.ALL_HEALTHY));
    }
```

- [ ] **Step 7: Wire the job.** In `SetupCheckJob`, add the field and the second call (and mention it in the class javadoc):

```java
    private final UserFanOut userFanOut;
    private final SetupCheckService setupCheckService;
    /** Round 2 S5 (bd mezo-d58h.7.5): the once-ever questions ride THIS cron — the spec forbids a
     *  new one near the dawn cluster, and this pass is already the daily "is there anything to say
     *  that no write announces" loop. Same bean conditions, so injection is safe. */
    private final OneTimeQuestionService oneTimeQuestionService;

    @Scheduled(cron = "${mezo.proactive.setup-checks.cron}")
    public void run() {
        userFanOut.forEachActiveUser("Setup check", user -> {
            try {
                // SetupCheckService already logs which check spoke (or why it stayed quiet).
                setupCheckService.runFor(user.getId());
            } catch (Exception e) {
                log.warn("Setup check failed for user {}", user.getId(), e);
            }
            try {
                // AFTER the setup checks, and with its own catch: a question is the least
                // important thing in this loop and must never cost a setup card. It stays quiet by
                // itself whenever the setup check just spent the day's budget.
                oneTimeQuestionService.runFor(user.getId());
            } catch (Exception e) {
                log.warn("One-time question failed for user {}", user.getId(), e);
            }
        });
    }
```

- [ ] **Step 8: Write the switch-off IT.** Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/OneTimeQuestionSwitchOffIT.java` (copy the exact `@SpringBootTest`/property layout from `InterventionSwitchOffIT` — it is the house shape for this proof):

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.FeatureAbandonmentDetector;
import io.mrkuhne.mezo.feature.proactive.service.FlatFeedbackDetector;
import io.mrkuhne.mezo.feature.proactive.service.OneTimeQuestionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Round 2 S5 (bd mezo-d58h.7.5): with the proactive switch off, no question bean exists at all. */
@TestPropertySource(properties = "mezo.feature.proactive.enabled=false")
class OneTimeQuestionSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldNotHoldTheQuestionBeans_whenProactiveIsOff() {
        assertThat(context.getBeanNamesForType(OneTimeQuestionService.class)).isEmpty();
        assertThat(context.getBeanNamesForType(FeatureAbandonmentDetector.class)).isEmpty();
        assertThat(context.getBeanNamesForType(FlatFeedbackDetector.class)).isEmpty();
    }
}
```

> Verify the switch property name against `InterventionSwitchOffIT` before running — `FeaturesConfiguration.PROACTIVE_SWITCH` is the source of truth, and this file must use the same literal.

- [ ] **Step 9: Run the whole question set.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='AdvicePriorityTest,OneTimeQuestionServiceIT,OneTimeQuestionSwitchOffIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS. `testRunFor_shouldNeverAskAgain_whenTheQuestionCardWasSuperseded` failing means the dedupe read went through JPA — re-check that `questionAlreadyAsked` is `nativeQuery = true` and has no `is_deleted` clause.

- [ ] **Step 10: Commit.**

```bash
git add -A && git commit -m "feat(proactive): once-ever question mechanism + items (17)/(18) (mezo-d58h.7.5)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: the answer becomes one remembered fact

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609061800_mezo-d58h.7.5_knowledge_fact_source_question.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/KnowledgeFactEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/KnowledgeFactRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/MessageFeedbackRecordedEvent.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/MessageFeedbackService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/QuestionAnswerService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/QuestionAnswerListener.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/QuestionAnswerIT.java` (create)

**Interfaces:**
- Consumes: `OneTimeQuestionService.answerFact`, `allAnswerFacts`, `categoryOf` (Task 5).
- Produces: `MessageFeedbackRecordedEvent(UUID userId, String artifactKind, UUID artifactId, String verdict)`.
- Produces: `QuestionAnswerService.record(UUID userId, UUID artifactId, String verdict) → Optional<KnowledgeFactEntity>`.
- Produces: `KnowledgeFactEntity.SOURCE_QUESTION` = `"question"`.

- [ ] **Step 1: Write the failing IT.** Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/QuestionAnswerIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.PutFeedbackRequest;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.service.MessageFeedbackService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.service.OneTimeQuestionService;
import io.mrkuhne.mezo.feature.proactive.service.QuestionAnswerService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec §c): the 👍/👎 on a question card is an ANSWER. It becomes
 * exactly one {@code knowledge_fact} with the {@code question} source, it is rewritten in place
 * when the user flips it, and nothing else happens — no mutation, no second fact, no feature
 * hidden.
 */
class QuestionAnswerIT extends AbstractIntegrationTest {

    @Autowired private QuestionAnswerService questionAnswerService;
    @Autowired private MessageFeedbackService messageFeedbackService;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRecord_shouldRememberTheUpAnswer() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = questionCard(owner, OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT);

        Optional<KnowledgeFactEntity> fact = questionAnswerService.record(
            owner, card.getId(), MessageFeedbackEntity.VERDICT_UP);

        assertThat(fact).isPresent();
        assertThat(fact.orElseThrow().getSource()).isEqualTo(KnowledgeFactEntity.SOURCE_QUESTION);
        assertThat(fact.orElseThrow().getCategory()).isEqualTo("life");
        assertThat(fact.orElseThrow().getFactText()).contains("TUDATOSAN");
        assertThat(fact.orElseThrow().isIncludeInPrompt()).isTrue();
    }

    /** A flip rewrites the SAME fact — the user has one opinion, not a history of them. */
    @Test
    void testRecord_shouldRewriteTheSameFact_whenTheAnswerFlips() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = questionCard(owner, OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT);

        UUID first = questionAnswerService
            .record(owner, card.getId(), MessageFeedbackEntity.VERDICT_UP).orElseThrow().getId();
        UUID second = questionAnswerService
            .record(owner, card.getId(), MessageFeedbackEntity.VERDICT_DOWN).orElseThrow().getId();

        assertThat(second).isEqualTo(first);
        List<KnowledgeFactEntity> facts = knowledgeFactRepository
            .findByCreatedByAndSourceAndDeletedFalse(owner, KnowledgeFactEntity.SOURCE_QUESTION);
        assertThat(facts).hasSize(1);
        assertThat(facts.get(0).getFactText()).contains("kikoptak");
    }

    /** An ordinary advice card's „Segített?" verdict is NOT an answer and must mint no fact. */
    @Test
    void testRecord_shouldDoNothing_forANonQuestionCard() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = companionMessagePopulator.createAdvice(owner, LocalDate.now(),
            "sleep_debt", "sleep_recover_tonight", "Mezo · észrevétel", "…", List.of(),
            List.of("…"), Instant.now());

        assertThat(questionAnswerService.record(owner, card.getId(),
            MessageFeedbackEntity.VERDICT_UP)).isEmpty();
        assertThat(knowledgeFactRepository.findByCreatedByAndSourceAndDeletedFalse(
            owner, KnowledgeFactEntity.SOURCE_QUESTION)).isEmpty();
    }

    /** The wiring: a real feedback write reaches the listener (async hop, Awaitility). */
    @Test
    void testPutFeedback_shouldMintTheFactThroughTheListener() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = questionCard(owner, OneTimeQuestionService.QUESTION_FLAT_FEEDBACK);

        PutFeedbackRequest request = new PutFeedbackRequest();
        request.setArtifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE);
        request.setArtifactId(card.getId());
        request.setVerdict(MessageFeedbackEntity.VERDICT_UP);
        messageFeedbackService.put(owner, request);

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(knowledgeFactRepository
            .findByCreatedByAndSourceAndDeletedFalse(owner, KnowledgeFactEntity.SOURCE_QUESTION))
            .singleElement()
            .satisfies(fact -> assertThat(fact.getCategory()).isEqualTo("train")));
    }

    private CompanionMessageEntity questionCard(UUID owner, String questionKey) {
        CompanionMessageEntity card = companionMessagePopulator.createAdvice(owner, LocalDate.now(),
            questionKey, null, OneTimeQuestionService.EYEBROW, "Kérdés?", List.of("tény"),
            List.of("👍 — igen", "👎 — nem"), Instant.now());
        // createAdvice writes the flag shape (setupKey = null); a question card carries the key in
        // the setupKey slot, which is what the answer path reads.
        card.setContent(new io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope(
            OneTimeQuestionService.EYEBROW, List.of("Kérdés?"), List.of(), null, questionKey,
            questionKey, List.of("tény"), List.of("👍 — igen", "👎 — nem"), List.of(), null));
        return companionMessageRepositorySave(card);
    }

    @Autowired private io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository
        companionMessageRepository;

    private CompanionMessageEntity companionMessageRepositorySave(CompanionMessageEntity card) {
        return companionMessageRepository.saveAndFlush(card);
    }
}
```

> **Register `CreatedAtBackdater` in `AbstractIntegrationTest`'s `@Import` list** — populators are imported explicitly there, not component-scanned.

> **Resolved while executing:** the two-step "write, then rewrite the envelope" fixture was dropped in favour of a `createQuestion(owner, date, questionKey, eyebrow, text, facts, answers, generatedAt)` factory on `CompanionMessagePopulator` (the `createSetup` idiom, with `setupKey` AND `adviceKey` both set to the question key). Task 7's test uses the same factory.

- [ ] **Step 2: Run it and watch it fail.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='QuestionAnswerIT' -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `QuestionAnswerService` does not exist.

- [ ] **Step 3: Widen the CHECK.** Create `backend/src/main/resources/db/changelog/1.0.0/script/202609061800_mezo-d58h.7.5_knowledge_fact_source_question.sql`:

```sql
-- Once-ever question answers (bd mezo-d58h.7.5, spec 2026-09-05 §c): the 👍/👎 on a question card
-- is stored as a knowledge_fact, and a fact must not lie about where it came from — it is neither
-- chat extraction, nor a promoted pattern, nor a manual entry, nor a weekly lesson. FIFTH source
-- constant, drop + re-add (the 202608291100_mezo-d20.7.6_learned_fact_weekly_source.sql idiom).
-- The entity's @Pattern on KnowledgeFactEntity.source mirrors this list; both change together or
-- the insert fails at runtime with a CHECK violation nothing tested.

alter table knowledge_fact drop constraint ck_knowledge_fact_source;
alter table knowledge_fact add constraint ck_knowledge_fact_source
    check (source in ('chat', 'pattern', 'manual', 'weekly_review', 'question'));
```

Register it at the END of `1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202609061800_mezo-d58h.7.5_knowledge_fact_source_question"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609061800_mezo-d58h.7.5_knowledge_fact_source_question.sql
```

- [ ] **Step 4: Mirror it on the entity.** In `KnowledgeFactEntity`:

```java
    /** A once-ever question's answer (round 2 S5, bd mezo-d58h.7.5) — the user answered a direct
     *  question with one tap, which is a confirmation in its own right and needs no Tudástár
     *  accept step. */
    public static final String SOURCE_QUESTION = "question";
```

and widen the `@Pattern` on `source`:

```java
    @Pattern(regexp = "chat|pattern|manual|weekly_review|question")
```

(also extend the field's javadoc line with `'question' = a once-ever question's answer (mezo-d58h.7.5)`).

- [ ] **Step 5: Add the repository read.** In `KnowledgeFactRepository`:

```java
    /** Round 2 S5 (bd mezo-d58h.7.5): every fact minted by a once-ever question answer — the
     *  flip-detection input. Single-user volumes: the caller matches the text in memory against
     *  the two answers that question can produce, which needs no schema for the question key. */
    List<KnowledgeFactEntity> findByCreatedByAndSourceAndDeletedFalse(UUID createdBy, String source);
```

- [ ] **Step 6: Publish the event.** Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/MessageFeedbackRecordedEvent.java`:

```java
package io.mrkuhne.mezo.feature.companion.feedback.service;

import java.util.UUID;

/**
 * A verdict was written (round 2 S5, bd mezo-d58h.7.5). Published by {@link MessageFeedbackService}
 * on every upsert so a consumer can react to WHAT was rated, which the feedback layer itself must
 * not know: it has no idea what a "question card" is, and {@code companion} may never import
 * {@code proactive} to find out. Consumers listen AFTER_COMMIT.
 *
 * <p>Retraction deliberately publishes nothing: "I take my 👍 back" is not a new answer, and the
 * remembered fact stays until the user answers differently. The card is asked once, ever.
 */
public record MessageFeedbackRecordedEvent(UUID userId, String artifactKind, UUID artifactId,
                                           String verdict) {
}
```

In `MessageFeedbackService`, add `private final ApplicationEventPublisher eventPublisher;` (plus the import) and publish at the end of `put`, before the return — restructure so the response is computed first:

```java
        MessageFeedbackResponse response = mapper.toResponse(repository
            .findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(
                userId, request.getArtifactKind(), request.getArtifactId())
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("FEEDBACK_UPSERT_READBACK_FAILED").build(),
                HttpStatus.INTERNAL_SERVER_ERROR)));
        // Round 2 S5 (bd mezo-d58h.7.5): a verdict on a QUESTION card is an answer, not a rating.
        // This layer cannot tell the difference (and must not learn to — companion never imports
        // proactive), so it announces every verdict and lets the consumer decide.
        eventPublisher.publishEvent(new MessageFeedbackRecordedEvent(userId,
            request.getArtifactKind(), request.getArtifactId(), request.getVerdict()));
        return response;
```

- [ ] **Step 7: Write the answer service.** Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/QuestionAnswerService.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The whole consequence of answering a once-ever question (round 2 S5, bd mezo-d58h.7.5, spec §c):
 * ONE {@code knowledge_fact} row. No mutation, no feature hidden, no rule input changed — the spec
 * decided that deliberately, and this class is where that restraint is kept.
 *
 * <p><b>A flip rewrites the fact in place.</b> The user has one opinion about a question, not a
 * history of them; a second row would let the top-N prompt injection carry both answers at once.
 * The existing row is found by TEXT — {@code knowledge_fact} has no question-key column, and the
 * two texts a given question can produce are a closed set
 * ({@link OneTimeQuestionService#allAnswerFacts}) — so no schema change is needed for a fact that
 * is, at most, two rows per user for the app's entire life.
 *
 * <p><b>Not every verdict is an answer.</b> A card whose {@code setupKey} is not a question key is
 * an ordinary „Segített?" rating and is ignored here (and excluded from the effectiveness rollups
 * on the other side — {@code FeedMessageKindService.answerArtifactIds}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class QuestionAnswerService {

    private final CompanionMessageRepository companionMessageRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final OneTimeQuestionService oneTimeQuestionService;

    /** The fact this answer left behind, or empty when the verdict was not an answer at all. */
    @Transactional
    public Optional<KnowledgeFactEntity> record(UUID userId, UUID artifactId, String verdict) {
        // findByIdAndCreatedBy already exists (the S5 apply path's owner-scoped load) and is
        // soft-delete filtered — someone else's card, or a superseded one, simply is not found.
        Optional<CompanionMessageEntity> card =
            companionMessageRepository.findByIdAndCreatedBy(artifactId, userId);
        if (card.isEmpty()) {
            return Optional.empty();
        }
        String questionKey = card.get().getContent().setupKey();
        Optional<String> factText = questionKey == null
            ? Optional.empty()
            : oneTimeQuestionService.answerFact(questionKey, verdict);
        if (factText.isEmpty()) {
            return Optional.empty();
        }
        List<String> possible = oneTimeQuestionService.allAnswerFacts(questionKey);
        KnowledgeFactEntity fact = knowledgeFactRepository
            .findByCreatedByAndSourceAndDeletedFalse(userId, KnowledgeFactEntity.SOURCE_QUESTION)
            .stream()
            .filter(row -> possible.contains(row.getFactText()))
            .findFirst()
            .orElseGet(() -> {
                KnowledgeFactEntity fresh = new KnowledgeFactEntity();
                fresh.setCreatedBy(userId);
                fresh.setSource(KnowledgeFactEntity.SOURCE_QUESTION);
                fresh.setCategory(OneTimeQuestionService.categoryOf(questionKey));
                return fresh;
            });
        fact.setFactText(factText.get());
        fact.setLastReinforcedAt(Instant.now());
        KnowledgeFactEntity saved = knowledgeFactRepository.saveAndFlush(fact);
        log.info("Question {} answered ({}) by user {} — remembered as one fact",
            questionKey, verdict, userId);
        return Optional.of(saved);
    }
}
```

- [ ] **Step 8: Write the listener.** Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/QuestionAnswerListener.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.service.MessageFeedbackRecordedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Round 2 S5 (bd mezo-d58h.7.5): the answer hop. AFTER_COMMIT (only a verdict that persisted is an
 * answer) and {@code @Async} off the request thread (the {@code CompanionMessageEventListener}
 * precedent) — remembering a fact must never slow down or fail a 👍 tap.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class QuestionAnswerListener {

    private final QuestionAnswerService questionAnswerService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onFeedbackRecorded(MessageFeedbackRecordedEvent event) {
        if (!MessageFeedbackEntity.KIND_FEED_MESSAGE.equals(event.artifactKind())) {
            return;
        }
        try {
            questionAnswerService.record(event.userId(), event.artifactId(), event.verdict());
        } catch (Exception e) {
            log.warn("Question-answer recording failed for user {}", event.userId(), e);
        }
    }
}
```

- [ ] **Step 9: Run the IT.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='QuestionAnswerIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS (4 tests). A CHECK-violation failure means the Liquibase changeset was not registered in `1.0.0_master.yml` — the entity `@Pattern` alone does not change the database.

- [ ] **Step 10: Commit.**

```bash
git add -A && git commit -m "feat(proactive): remember the once-ever question's answer as a fact (mezo-d58h.7.5)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: keep answers out of the effectiveness rollups

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/FeedMessageKindSource.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FeedMessageKindService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/FeedbackLearningService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/FeedbackLearningServiceIT.java` (modify — confirm the exact path/name with `find backend/src/test -name 'FeedbackLearning*IT.java'`)

**Why:** a 👎 meaning "no, it just faded" is an ANSWER. Rolled into `surface:feed_message` it becomes evidence that the companion's cards are unhelpful — the system would learn a lie from its own survey, and the down-reason histogram would gain a reason the user never gave.

**Interfaces:**
- Produces: `Set<UUID> FeedMessageKindSource.answerArtifactIds(UUID userId, Collection<UUID> feedMessageIds)`.

- [ ] **Step 1: Write the failing test.** Append to the feedback-learning IT (adapt the fixture helpers to the ones that class already uses):

```java
    /** Round 2 S5 (bd mezo-d58h.7.5): a verdict on a once-ever QUESTION card is an answer, not a
     *  rating — it must not move any effectiveness scope. Without the exclusion the up-count below
     *  would be 1 and the rollup would be learning from a survey answer. */
    @Test
    void testComputeRollups_shouldIgnoreVerdictsOnQuestionCards() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity question = companionMessagePopulator.createAdviceWithActions(owner,
            LocalDate.now(), OneTimeQuestionService.QUESTION_FLAT_FEEDBACK, null,
            OneTimeQuestionService.EYEBROW, "Kérdés?", List.of(), List.of("👍", "👎"),
            List.of(), null, Instant.now());
        question.setContent(new CompanionMessageEnvelope(OneTimeQuestionService.EYEBROW,
            List.of("Kérdés?"), List.of(), null, OneTimeQuestionService.QUESTION_FLAT_FEEDBACK,
            OneTimeQuestionService.QUESTION_FLAT_FEEDBACK, List.of(), List.of("👍", "👎"),
            List.of(), null));
        companionMessageRepository.saveAndFlush(question);
        feedbackPopulator.verdict(owner, MessageFeedbackEntity.KIND_FEED_MESSAGE, question.getId(),
            MessageFeedbackEntity.VERDICT_UP);

        feedbackLearningService.computeRollups(owner);

        FeedbackRollupEntity surface = feedbackRollupRepository
            .findByCreatedByAndScopeAndDeletedFalse(owner,
                FeedbackRollupEntity.SCOPE_SURFACE_PREFIX + MessageFeedbackEntity.KIND_FEED_MESSAGE)
            .orElseThrow();
        assertThat(surface.getStats().up()).isZero();
        assertThat(surface.getStats().down()).isZero();
    }
```

> Check `FeedbackPopulator`'s and `FeedbackRollupRepository`'s real method names before running; the assertion shape (`stats().up()`) must match `FeedbackRollupStatsEnvelope`.

- [ ] **Step 2: Run it and watch it fail.**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='FeedbackLearningServiceIT' -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — `up` is 1, because nothing excludes the answer yet.

- [ ] **Step 3: Add the port method.** In `FeedMessageKindSource`:

```java
    /** Round 2 S5 (bd mezo-d58h.7.5): which of these feed messages are once-ever QUESTION cards,
     *  whose 👍/👎 is the user's ANSWER rather than a verdict on the message's usefulness. The
     *  rollup layer must drop them from every scope, and it cannot decide this itself — the
     *  question keys live in {@code feature.proactive}, which {@code feature.companion} may never
     *  import (the reason this interface exists at all). An implementation that knows of no
     *  questions returns an empty set. */
    Set<UUID> answerArtifactIds(UUID userId, Collection<UUID> feedMessageIds);
```

- [ ] **Step 4: Implement it.** In `FeedMessageKindService`:

```java
    @Override
    @Transactional(readOnly = true)
    public Set<UUID> answerArtifactIds(UUID userId, Collection<UUID> feedMessageIds) {
        if (feedMessageIds.isEmpty()) {
            return Set.of();
        }
        Set<String> questionKeys = Set.of(OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT,
            OneTimeQuestionService.QUESTION_FLAT_FEEDBACK);
        return companionMessageRepository.findAllById(feedMessageIds).stream()
            .filter(m -> userId.equals(m.getCreatedBy()))
            // Null-check BEFORE the set lookup: Set.of(...).contains(null) THROWS, and most advice
            // rows (every flag-sourced one) carry a null setupKey.
            .filter(m -> m.getContent().setupKey() != null
                && questionKeys.contains(m.getContent().setupKey()))
            .map(CompanionMessageEntity::getId)
            .collect(Collectors.toSet());
    }
```

(The constants are plain statics — referencing them creates no bean dependency, so this class keeps its COMPANION-only condition and still resolves with the proactive switch off.)

- [ ] **Step 5: Filter the window once.** In `FeedbackLearningService.computeRollups`, right after the window read:

```java
        // Round 2 S5 (bd mezo-d58h.7.5): a verdict on a once-ever question card is the user's
        // ANSWER, not a rating of the card — dropped here, ONCE, so it stays out of every scope
        // below (surface, feed kind, intervention key AND the down-reason style histogram).
        Set<UUID> answers = feedMessageKindSource.answerArtifactIds(userId, window.stream()
            .filter(byArtifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE))
            .map(MessageFeedbackEntity::getArtifactId).toList());
        if (!answers.isEmpty()) {
            window = window.stream().filter(f -> !answers.contains(f.getArtifactId())).toList();
        }
```

(`window` must become a local that can be reassigned — it already is a local `List`; keep the declaration as `List<MessageFeedbackEntity> window = …`.)

Add to the class javadoc:

```java
 * <p>Round 2 S5 (bd mezo-d58h.7.5): verdicts on once-ever QUESTION cards are removed from the
 * window before any scope is computed — they are answers to a survey question, and counting them
 * as effectiveness would teach the rollup a lie the system told itself.
```

- [ ] **Step 6: Run the IT (the whole class, so the pre-existing rollup tests re-run).**

```bash
backend/mvnw -f backend/pom.xml test -Dtest='FeedbackLearningServiceIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add -A && git commit -m "fix(companion): keep question answers out of the feedback rollups (mezo-d58h.7.5)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: docs, gates, and the merge

**Files:**
- Modify: `docs/features/proactive.md`
- Modify: `docs/features/companion.md`
- Modify: `docs/CODEMAP.md` (generated)

- [ ] **Step 1: Document the slice in `docs/features/proactive.md`.** Four edits, each in the section that already holds its kind of statement:

1. **§4 Configuration** — add the `mezo.proactive.questions.*` block next to `mezo.proactive.setup-checks.*`, with the same "what it means / why this default" tone the neighbouring entries use.
2. **§5, a new `### 5.16 Proactive → Journal / Habit / Ritual / Needs / Train / Companion, the once-ever questions (✅ round 2 S5, `mezo-d58h.7.5`)`** — mirroring §5.14/§5.15 in shape: which tables are read and with what predicate (`habit_day` = `done` only, `ai_message` = `role='user'` only), the one-way direction, and the two ports back into companion (`MessageFeedbackRecordedEvent` in, `FeedMessageKindSource.answerArtifactIds` out).
3. **§7 How to extend it** — a **"To add a new once-ever question"** recipe, in this exact order: (1) a detector in `proactive/service` returning `Optional<…>` with its own honesty gate; (2) a `QUESTION_*` constant + its two answer texts + its `answerFact` arm + its `categoryOf` arm in `OneTimeQuestionService`; (3) an entry in `AdvicePriority.ORDER` **before `all_healthy`** (`AdvicePriorityTest`'s reflection guard fails otherwise); (4) the key in `FeedMessageKindService.answerArtifactIds`' set (or its answers pollute the rollups); (5) thresholds in `QuestionProperties` + `application.yml`; (6) a detector IT and a once-ever IT. **No DB change is needed** — `setupKey` is unconstrained jsonb.
4. **§9 Decisions, gotchas & deferred** — four entries: the soft-delete-visible dedupe and the burn-on-supersession trade; the verbatim bypass and why the LLM must not touch a question; the `habit_day`/`ai_message` "not every row is a user action" trap; and the accepted „Segített?" label mismatch with its follow-up issue id from Step 3.

- [ ] **Step 2: Document the companion side in `docs/features/companion.md`.** Two edits: the feedback section gains "a verdict on a question card is an answer — it publishes `MessageFeedbackRecordedEvent`, mints a `knowledge_fact`, and is excluded from every rollup scope", and the knowledge-fact section gains the fifth `source` value (`question`) with its one-fact-per-question, rewritten-on-flip rule.

- [ ] **Step 3: File the FE follow-up.**

```bash
bd create "Question cards should not say „Segített?"" -t task -p 3 --parent mezo-d58h.7 -d "MezoMessagesSheet.tsx:60 prints the „Segített?" label for every kind=advice row, including the round-2 S5 once-ever question cards, where the 👍/👎 is the ANSWER (the mapping is spelled out in the card's suggestion lines instead). Needs the advice key on the feed contract (FeedMessage) plus a label swap; both VITE_USE_MOCK modes and the visual goldens are in scope. Deliberately left out of mezo-d58h.7.5, which is backend-only."
```

- [ ] **Step 4: Regenerate the codemap.**

```bash
node scripts/gen-codemap.mjs
```

- [ ] **Step 5: Run the focused gate.** Everything this slice touched, plus the two enumeration guards and ArchUnit:

```bash
backend/mvnw -f backend/pom.xml test -Dmezo.test.use-testcontainers=true -Dtest='AdvicePriorityTest,ArchitectureTest,UsageSeamIT,QuestionPropertiesIT,FeatureAbandonmentDetectorIT,FlatFeedbackDetectorIT,OneTimeQuestionServiceIT,OneTimeQuestionSwitchOffIT,QuestionAnswerIT,AdviceCardServiceIT,SetupCheckServiceIT,FeedbackLearningServiceIT,InterventionServiceIT'
```

Read Maven's own exit code and its "Tests run:" lines. A filter that matched nothing is a FAILURE to report, not a pass. **Do not run the full backend suite locally** — it OOM-dies on this machine; CI is the authoritative gate (CLAUDE.md).

- [ ] **Step 6: Commit the docs.**

```bash
git add -A && git commit -m "docs(proactive): once-ever questions — recipe, integrations, traps (mezo-d58h.7.5)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Push and open the self-PR (the CI gate).**

```bash
git push -u origin feat/proactive-round2-s5-one-time-questions && gh pr create --fill
```

- [ ] **Step 8: Wait for CI green, then re-check the merge against the CURRENT main.**

```bash
gh pr checks --watch
```

then (substituting the PR number):

```bash
gh workflow run premerge.yml -f pr=<number>
```

The PR's own green tick can predate the base it will actually merge into; `premerge.yml` re-runs exactly what a merge can break, and fails loudly on a conflict (the state in which GitHub silently runs no checks at all).

- [ ] **Step 9: Merge locally with `--no-ff`, push main, delete the branch.**

```bash
git switch main && git pull --rebase && git merge --no-ff feat/proactive-round2-s5-one-time-questions && git push && git push origin --delete feat/proactive-round2-s5-one-time-questions
```

⚠️ **From a worktree:** do NOT `cd` to the primary checkout to do this — it sits on main and pushing from there bypasses the gate. Run the merge from this worktree (`git switch main` inside the worktree is refused when main is checked out elsewhere; in that case merge from the primary checkout's own session, or use `git push origin HEAD:main` only after `premerge.yml` is green).

- [ ] **Step 10: Close the issue and refresh the off-machine tracker backup.**

```bash
bd close mezo-d58h.7.5 && node scripts/check-beads-backup.mjs --fix
```

Commit the refreshed `.beads/issues.jsonl` (`chore(beads): refresh the tracker export after round 2 S5 (mezo-d58h.7.5)`), then:

```bash
git pull --rebase && bd dolt push && git push && git status
```

`git status` MUST show "up to date with origin".

---

## Definition of done

- `question_feature_abandonment` and `question_flat_feedback` each fire **at most once per user, ever**, and are proven to survive supersession (`testRunFor_shouldNeverAskAgain_whenTheQuestionCardWasSuperseded`).
- A question **never** lands on a day that already has an advice card, and ranks below every flag and setup check.
- The question text reaches the user **verbatim** — no LLM in the path.
- One 👍/👎 tap leaves exactly **one** `knowledge_fact` (`source='question'`), rewritten in place on a flip, and **nothing else changes** — no feature hidden, no data excluded, no rule input altered.
- Answer verdicts move **no** feedback rollup scope.
- Honesty gates hold: never-used ⇒ silence; fewer than 8 feedback-carrying workouts ⇒ silence; `pending` habit rows and assistant chat messages count as neither use nor freshness.
- `docs/features/proactive.md`, `docs/features/companion.md` and `docs/CODEMAP.md` describe the shipped state; CI is green on the PR **and** on `premerge.yml` against current main.

## Self-review notes (checked while writing)

- **Spec coverage.** §c (once-ever mechanism, setup-tier priority, feedback-path answer capture, shared daily budget) → Tasks 1/5/6; §(17) → Tasks 2/3/5; §(18) → Tasks 2/4/5; §error-handling (silence by default, switches, switch-off ITs) → the honesty gates in Tasks 3/4 + Task 5 Step 8; §testing (dedupe IT — exactly one message across repeated sweeps, never again after an answer) → Task 5 Steps 1–2. **Two spec statements are corrected on purpose and the corrections are called out in "The five things…": (a) there is no setup-key DB CHECK to widen, and no flag-key CHECK is involved in S5 at all — the one migration this slice needs is `ck_knowledge_fact_source`; (b) "the envelope-key dedupe with an enormous re-emit window" cannot deliver "once, ever" through JPA, because supersession soft-deletes the evidence — the dedupe is native and window-free instead.**
- **Placeholders.** None: every step carries the actual code, the actual SQL, the actual YAML, or the actual command. The three places where a name must be confirmed against existing test-support code (`AiConversationPopulator`'s factory, `FeedbackPopulator`/`FeedbackRollupRepository`'s methods, `InterventionSwitchOffIT`'s property layout) are marked inline with the exact command or file to check, and are fixture plumbing only — no logic depends on the answer.
- **Type consistency.** `Abandonment(family, priorRows, idleDays)` and `FlatFeedback(workload, jointPain, workouts)` are consumed exactly as declared in Task 5; `answerFact`/`allAnswerFacts`/`categoryOf` are declared in Task 5 and consumed in Task 6; `answerArtifactIds` is declared in Task 7 on both sides; `questionAlreadyAsked` is declared and used in Task 5; `createFeedbackAt` and `CreatedAtBackdater` are declared in Task 2 and used in Tasks 3–5. The only signature change to existing code is `AdviceCandidate`'s new trailing `verbatim` component — the canonical constructor has exactly two call sites, both inside `AdviceCandidate` itself (verified), so nothing else needs touching.
