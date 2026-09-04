package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S4 (bd mezo-d58h.4, spec §4 row 3): a live {@code missed_workouts} raise becomes a FACT in the
 * morning briefing's prompt — "no more blind cheering". The block is read from the raise's own
 * frozen payload, never re-derived. Lives in the {@code ...proactive.service} package so it can
 * assert the package-private block builder directly rather than guessing at prompt text through
 * the fake's answer.
 */
class CompanionMessageMissedWorkoutsIT extends AbstractIntegrationTest {

    @Autowired private CompanionMessageGenerator companionMessageGenerator;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private FlagPayloadEnvelope payload() {
        return FlagPayloadEnvelope.missedWorkouts(new FlagPayloadEnvelope.MissedWorkouts(
            14, 2, 3, List.of("2026-09-01", "2026-09-02", "2026-09-03"),
            List.of("2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04")));
    }

    @Test
    void testMissedWorkoutsBlock_shouldCarryTheRaisesOwnNumbers() {
        UUID owner = userPopulator.createUser().getId();
        flagLogPopulator.raise(owner, FlagKey.MISSED_WORKOUTS, FlagKey.SOURCE_SWEEP, payload());

        String block = companionMessageGenerator.missedWorkoutsBlock(owner, LocalDate.now());

        assertThat(block).contains("KIMARADT EDZÉSEK").contains("3").contains("2026-09-02");
    }

    @Test
    void testMissedWorkoutsBlock_shouldBeEmpty_whenThereIsNoRaise() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(companionMessageGenerator.missedWorkoutsBlock(owner, LocalDate.now())).isEmpty();
    }

    /** A raise older than the briefing's own lookback window is stale news — the morning message
     *  must not keep scolding about a run of missed days from a month ago. */
    @Test
    void testMissedWorkoutsBlock_shouldBeEmpty_whenTheRaiseIsOlderThanTheFeedWindow() {
        UUID owner = userPopulator.createUser().getId();
        flagLogPopulator.raiseAt(owner, FlagKey.MISSED_WORKOUTS, FlagKey.SOURCE_SWEEP, payload(),
            Instant.now().minus(365, ChronoUnit.DAYS));

        assertThat(companionMessageGenerator.missedWorkoutsBlock(owner, LocalDate.now())).isEmpty();
    }
}
