package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightLogService;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.GoalSuggestionPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Slice-4 suggestion lifecycle: one open per kind, supersede on re-propose, dedup after a decision. */
@Transactional
class GoalSuggestionServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalSuggestionService suggestionService;
    @Autowired private GoalSuggestionRepository suggestionRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalEngineService goalEngineService;
    @Autowired private WeightLogService weightLogService;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private GoalSuggestionPopulator suggestionPopulator;

    /** Owner of the weekly_correction fixtures below — set by {@link #seedEvaluatedActiveCutGoal}. */
    private UUID userId;
    private int weekOffset = 0;

    private GoalSuggestionPayloadJson payload(String suggested, String snapshot) {
        return new GoalSuggestionPayloadJson(
            "A cut-prep mezo deficitet javasol.", suggested, null, null, null, null, "Pre-cut prep", snapshot,
            null, null, null, null, null, null, null, null, null, null, null);
    }

    /** Active cut goal, evaluated (prescription != null) — the weekly_correction accept fixtures. */
    private GoalEntity seedEvaluatedActiveCutGoal() {
        userId = databasePopulator.populateUser("wc-" + UUID.randomUUID() + "@test.local");
        profilePopulator.create(userId);
        GoalEntity goal = goalPopulator.createGoal(userId, "cut", "active");
        goalEngineService.evaluate(userId, goal.getId());
        return goalRepository.findById(goal.getId()).orElseThrow();
    }

    /**
     * A weekly_correction proposal snapshotting {@code goal}'s CURRENT semantic inputs — trajectory,
     * rateTargetPctPerWeek, balanceAdjustmentKcal (the final-review fix's real accept guard, mezo-r4n7)
     * — mirroring exactly what {@code AdaptiveReviewService.reviewUser} snapshots at propose time.
     * {@code prescriptionGeneratedAt} still rides along (display/debug only, no longer guarded on).
     */
    private UUID proposeWeeklyCorrection(GoalEntity goal, int deltaKcal) {
        LocalDate week = LocalDate.of(2026, 8, 24).plusWeeks(weekOffset++);
        GoalSuggestionPayloadJson payload = new GoalSuggestionPayloadJson(
            "Heti korrekció: a mért trend lassabb a célnál.", null, null, null, null, null, null,
            goal.getTrajectory(),
            week.toString(), deltaKcal, new BigDecimal("-0.20"), new BigDecimal("-0.50"), false,
            5, 1800, 2000, goal.getPrescription().generatedAt(),
            goal.getRateTargetPctPerWeek(), goal.getBalanceAdjustmentKcal());
        return suggestionService.propose(userId, goal.getId(),
            GoalSuggestionService.KIND_WEEKLY_CORRECTION, "weekly:" + week, payload).getId();
    }

    @Test
    void testPropose_shouldCreateProposed_whenNoOpenSuggestion() {
        UUID user = databasePopulator.populateUser("sug1@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");

        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        assertThat(s).isNotNull();
        assertThat(s.getStatus()).isEqualTo("proposed");
        assertThat(s.getPayload().suggestedTrajectory()).isEqualTo("cut");
    }

    @Test
    void testPropose_shouldSupersedeOpenRow_whenNewerProposalArrives() {
        UUID user = databasePopulator.populateUser("sug2@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity first = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        GoalSuggestionEntity second = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m2", payload("cut", "bulk"));
        // Force the pending writes to the wire NOW: without the fix (flushing the superseded UPDATE
        // before the new proposed INSERT), Hibernate's insert-before-update ordering would momentarily
        // put two 'proposed' rows for the same (goal, kind) in the DB, violating
        // uq_goal_suggestion_open_per_kind — the rolled-back @Transactional test would otherwise never
        // catch this (findById is served by the identity map, never touching the DB).
        suggestionRepository.flush();

        assertThat(second).isNotNull();
        assertThat(suggestionRepository.findById(first.getId()).orElseThrow().getStatus()).isEqualTo("superseded");
        assertThat(second.getStatus()).isEqualTo("proposed");
    }

    @Test
    void testPropose_shouldReturnNull_whenSameDedupKeyAlreadyDecided() {
        UUID user = databasePopulator.populateUser("sug3@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));
        suggestionService.dismiss(user, goal.getId(), s.getId());

        GoalSuggestionEntity again = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        assertThat(again).as("dismissed dedup key must not re-propose").isNull();
        assertThat(suggestionRepository.findById(s.getId()).orElseThrow().getDecidedAt()).isNotNull();
    }

    @Test
    void testPropose_shouldBeIdempotent_whenOpenRowHasSameDedupKey() {
        UUID user = databasePopulator.populateUser("sug4@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity first = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        GoalSuggestionEntity again = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        assertThat(again).isNotNull();
        assertThat(again.getId()).as("same open input → same row, no supersede churn").isEqualTo(first.getId());
    }

    @Test
    void testAccept_shouldReevaluate_whenSuggestedTrajectoryRemainsCoherent() {
        UUID user = databasePopulator.populateUser("sug5@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:bulk:m1", payload("bulk", "bulk"));

        var response = suggestionService.accept(user, goal.getId(), s.getId());

        assertThat(response.getTrajectory().getValue()).isEqualTo("bulk");
        GoalEntity reloaded = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloaded.getPrescription()).as("accept re-evaluates").isNotNull();
        assertThat(suggestionRepository.findById(s.getId()).orElseThrow().getStatus()).isEqualTo("accepted");
    }

    @Test
    void testAccept_shouldRejectDirectionConflictAndKeepProposalOpen_whenCutChangesToBulk() {
        UUID user = databasePopulator.populateUser("sug-direction-conflict@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        GoalSuggestionEntity suggestion = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:bulk:m1",
            payload("bulk", "cut"));

        assertThatThrownBy(() -> suggestionService.accept(user, goal.getId(), suggestion.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(error -> assertThat(((SystemRuntimeErrorException) error).getMessages())
                .extracting("code")
                .containsExactly("GOAL_DIRECTION_TARGET_CONFLICT"));

        assertThat(goalRepository.findById(goal.getId()).orElseThrow().getTrajectory()).isEqualTo("cut");
        assertThat(suggestionRepository.findById(suggestion.getId()).orElseThrow().getStatus())
            .isEqualTo("proposed");
    }

    @Test
    void testAccept_shouldApplyDeloadOverride_whenPayloadCarriesBalanceOverride() {
        UUID user = databasePopulator.populateUser("sug6@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "deload:m1:w3",
            new GoalSuggestionPayloadJson("Deload hét — tartás.", null, 0, 3, 3, null, "Hyp blokk", "cut",
                null, null, null, null, null, null, null, null, null, null, null));

        suggestionService.accept(user, goal.getId(), s.getId());

        GoalEntity reloaded = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloaded.getSegmentOverrides()).hasSize(1);
        assertThat(reloaded.getSegmentOverrides().get(0).balanceKcal()).isZero();
        assertThat(reloaded.getTrajectory()).as("no trajectory change on a deload accept").isEqualTo("cut");
    }

    /**
     * NOT_SUPPORTED (mezo-ktg8 final-review finding 1 fix-up): the class-level {@code @Transactional}
     * would wrap this test's {@code @BeforeEach} {@code ResetDatabase} TRUNCATE in the SAME ambient
     * transaction as the test body — TRUNCATE takes an {@code AccessExclusiveLock} on every table
     * (including {@code goal_suggestion}) that stays held until the test's transaction ends. Since
     * {@code accept}'s stale branch now calls {@code GoalSuggestionSupersedeWriter} on a REQUIRES_NEW
     * transaction, that helper's SELECT on {@code goal_suggestion} would block forever on the ambient
     * transaction's own TRUNCATE lock — the still-open-transaction-holds-a-lock-the-REQUIRES_NEW-needs
     * deadlock the memory notes warn about, just table-wide via TRUNCATE rather than row-specific
     * (reproduced and confirmed via pg_locks while wiring this fix). Suspending the ambient
     * transaction for just this test method (matching the established {@code AppNotificationServiceIT}
     * / {@code CharacterRunLogIT} idiom for anything exercising a REQUIRES_NEW writer) lets
     * {@code ResetDatabase}'s TRUNCATE commit and release its locks before the test body runs, so every
     * call below is a genuinely separate, immediately-committed transaction — no shared persistence
     * context, so no first-level-cache tricks are needed to observe the supersede either.
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testAccept_shouldSupersedeAnd409_whenGoalTrajectoryChangedSinceProposal() {
        UUID user = databasePopulator.populateUser("sug7@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));
        goal.setTrajectory("maintain"); // the owner edited the goal underneath
        goalRepository.saveAndFlush(goal); // no ambient tx here — must be persisted explicitly

        assertThatThrownBy(() -> suggestionService.accept(user, goal.getId(), s.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT);
        assertThat(suggestionRepository.findById(s.getId()).orElseThrow().getStatus()).isEqualTo("superseded");
    }

    // ── Task 9 (diet-plan slice 5): weekly_correction accept branch ─────────────────────────────

    @Test
    void testAccept_shouldApplyWeeklyCorrectionAndFlipBasis_whenPrescriptionMatches() {
        GoalEntity goal = seedEvaluatedActiveCutGoal();
        UUID sid = proposeWeeklyCorrection(goal, -120);

        suggestionService.accept(userId, goal.getId(), sid);

        GoalEntity reloaded = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloaded.getBalanceAdjustmentKcal()).isEqualTo(-120);
        assertThat(reloaded.getPrescription().basis()).isEqualTo("adaptive");

        // A second accepted correction accumulates onto the first.
        UUID sid2 = proposeWeeklyCorrection(reloaded, -60);
        suggestionService.accept(userId, goal.getId(), sid2);
        assertThat(goalRepository.findById(goal.getId()).orElseThrow().getBalanceAdjustmentKcal())
            .isEqualTo(-180);
    }

    /**
     * Final-review fix (mezo-r4n7): a weigh-in is a REAL production recompute trigger
     * ({@code WeightLogService.log} → {@code GoalEngineService.recomputeActiveGoal} → {@code
     * evaluate}), rotating {@code prescription.generatedAt} — but it touches none of the three
     * semantic snapshots the accept guard now actually checks (trajectory, rateTargetPctPerWeek,
     * balanceAdjustmentKcal). Before the fix, the old {@code prescriptionGeneratedAt}-equality
     * guard 409'd here, and nothing re-proposed the correction until the following Monday. No
     * {@code NOT_SUPPORTED} needed — this path never reaches the REQUIRES_NEW supersede writer.
     */
    @Test
    void testAccept_shouldSucceed_whenWeighInRecomputesPrescriptionBetweenProposeAndAccept() {
        GoalEntity goal = seedEvaluatedActiveCutGoal();
        UUID sid = proposeWeeklyCorrection(goal, -120);

        // The production trigger: WeightLogService.log, not a direct goalEngineService.evaluate call.
        weightLogService.log(userId, new LogWeightRequest()
            .date(LocalDate.of(2026, 6, 18)).weightKg(new BigDecimal("82.10")));

        assertThatCode(() -> suggestionService.accept(userId, goal.getId(), sid)).doesNotThrowAnyException();
        assertThat(goalRepository.findById(goal.getId()).orElseThrow().getBalanceAdjustmentKcal())
            .isEqualTo(-120);
        assertThat(suggestionRepository.findById(sid).orElseThrow().getStatus()).isEqualTo("accepted");
    }

    /**
     * NOT_SUPPORTED — same TRUNCATE-lock trap as {@code testAccept_shouldSupersedeAnd409_...}
     * above: the stale branch's REQUIRES_NEW supersede write would deadlock against the ambient
     * transaction's own {@code ResetDatabase} TRUNCATE lock on {@code goal_suggestion}.
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testAccept_shouldSupersedeAnd409_whenTrajectoryChangedSinceProposal() {
        GoalEntity goal = seedEvaluatedActiveCutGoal();
        UUID sid = proposeWeeklyCorrection(goal, -120);
        goal.setTrajectory("maintain"); // the owner edited the goal underneath
        goalRepository.saveAndFlush(goal); // no ambient tx here — must be persisted explicitly

        assertThatThrownBy(() -> suggestionService.accept(userId, goal.getId(), sid))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT);
        assertThat(suggestionRepository.findById(sid).orElseThrow().getStatus()).isEqualTo("superseded");
    }

    /**
     * NOT_SUPPORTED — same TRUNCATE-lock trap. The stale suggestion under test is seeded directly
     * via {@code GoalSuggestionPopulator} (bypassing {@code propose}'s one-open-per-kind supersede —
     * it snapshots the balanceAdjustmentKcal from BEFORE the other correction below was accepted, as
     * if it had sat open unread since before that accept, so nothing else is open when it's seeded).
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testAccept_shouldSupersedeAnd409_whenAnotherCorrectionAcceptedSinceProposal() {
        GoalEntity goal = seedEvaluatedActiveCutGoal();

        // Another correction proposed + accepted FIRST bumps balanceAdjustmentKcal underneath.
        UUID firstSid = proposeWeeklyCorrection(goal, -60);
        suggestionService.accept(userId, goal.getId(), firstSid);
        GoalEntity afterFirst = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(afterFirst.getBalanceAdjustmentKcal()).isEqualTo(-60);

        GoalSuggestionEntity stale = suggestionPopulator.createOpen(userId, goal.getId(),
            GoalSuggestionService.KIND_WEEKLY_CORRECTION, "weekly:2026-08-17",
            new GoalSuggestionPayloadJson(
                "Heti korrekció: a mért trend lassabb a célnál.", null, null, null, null, null, null,
                afterFirst.getTrajectory(), "2026-08-17", -120, new BigDecimal("-0.20"), new BigDecimal("-0.50"),
                false, 5, 1800, 2000, afterFirst.getPrescription().generatedAt(),
                afterFirst.getRateTargetPctPerWeek(), 0)); // snapshot adjustment 0 — predates firstSid's accept

        assertThatThrownBy(() -> suggestionService.accept(userId, goal.getId(), stale.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT);
        assertThat(suggestionRepository.findById(stale.getId()).orElseThrow().getStatus()).isEqualTo("superseded");
    }
}
