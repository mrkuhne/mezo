package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifies the heuristic feasibility gate + segmented prescription assembly (spec §5.1 + §3.3,
 * D9–D11). The orchestrator {@link GoalEngineService#evaluate(UUID, UUID)} loads the goal + profile
 * + current weight, runs the upstream engine (bootstrap → trend → projection → guards), applies the
 * deterministic feasibility checks (rate realism / guard satisfiability / conflict), assembles the
 * per-segment recept (kcal/protein/sleep/rest), and persists {@code goal.tdeeBootstrap} +
 * {@code goal.prescription}.
 *
 * <p>The goal window is 8 weeks ({@link GoalPopulator}: 2026-06-01..2026-07-27). The profile is an
 * 84 kg-class male; the current weight comes from a seeded weigh-in. Verdicts and numbers are
 * deterministic because all upstream inputs are pure functions of the seeded DB state.
 */
@Transactional
class GoalEvaluationServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalEngineService engine;
    @Autowired private GoalRepository goalRepository;
    @Autowired private BiometricProfileRepository profileRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalPlanLinkPopulator linkPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /** A current weigh-in so the bootstrap has a real BMR basis (and the goal's start weight). */
    private void seedWeight(UUID user, String kg) {
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 1), new BigDecimal(kg));
    }

    /** Build a goal with the given trajectory + rate%, override the populator's defaults. */
    private GoalEntity goal(UUID user, String trajectory, String ratePct, List<String> guards) {
        GoalEntity g = goalPopulator.createGoal(user, trajectory, "active");
        g.setRateTargetPctPerWeek(new BigDecimal(ratePct));
        g.setGuards(guards);
        return goalRepository.saveAndFlush(g);
    }

    // ── Realistic cut: in-band rate → feasible, descending kcal as running ends, protein ≈2 g/kg ──

    @Test
    void testEvaluate_shouldReturnFeasibleWithDescendingKcal_whenRealisticCut() {
        UUID user = databasePopulator.populateUser("eval-cut@test.local");
        profilePopulator.create(user);
        seedWeight(user, "84.00");
        GoalEntity g = goal(user, "cut", "0.70", List.of("muscle"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        RunningBlockEntity run = runningPopulator.createBlockWithSessions(user, "intervals", "planned", 8, 4);
        linkPopulator.createLink(user, g.getId(), "mesocycle", meso.getId(), 1, 8);
        linkPopulator.createLink(user, g.getId(), "running_block", run.getId(), 1, 4);

        GoalPrescriptionJson rx = engine.evaluate(user, g.getId());

        assertThat(rx.feasibility().verdict()).isEqualTo("feasible");
        assertThat(rx.basis()).isEqualTo("formula");
        assertThat(rx.generatedAt()).isNotNull();
        assertThat(rx.segments()).hasSizeGreaterThanOrEqualTo(2);

        // running W1-4 raises TDEE; W5-8 it drops → kcal steps DOWN across segments (cut).
        GoalPrescriptionJson.Segment runOn = rx.segments().get(0);
        GoalPrescriptionJson.Segment runOff = rx.segments().get(1);
        assertThat(runOn.kcal()).isGreaterThan(runOff.kcal());
        // cut → every segment's projected rate is negative.
        assertThat(rx.segments()).allMatch(s -> s.projectedRateKgPerWk().signum() < 0);

        // protein ≈ 2.0 g/kg BW × 84 kg = 168 g (BW path is the floor; LBM path 2.3-3.1 g/kg LBM
        // on 71.4 kg LBM = 164-221, capped at 2.6 g/kg BW = 218 — the higher of the two, capped).
        assertThat(runOn.proteinG()).isBetween(160, 220);
        assertThat(runOn.sleepTargetH()).isNotNull();
    }

    // ── Aggressive cut: 1.5 %/wk is over the 1.0 cap → aggressive verdict + a note ────────────────

    @Test
    void testEvaluate_shouldReturnAggressive_whenCutRateOverCap() {
        UUID user = databasePopulator.populateUser("eval-aggr@test.local");
        profilePopulator.create(user);
        seedWeight(user, "84.00");
        GoalEntity g = goal(user, "cut", "1.50", List.of("muscle"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        linkPopulator.createLink(user, g.getId(), "mesocycle", meso.getId(), 1, 8);

        GoalPrescriptionJson rx = engine.evaluate(user, g.getId());

        assertThat(rx.feasibility().verdict()).isEqualTo("aggressive");
        assertThat(rx.feasibility().notes()).isNotEmpty();
        assertThat(rx.feasibility().notes()).anyMatch(n -> n.toLowerCase().contains("ütem"));
    }

    // ── Conflict: aggressive cut + heavy running + strength guard → a conflict note ───────────────

    @Test
    void testEvaluate_shouldFlagConflict_whenAggressiveCutWithRunningAndStrengthGuard() {
        UUID user = databasePopulator.populateUser("eval-conflict@test.local");
        profilePopulator.create(user);
        seedWeight(user, "84.00");
        GoalEntity g = goal(user, "cut", "1.50", List.of("strength"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        RunningBlockEntity run = runningPopulator.createBlockWithSessions(user, "intervals", "planned", 8, 4);
        linkPopulator.createLink(user, g.getId(), "mesocycle", meso.getId(), 1, 8);
        linkPopulator.createLink(user, g.getId(), "running_block", run.getId(), 1, 8);

        GoalPrescriptionJson rx = engine.evaluate(user, g.getId());

        assertThat(rx.feasibility().verdict()).isEqualTo("aggressive");
        // a conflict note mentioning the strength risk / running.
        assertThat(rx.feasibility().notes())
            .anyMatch(n -> n.toLowerCase().contains("erő") || n.toLowerCase().contains("futás"));
    }

    // ── Conflict escalation: warnings-band rate (NOT over-cap) + running + strength → aggressive ───

    /**
     * G6 (mezo-06n) widened {@code overBand} to the whole over-target band, so a rate that grades
     * {@code feasible-with-warnings} on its own (0.85 %BW/wk — over the 0.7 target but under the 1.0
     * cap, so NOT aggressive by rate) escalates to {@code aggressive} via the conflict rule when an
     * active running block + an active strength guard co-occur. This proves the verdict came from the
     * conflict rule, not from the rate alone.
     */
    @Test
    void testEvaluate_shouldEscalateToAggressive_whenWarningsBandRateConflictsWithRunningAndStrengthGuard() {
        UUID user = databasePopulator.populateUser("eval-escalate@test.local");
        profilePopulator.create(user);
        seedWeight(user, "84.00");
        // 0.85 %BW/wk: over the 0.7 recommended target, under the 1.0 cap → warnings band (NOT aggressive).
        GoalEntity g = goal(user, "cut", "0.85", List.of("strength"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        RunningBlockEntity run = runningPopulator.createBlockWithSessions(user, "intervals", "planned", 8, 4);
        linkPopulator.createLink(user, g.getId(), "mesocycle", meso.getId(), 1, 8);
        linkPopulator.createLink(user, g.getId(), "running_block", run.getId(), 1, 8);

        GoalPrescriptionJson rx = engine.evaluate(user, g.getId());

        // The rate alone is only a warning; the conflict rule escalates the verdict to aggressive.
        assertThat(rx.feasibility().verdict()).isEqualTo("aggressive");
        assertThat(rx.feasibility().notes())
            .anyMatch(n -> n.toLowerCase().contains("konfliktus"));
    }

    // ── Bulk: a coherent SURPLUS recept — kcal > tdee, positive rate, sane protein (spec §9.4) ────

    @Test
    void testEvaluate_shouldReturnCoherentSurplusRecept_whenBulk() {
        UUID user = databasePopulator.populateUser("eval-bulk@test.local");
        profilePopulator.create(user);
        seedWeight(user, "84.00");
        GoalEntity g = goal(user, "bulk", "0.50", List.of("muscle"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        linkPopulator.createLink(user, g.getId(), "mesocycle", meso.getId(), 1, 8);

        GoalPrescriptionJson rx = engine.evaluate(user, g.getId());

        // 0.50 %BW/wk surplus is in-band → feasible (not aggressive).
        assertThat(rx.feasibility().verdict()).isEqualTo("feasible");
        assertThat(rx.segments()).isNotEmpty();
        GoalPrescriptionJson.Segment s = rx.segments().get(0);
        // surplus → positive projected rate (kcal-vs-TDEE asserted against the persisted bootstrap below).
        assertThat(s.projectedRateKgPerWk().signum()).isGreaterThan(0);
        // sane protein target (84 kg, between BW floor and the LBM cap).
        assertThat(s.proteinG()).isBetween(160, 220);

        // kcal surplus vs the persisted bootstrap TDEE.
        GoalEntity reloaded = goalRepository.findById(g.getId()).orElseThrow();
        assertThat(reloaded.getTdeeBootstrap()).isNotNull();
        assertThat(new BigDecimal(s.kcal()).doubleValue())
            .isGreaterThan(reloaded.getTdeeBootstrap().tdee().doubleValue());
    }

    // ── Maintain: ~maintenance kcal (≈TDEE), rate ≈0, feasible ────────────────────────────────────

    @Test
    void testEvaluate_shouldHoldKcalAtTdee_whenMaintain() {
        UUID user = databasePopulator.populateUser("eval-maint@test.local");
        profilePopulator.create(user);
        seedWeight(user, "84.00");
        GoalEntity g = goal(user, "maintain", "0.00", List.of());
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        linkPopulator.createLink(user, g.getId(), "mesocycle", meso.getId(), 1, 8);

        GoalPrescriptionJson rx = engine.evaluate(user, g.getId());

        assertThat(rx.feasibility().verdict()).isEqualTo("feasible");
        GoalPrescriptionJson.Segment s = rx.segments().get(0);
        GoalEntity reloaded = goalRepository.findById(g.getId()).orElseThrow();
        // maintain → kcal ≈ TDEE (within a rounding kcal), rate ≈ 0.
        assertThat(new BigDecimal(s.kcal()).doubleValue())
            .isCloseTo(reloaded.getTdeeBootstrap().tdee().doubleValue(), within(1.0));
        assertThat(s.projectedRateKgPerWk().doubleValue()).isCloseTo(0.0, within(0.001));
    }

    // ── No biometric profile: graceful — a feasibility note, no throw, prescription persisted ─────

    @Test
    void testEvaluate_shouldReturnGracefulNote_whenNoBiometricProfile() {
        UUID user = databasePopulator.populateUser("eval-noprofile@test.local");
        seedWeight(user, "84.00");
        GoalEntity g = goal(user, "cut", "0.70", List.of("muscle"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        linkPopulator.createLink(user, g.getId(), "mesocycle", meso.getId(), 1, 8);

        GoalPrescriptionJson rx = engine.evaluate(user, g.getId());

        assertThat(rx).isNotNull();
        assertThat(rx.feasibility().notes()).anyMatch(n -> n.toLowerCase().contains("profil"));
        // persisted (read-back) without crashing — bootstrap stays null (no profile to compute from).
        GoalEntity reloaded = goalRepository.findById(g.getId()).orElseThrow();
        assertThat(reloaded.getPrescription()).isNotNull();
        assertThat(reloaded.getTdeeBootstrap()).isNull();
    }

    // ── Round-trip: tdeeBootstrap + prescription persist and read back intact ─────────────────────

    @Test
    void testEvaluate_shouldPersistAndReadBackArtifact_whenEvaluated() {
        UUID user = databasePopulator.populateUser("eval-roundtrip@test.local");
        profilePopulator.create(user);
        seedWeight(user, "84.00");
        GoalEntity g = goal(user, "cut", "0.70", List.of("strength", "muscle"));
        MesocycleEntity meso = trainPopulator.createMesocycleWithPhase(user, "RP", "active", 8, "MAV");
        linkPopulator.createLink(user, g.getId(), "mesocycle", meso.getId(), 1, 8);

        GoalPrescriptionJson rx = engine.evaluate(user, g.getId());

        GoalEntity reloaded = goalRepository.findById(g.getId()).orElseThrow();
        assertThat(reloaded.getTdeeBootstrap()).isNotNull();
        assertThat(reloaded.getTdeeBootstrap().tdee()).isNotNull();
        assertThat(reloaded.getPrescription()).isNotNull();
        assertThat(reloaded.getPrescription().segments()).hasSameSizeAs(rx.segments());
        assertThat(reloaded.getPrescription().feasibility().verdict()).isEqualTo(rx.feasibility().verdict());
        assertThat(reloaded.getPrescription().guardStatus().strength().active()).isTrue();
        assertThat(reloaded.getPrescription().guardStatus().muscle().active()).isTrue();
        assertThat(reloaded.getPrescription().guardStatus().muscle().proteinMonitored()).isFalse();
    }
}
