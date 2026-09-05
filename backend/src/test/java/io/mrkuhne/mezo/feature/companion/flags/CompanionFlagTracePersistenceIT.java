package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CompanionFlagTracePersistenceIT extends AbstractIntegrationTest {

    @Autowired CompanionFlagTraceRepository repository;
    @Autowired UserPopulator userPopulator;

    @Test
    void testFindFirst_shouldReturnTheNewestRowForThatRuleOnly() {
        UUID user = userPopulator.createUser().getId();
        Instant now = Instant.now();
        save(user, FlagKey.SLEEP_DEBT, "clear", now.minus(2, ChronoUnit.HOURS));
        save(user, FlagKey.SLEEP_DEBT, "raised", now.minus(1, ChronoUnit.HOURS));
        save(user, FlagKey.LATE_EATING, "raised", now);

        CompanionFlagTraceEntity newest = repository
            .findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(user, FlagKey.SLEEP_DEBT)
            .orElseThrow();

        assertThat(newest.getOutcome()).isEqualTo("raised");
    }

    @Test
    void testEvidence_shouldRoundTripThroughJsonb() {
        UUID user = userPopulator.createUser().getId();
        CompanionFlagTraceEntity row = row(user, FlagKey.SLEEP_DEBT, "clear", Instant.now());
        row.setEvidence(new FlagVerdict.ClearEvidence("deficit_hours", 1.25, 6.0, null));
        repository.save(row);

        FlagVerdict.ClearEvidence read = repository
            .findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(user, FlagKey.SLEEP_DEBT)
            .orElseThrow().getEvidence();

        assertThat(read.metric()).isEqualTo("deficit_hours");
        assertThat(read.observed()).isEqualTo(1.25);
        assertThat(read.threshold()).isEqualTo(6.0);
        assertThat(read.detail()).isNull();
    }

    @Test
    void testFindByWindow_shouldExcludeRowsOutsideIt() {
        UUID user = userPopulator.createUser().getId();
        Instant now = Instant.now();
        save(user, FlagKey.SLEEP_DEBT, "clear", now.minus(3, ChronoUnit.DAYS));
        save(user, FlagKey.LATE_EATING, "raised", now.minus(1, ChronoUnit.HOURS));

        assertThat(repository.findByCreatedByAndOccurredAtBetweenOrderByOccurredAtAsc(
            user, now.minus(1, ChronoUnit.DAYS), now))
            .extracting(CompanionFlagTraceEntity::getFlagKey)
            .containsExactly(FlagKey.LATE_EATING);
    }

    private void save(UUID user, String flagKey, String outcome, Instant at) {
        repository.save(row(user, flagKey, outcome, at));
    }

    private CompanionFlagTraceEntity row(UUID user, String flagKey, String outcome, Instant at) {
        CompanionFlagTraceEntity row = new CompanionFlagTraceEntity();
        row.setCreatedBy(user);
        row.setFlagKey(flagKey);
        row.setOutcome(outcome);
        row.setOccurredAt(at);
        return row;
    }
}
