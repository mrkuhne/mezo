package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
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
}
