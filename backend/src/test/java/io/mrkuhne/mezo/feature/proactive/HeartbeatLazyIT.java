package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.HeartbeatNoteResponse;
import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveHeartbeatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lazy-path semantics with deterministic "elapsed" windows: the midnight crons mean BOTH
 * windows have always fired for today (except the midnight minute itself — an accepted
 * micro-flake window the suite never runs in).
 */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.proactive.heartbeat.midday-cron=0 0 0 * * *",
        "mezo.proactive.heartbeat.evening-cron=0 1 0 * * *"})
class HeartbeatLazyIT extends AbstractIntegrationTest {

    @Autowired
    private ProactiveHeartbeatService service;

    @Autowired
    private HeartbeatNoteRepository repository;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private DailySummaryPopulator dailySummaryPopulator;

    @Test
    void testGetHeartbeat_shouldLazyGenerateLatestElapsedWindow_whenTodayHasNoNote() {
        UUID user = userPopulator.createUser("hbl-lazy@test.local").getId();
        dailySummaryPopulator.summary(user, LocalDate.now().minusDays(1));
        HeartbeatNoteResponse response = service.getHeartbeat(user, null);
        assertThat(response.getWindow()).isEqualTo(HeartbeatNoteEntity.WINDOW_EVENING);
        assertThat(repository.findByCreatedByAndNoteDateAndWindowKey(
                user, LocalDate.now(), HeartbeatNoteEntity.WINDOW_EVENING)).isPresent();
    }

    @Test
    void testGetHeartbeat_shouldThrow404_whenNoMemoryAndNothingPersisted() {
        UUID user = userPopulator.createUser("hbl-404@test.local").getId();
        assertThatThrownBy(() -> service.getHeartbeat(user, null))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
