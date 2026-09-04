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
            default -> throw new AssertionError(
                "no AdviceFactRendererTest fixture for live flag key '" + flagKey + "' — "
                    + "add both a fixture here and a render() branch in AdviceFactRenderer");
        };
    }
}
