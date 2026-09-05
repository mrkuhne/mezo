package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * S4 (bd mezo-d58h.4, spec §5): the card's facts are DETERMINISTIC and rule-provided — rendered
 * from the raise's own frozen payload, never re-derived and never model-written.
 */
class AdviceFactRendererTest {

    @Test
    void testRender_shouldDescribeASleepDebtRaise() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.sleepDebt(
            new FlagPayloadEnvelope.SleepDebt(8.0, 7, 5, 1.0, 1.6, Map.of()));

        List<String> facts = AdviceFactRenderer.render(FlagKey.SLEEP_DEBT, payload);

        assertThat(facts).hasSize(1);
        assertThat(facts.get(0)).contains("1,6").contains("8,0").contains("5");
    }

    @Test
    void testRender_shouldDescribeAMissedWorkoutsRaise() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.missedWorkouts(
            new FlagPayloadEnvelope.MissedWorkouts(14, 2, 3,
                List.of("2026-09-01", "2026-09-02", "2026-09-03"),
                List.of("2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04")));

        List<String> facts = AdviceFactRenderer.render(FlagKey.MISSED_WORKOUTS, payload);

        assertThat(facts).hasSize(2);
        assertThat(facts.get(0)).contains("3");
        assertThat(facts.get(1)).contains("2026-09-01");
    }

    @Test
    void testRender_shouldDescribeALoggingGapRaise() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.loggingGap(
            new FlagPayloadEnvelope.LoggingGap(List.of("meal", "checkin"), 36, 52, 48, 60,
                null, null, null, null, null));

        List<String> facts = AdviceFactRenderer.render(FlagKey.LOGGING_GAP, payload);

        assertThat(facts).isNotEmpty();
        assertThat(String.join(" ", facts)).contains("étkezés").contains("52");
    }

    /** The sleep-suspicion variant (S2): the gap card says the logged nights ALSO look short. */
    @Test
    void testRender_shouldAddTheSleepSuspicionFact_whenTheGapCarriesIt() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.loggingGap(
            new FlagPayloadEnvelope.LoggingGap(List.of("sleep"), null, null, null, null,
                2, 3, 1.0, 1.4, 3));

        List<String> facts = AdviceFactRenderer.render(FlagKey.LOGGING_GAP, payload);

        assertThat(String.join(" ", facts)).contains("1,4");
    }

    /** The rendered fact must surface the payload's OWN {@code tomorrowMuscle} — the value
     *  actually matched against {@code muscleNeedle} — not a hardcoded "shoulder" claim. Uses a
     *  non-shoulder muscle precisely so a hardcoded string could not pass this test. */
    @Test
    void testRender_shouldDescribeAJointOveruseRaise_usingThePayloadsOwnMuscleNotAHardcodedOne() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.jointOveruse(
            new FlagPayloadEnvelope.JointOveruse(8.0, 5.0, 7, 7, "2026-09-05", "back"));

        List<String> facts = AdviceFactRenderer.render(FlagKey.JOINT_OVERUSE, payload);

        assertThat(facts).hasSize(1);
        assertThat(facts.get(0)).contains("hát-fókuszú").doesNotContain("váll-fókuszú");
    }

    /** The card names the run length, the threshold and the anchor as a CLOCK string (the
     *  shifted-hour payload value formatted back), plus one line per frozen night. */
    @Test
    void testRender_shouldDescribeAnIgnoredNudgeRaise() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.ignoredNudge(
            new FlagPayloadEnvelope.IgnoredNudge("lights_out", 5, 5, 23.25, 60,
                Map.of("2026-09-01", 24.5)));

        List<String> facts = AdviceFactRenderer.render(FlagKey.IGNORED_NUDGE, payload);

        assertThat(facts).hasSize(2);
        assertThat(facts.get(0)).contains("5").contains("60").contains("23:15");
        assertThat(facts.get(1)).contains("2026-09-01").contains("00:30");
    }

    /** The card names the window/threshold, the anchor as a CLOCK string plus the absolute
     *  threshold, and one line per frozen day naming which arm qualified it. */
    @Test
    void testRender_shouldDescribeALateEatingRaise() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.lateEating(
            new FlagPayloadEnvelope.LateEating(90, 22.5, 2, 3, 23.25, 2,
                Map.of("2026-09-01", 22.5, "2026-09-02", 24.5),
                Map.of("2026-09-01", "both", "2026-09-02", "absolute")));

        List<String> facts = AdviceFactRenderer.render(FlagKey.LATE_EATING, payload);

        assertThat(facts).hasSize(4);
        assertThat(facts.get(0)).contains("3").contains("2").contains("2");
        assertThat(facts.get(1)).contains("23:15").contains("90").contains("22:30");
        assertThat(String.join(" ", facts)).contains("2026-09-01").contains("22:30")
            .contains("2026-09-02").contains("00:30");
    }

    /** Trap 1's honest split: with NO goal row (a null anchor), the card must say so rather than
     *  fabricate a bedtime — only the absolute-hour threshold is meaningful in that case. */
    @Test
    void testRender_shouldDescribeALateEatingRaise_withNoAnchor() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.lateEating(
            new FlagPayloadEnvelope.LateEating(90, 22.5, 2, 3, null, 2,
                Map.of("2026-09-01", 22.5, "2026-09-02", 23.0),
                Map.of("2026-09-01", "absolute", "2026-09-02", "absolute")));

        List<String> facts = AdviceFactRenderer.render(FlagKey.LATE_EATING, payload);

        assertThat(facts.get(1)).contains("Nincs").contains("22:30");
    }

    /** Round 2 S1 (mezo-d58h.7.1): the facts name the item, the two missed days and the habit the
     *  user actually had — the card's copy leans on all three ("a sorozat nem veszett el"). */
    @Test
    void testRender_shouldRenderProtocolLapseFacts() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.protocolLapse(
            new FlagPayloadEnvelope.ProtocolLapse("11111111-1111-1111-1111-111111111111",
                "Magnézium", "evening", 2, 2,
                List.of("2026-09-03", "2026-09-04"), "2026-09-02", 14, 12, 0.857, 0.60));

        List<String> facts = AdviceFactRenderer.render(FlagKey.PROTOCOL_LAPSE, payload);

        assertThat(facts).anySatisfy(f -> assertThat(f).contains("Magnézium"));
        assertThat(facts).anySatisfy(f -> assertThat(f).contains("2026-09-04"));
        assertThat(facts).anySatisfy(f -> assertThat(f).contains("2026-09-02"));
        assertThat(facts).anySatisfy(f -> assertThat(f).contains("86"));
    }

    /** Code-review fix (mezo-d58h.7.1): a malformed upstream payload — a null {@code itemName} or a
     *  null {@code missedDueDates} — must not crash the whole advice-card render pipeline. No
     *  production caller populates a null field here today ({@code ProtocolLapseRule} is a later
     *  task), but the renderer must not assume a well-formed caller. */
    @Test
    void testRender_shouldNotThrow_whenProtocolLapseFieldsAreNull() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.protocolLapse(
            new FlagPayloadEnvelope.ProtocolLapse("11111111-1111-1111-1111-111111111111",
                null, "evening", 2, 2, null, "2026-09-02", 14, 12, 0.857, 0.60));

        List<String> facts = AdviceFactRenderer.render(FlagKey.PROTOCOL_LAPSE, payload);

        assertThat(facts).anySatisfy(f -> assertThat(f).contains("ismeretlen kiegészítő"));
    }

    /** Honest absence: no payload (a raise written before the payload existed, or a key with no
     *  renderer) yields NO facts rather than a fabricated one. The card still ships — its prose
     *  falls back to the template, which needs no facts. */
    @Test
    void testRender_shouldReturnNoFacts_whenThePayloadIsMissingOrUnmapped() {
        assertThat(AdviceFactRenderer.render(FlagKey.SLEEP_DEBT, null)).isEmpty();
        assertThat(AdviceFactRenderer.render("brand_new_rule",
            FlagPayloadEnvelope.allHealthy(new FlagPayloadEnvelope.AllHealthy(7, 7)))).isEmpty();
    }

    /** Guards against the {@code AdviceFactRenderer.render} switch's silent {@code default}: a
     *  {@link FlagKey} constant added without a matching renderer branch would fall through to
     *  the unmapped-key path and silently ship a card with an EMPTY evidence block — the same bug
     *  class {@code AdvicePriorityTest.testOrder_shouldCoverEveryLiveFlagKey} guards for the
     *  severity table. Reads {@link FlagKey}'s public static String constants (excluding the
     *  {@code SOURCE_*} raise-source ones) by reflection, so a new flag key fails HERE rather than
     *  in production. Each key is paired with a minimally-populated payload of its own shape — an
     *  unmapped key has no such fixture in {@link #fixtureFor}, which fails loudly rather than
     *  silently falling through. */
    @Test
    void testRender_shouldCoverEveryLiveFlagKey() {
        List<String> flagKeys = new ArrayList<>();
        for (Field f : FlagKey.class.getDeclaredFields()) {
            if (Modifier.isPublic(f.getModifiers()) && Modifier.isStatic(f.getModifiers())
                    && f.getType() == String.class && !f.getName().startsWith("SOURCE_")) {
                try {
                    flagKeys.add((String) f.get(null));
                } catch (IllegalAccessException e) {
                    throw new AssertionError(e);
                }
            }
        }
        assertThat(flagKeys).isNotEmpty();

        for (String key : flagKeys) {
            List<String> facts = AdviceFactRenderer.render(key, fixtureFor(key));
            assertThat(facts)
                .as("flag key '%s' must have a non-default AdviceFactRenderer branch", key)
                .isNotEmpty();
        }
    }

    /** One minimally-populated {@link FlagPayloadEnvelope} per live {@link FlagKey}, matched to
     *  the shape {@code AdviceFactRenderer.render} expects for that key. An unrecognised key fails
     *  the test explicitly instead of silently reusing another key's fixture. */
    private static FlagPayloadEnvelope fixtureFor(String flagKey) {
        return switch (flagKey) {
            case FlagKey.SLEEP_DEBT -> FlagPayloadEnvelope.sleepDebt(
                new FlagPayloadEnvelope.SleepDebt(8.0, 7, 5, 1.0, 1.6, Map.of()));
            case FlagKey.MISSED_WORKOUTS -> FlagPayloadEnvelope.missedWorkouts(
                new FlagPayloadEnvelope.MissedWorkouts(14, 2, 3,
                    List.of("2026-09-01", "2026-09-02", "2026-09-03"),
                    List.of("2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04")));
            case FlagKey.LOGGING_GAP -> FlagPayloadEnvelope.loggingGap(
                new FlagPayloadEnvelope.LoggingGap(List.of("meal", "checkin"), 36, 52, 48, 60,
                    null, null, null, null, null));
            case FlagKey.SUSTAINED_STRESS -> FlagPayloadEnvelope.sustainedStress(
                new FlagPayloadEnvelope.SustainedStress(6.0, 7, 3, 4, Map.of()));
            case FlagKey.MOMENTUM_AT_RISK -> FlagPayloadEnvelope.momentumAtRisk(
                new FlagPayloadEnvelope.MomentumAtRisk(7, 14, 0.4, 0.9, 0.5, 0.5, List.of()));
            case FlagKey.RECOVERY_NEEDED -> FlagPayloadEnvelope.recoveryNeeded(
                new FlagPayloadEnvelope.RecoveryNeeded(
                    7, 6.0, 8.0, 6.0, 5.0, "ma", null, null, null, null));
            case FlagKey.ALL_HEALTHY -> FlagPayloadEnvelope.allHealthy(
                new FlagPayloadEnvelope.AllHealthy(7, 7));
            case FlagKey.ACUTE_BAD_DAY -> FlagPayloadEnvelope.acuteBadDay(
                new FlagPayloadEnvelope.AcuteBadDay(2, 3, 2, List.of(
                    new FlagPayloadEnvelope.QualifyingCheckIn("08:00", 2, 3),
                    new FlagPayloadEnvelope.QualifyingCheckIn("20:00", 3, 2))));
            case FlagKey.LOAD_FUEL_MISMATCH -> FlagPayloadEnvelope.loadFuelMismatch(
                new FlagPayloadEnvelope.LoadFuelMismatch(7, 85.0, 50.0,
                    2100.0, 3100.0, 0.677, 0.8, 7,
                    null, 7.0, 0,
                    4, "kcal", -0.8));
            case FlagKey.RAPID_WEIGHT_LOSS -> FlagPayloadEnvelope.rapidWeightLoss(
                new FlagPayloadEnvelope.RapidWeightLoss(-1.2, -0.7, 5, 4, "bulk"));
            case FlagKey.JOINT_OVERUSE -> FlagPayloadEnvelope.jointOveruse(
                new FlagPayloadEnvelope.JointOveruse(8.0, 5.0, 7, 7, "2026-09-05", "shoulder"));
            case FlagKey.IGNORED_NUDGE -> FlagPayloadEnvelope.ignoredNudge(
                new FlagPayloadEnvelope.IgnoredNudge("lights_out", 5, 5, 23.25, 60,
                    Map.of("2026-09-01", 24.5)));
            case FlagKey.LATE_EATING -> FlagPayloadEnvelope.lateEating(
                new FlagPayloadEnvelope.LateEating(90, 22.5, 2, 3, 23.25, 2,
                    Map.of("2026-09-01", 22.5, "2026-09-02", 24.5),
                    Map.of("2026-09-01", "both", "2026-09-02", "absolute")));
            case FlagKey.PROTOCOL_LAPSE -> FlagPayloadEnvelope.protocolLapse(
                new FlagPayloadEnvelope.ProtocolLapse("11111111-1111-1111-1111-111111111111",
                    "Magnézium", "evening", 2, 2,
                    List.of("2026-09-03", "2026-09-04"), "2026-09-02", 14, 12, 0.857, 0.60));
            default -> throw new AssertionError(
                "no AdviceFactRendererTest fixture for live flag key '" + flagKey + "' — "
                    + "add both a fixture here and a render() branch in AdviceFactRenderer");
        };
    }
}
