package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The observer's two trace reads (spec 2026-09-05 §4.3). */
class CompanionFlagTraceReadQueriesIT extends AbstractIntegrationTest {

    @Autowired
    private CompanionFlagTraceRepository repository;

    @Autowired
    private UserPopulator userPopulator;

    private void row(UUID userId, String flagKey, String outcome, Instant at) {
        CompanionFlagTraceEntity e = new CompanionFlagTraceEntity();
        e.setCreatedBy(userId);
        e.setFlagKey(flagKey);
        e.setOutcome(outcome);
        e.setOccurredAt(at);
        repository.saveAndFlush(e);
    }

    private UUID createUser() {
        return userPopulator.createUser().getId();
    }

    @Test
    void closing_state_is_the_last_row_at_or_before_the_cutoff_even_if_it_predates_the_day() {
        UUID userId = createUser();
        Instant twoDaysAgo = Instant.parse("2026-09-01T09:00:00Z");
        Instant afterCutoff = Instant.parse("2026-09-05T09:00:00Z");
        Instant cutoff = Instant.parse("2026-09-03T21:59:59Z");
        row(userId, FlagKey.SLEEP_DEBT, "raised", twoDaysAgo);
        row(userId, FlagKey.SLEEP_DEBT, "clear", afterCutoff);

        assertThat(repository
            .findFirstByCreatedByAndFlagKeyAndOccurredAtLessThanEqualOrderByOccurredAtDesc(
                userId, FlagKey.SLEEP_DEBT, cutoff))
            .get().extracting(CompanionFlagTraceEntity::getOutcome).isEqualTo("raised");
    }

    @Test
    void a_rule_with_no_row_before_the_cutoff_reads_back_empty() {
        UUID userId = createUser();
        row(userId, FlagKey.SLEEP_DEBT, "raised", Instant.parse("2026-09-05T09:00:00Z"));
        assertThat(repository
            .findFirstByCreatedByAndFlagKeyAndOccurredAtLessThanEqualOrderByOccurredAtDesc(
                userId, FlagKey.SLEEP_DEBT, Instant.parse("2026-09-03T21:59:59Z")))
            .isEmpty();
    }

    @Test
    void earliest_occurred_at_is_the_day_pagers_floor_and_null_for_a_user_with_no_trace() {
        UUID userId = createUser();
        assertThat(repository.earliestOccurredAt(userId)).isNull();
        row(userId, FlagKey.SLEEP_DEBT, "clear", Instant.parse("2026-09-02T09:00:00Z"));
        row(userId, FlagKey.LATE_EATING, "clear", Instant.parse("2026-09-01T09:00:00Z"));
        assertThat(repository.earliestOccurredAt(userId))
            .isEqualTo(Instant.parse("2026-09-01T09:00:00Z"));
    }
}
