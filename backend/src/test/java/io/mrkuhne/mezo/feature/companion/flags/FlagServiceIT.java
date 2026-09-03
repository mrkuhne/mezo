package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaisedEvent;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

/**
 * {@code @RecordApplicationEvents} records only what publishes on the TEST's own thread — fine
 * here since {@link FlagService#evaluateAndLog} is called directly, not over HTTP (the
 * {@code MesocycleCloseReportIT} / {@code RitualReflectionEventIT} precedent). No class-level
 * {@code @Transactional}: this class already runs each test's writes as real committed
 * transactions (see the cooldown tests below, which depend on that across separate calls).
 */
@RecordApplicationEvents
class FlagServiceIT extends AbstractIntegrationTest {

    @Autowired private FlagService flagService;
    @Autowired private CompanionFlagLogRepository repository;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private ApplicationEvents applicationEvents;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private void stressedThreeDays(UUID owner) {
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 8, null);
    }

    @Test
    void writes_one_audit_row_per_raised_flag_with_the_source() {
        UUID owner = ownerId();
        stressedThreeDays(owner);

        List<String> raised = flagService.evaluateAndLog(owner, FlagKey.SOURCE_WRITE);

        assertThat(raised).contains(FlagKey.SUSTAINED_STRESS);
        CompanionFlagLogEntity row = repository
            .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(owner, FlagKey.SUSTAINED_STRESS)
            .orElseThrow();
        assertThat(row.getSource()).isEqualTo(FlagKey.SOURCE_WRITE);
        assertThat(row.getPayload().sustainedStress().daysOverThreshold()).isEqualTo(3);
    }

    @Test
    void the_cooldown_blocks_an_immediate_re_raise() {
        UUID owner = ownerId();
        stressedThreeDays(owner);

        flagService.evaluateAndLog(owner, FlagKey.SOURCE_WRITE);
        List<String> second = flagService.evaluateAndLog(owner, FlagKey.SOURCE_SWEEP);

        assertThat(second).doesNotContain(FlagKey.SUSTAINED_STRESS);
        assertThat(repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner))
            .filteredOn(r -> FlagKey.SUSTAINED_STRESS.equals(r.getFlagKey()))
            .hasSize(1);
    }

    @Test
    void the_flag_re_raises_once_its_cooldown_has_expired() {
        UUID owner = ownerId();
        stressedThreeDays(owner);
        flagLogPopulator.raiseAt(owner, FlagKey.SUSTAINED_STRESS, FlagKey.SOURCE_SWEEP, null,
            Instant.now().minus(25, ChronoUnit.HOURS)); // cooldown is 24h

        assertThat(flagService.evaluateAndLog(owner, FlagKey.SOURCE_SWEEP))
            .contains(FlagKey.SUSTAINED_STRESS);
    }

    @Test
    void a_quiet_evaluation_writes_only_logging_gap() {
        // A brand-new account has never logged a meal, check-in or sleep row at all — which S2's
        // logging_gap now correctly names instead of staying silent (it is not "nothing", it is
        // the most stale a domain can be). "Quiet" here means none of the value-based rules
        // (stress/sleep/momentum/recovery) mistakenly fire on absent data.
        UUID owner = ownerId();

        assertThat(flagService.evaluateAndLog(owner, FlagKey.SOURCE_SWEEP))
            .containsExactly(FlagKey.LOGGING_GAP);
        assertThat(repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner)).hasSize(1);
    }

    @Test
    void write_and_sweep_raise_identically_apart_from_the_source() {
        UUID owner = ownerId();
        stressedThreeDays(owner);
        UUID other = databasePopulator.populateUser("flag-sweep-twin@example.com");
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(other, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(other, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(other, today.minusDays(2), "08:00", 4, 8, null);

        List<String> viaWrite = flagService.evaluateAndLog(owner, FlagKey.SOURCE_WRITE);
        List<String> viaSweep = flagService.evaluateAndLog(other, FlagKey.SOURCE_SWEEP);

        assertThat(viaWrite).isEqualTo(viaSweep);
        assertThat(repository
            .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(owner, FlagKey.SUSTAINED_STRESS)
            .orElseThrow().getPayload().sustainedStress())
            .isEqualTo(repository
                .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(other, FlagKey.SUSTAINED_STRESS)
                .orElseThrow().getPayload().sustainedStress());
    }

    @Test
    void a_written_raise_publishes_a_flag_raised_event() {
        UUID owner = ownerId();
        stressedThreeDays(owner);

        flagService.evaluateAndLog(owner, FlagKey.SOURCE_SWEEP);

        assertThat(applicationEvents.stream(FlagRaisedEvent.class))
            .anySatisfy(e -> {
                assertThat(e.userId()).isEqualTo(owner);
                assertThat(e.flagKey()).isEqualTo(FlagKey.SUSTAINED_STRESS);
                assertThat(e.source()).isEqualTo(FlagKey.SOURCE_SWEEP);
            });

        // a cooldown-suppressed second run publishes nothing new
        applicationEvents.clear();
        flagService.evaluateAndLog(owner, FlagKey.SOURCE_SWEEP);

        assertThat(applicationEvents.stream(FlagRaisedEvent.class)).isEmpty();
    }
}
