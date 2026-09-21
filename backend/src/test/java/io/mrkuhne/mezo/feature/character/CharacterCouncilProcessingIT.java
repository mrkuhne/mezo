package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.CharacterCouncilProcessing;
import io.mrkuhne.mezo.feature.character.service.CharacterRunLog;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CharacterCouncilProcessingIT extends AbstractIntegrationTest {
    @Autowired private CharacterCouncilProcessing processing;
    @Autowired private CharacterRunLog runs;
    @Autowired private UserPopulator users;
    @Autowired private io.mrkuhne.mezo.support.populator.CharacterCouncilPopulator councilData;

    @Test
    void testClaim_shouldWait_whenNightlyInputNotReady() {
        var owner = users.createUser().getId();
        var day = LocalDate.of(2026, 9, 21);
        assertThat(processing.claim(owner, day)).isNull();
        assertThat(processing.status(owner, day).getStatus().getValue()).isEqualTo("WAITING");
    }

    @Test
    void testClaim_shouldLeaseOnceAndKeepQuietTerminal_whenNoNewInput() {
        var owner = users.createUser().getId();
        var day = LocalDate.of(2026, 9, 21);
        runs.record(owner, "NIGHTLY", day.minusDays(1), 0, 0, List.of(), List.of(), null);
        var lease = processing.claim(owner, day);
        assertThat(lease).isNotNull();
        assertThat(processing.claim(owner, day)).isNull();
        processing.quiet(lease);
        assertThat(processing.status(owner, day).getStatus().getValue()).isEqualTo("QUIET");
        assertThat(processing.claim(owner, day)).isNull();
        assertThat(processing.status(users.createUser().getId(), day).getStatus().getValue()).isEqualTo("WAITING");
    }

    @Test
    void testFailed_shouldAllowRetryButRejectStaleWorker_whenNewLeaseExists() {
        var owner = users.createUser().getId();
        var day = LocalDate.of(2026, 9, 21);
        runs.record(owner, "NIGHTLY", day.minusDays(1), 0, 0, List.of(), List.of(), null);
        var old = processing.claim(owner, day);
        processing.failed(old);
        var next = processing.claim(owner, day);
        assertThat(next.token()).isNotEqualTo(old.token());
        processing.quiet(old);
        assertThat(processing.status(owner, day).getStatus().getValue()).isEqualTo("PROCESSING");
        processing.quiet(next);
        assertThat(processing.status(owner, day).getStatus().getValue()).isEqualTo("QUIET");
    }
    @Test
    void testClaim_shouldStopCostlyRetries_whenDailyAttemptsExhausted() {
        var owner = users.createUser().getId();
        var day = LocalDate.of(2026, 9, 21);
        runs.record(owner, "NIGHTLY", day.minusDays(1), 0, 0, List.of(), List.of(), null);
        for (int i = 0; i < 3; i++) {
            var lease = processing.claim(owner, day);
            assertThat(lease).isNotNull();
            processing.failed(lease);
        }
        assertThat(processing.claim(owner, day)).isNull();
        assertThat(processing.status(owner, day).getStatus().getValue()).isEqualTo("FAILED");
    }

    @Test
    void testClaim_shouldNotPublishQuiet_whenNightlyFailed() {
        var owner = users.createUser().getId();
        var day = LocalDate.of(2026, 9, 21);
        runs.recordObservationFailure(owner, day.minusDays(1));
        assertThat(processing.claim(owner, day)).isNull();
        assertThat(processing.status(owner, day).getStatus().getValue()).isEqualTo("FAILED");
    }

    @Test
    void testClaim_shouldRecoverExpiredLease_whenPreviousWorkerDisappeared() {
        var owner = users.createUser().getId();
        var day = LocalDate.of(2026, 9, 21);
        runs.record(owner, "NIGHTLY", day.minusDays(1), 0, 0, List.of(), List.of(), null);
        var expired = councilData.expiredEdition(owner, day);
        var lease = processing.claim(owner, day);
        assertThat(lease).isNotNull();
        assertThat(lease.token()).isNotEqualTo(expired.getProcessingToken());
        processing.quiet(new CharacterCouncilProcessing.Lease(owner, day, expired.getProcessingToken()));
        assertThat(processing.status(owner, day).getStatus().getValue()).isEqualTo("PROCESSING");
    }

}
