package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.HeartbeatNotePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class HeartbeatPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 7, 7);

    @Autowired
    private HeartbeatNoteRepository repository;

    @Autowired
    private HeartbeatNotePopulator populator;

    @Autowired
    private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTrip_whenNotePersisted() {
        UUID user = userPopulator.createUser("hb-rt@test.local").getId();
        populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        HeartbeatNoteEntity found = repository
                .findByCreatedByAndNoteDateAndWindowKey(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY)
                .orElseThrow();
        assertThat(found.getKind()).isEqualTo(HeartbeatNoteEntity.KIND_NUDGE);
        assertThat(found.getContent()).isNotBlank();
    }

    @Test
    void testSave_shouldRejectSecondLiveRow_whenSameUserDayWindow() {
        UUID user = userPopulator.createUser("hb-uq@test.local").getId();
        populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        // a DIFFERENT window on the same day is allowed
        populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_EVENING);
        assertThatThrownBy(() -> populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testFindLatest_shouldReturnOwnNewestNote_whenTwoWindowsExist() {
        UUID user = userPopulator.createUser("hb-own@test.local").getId();
        UUID other = userPopulator.createUser("hb-other@test.local").getId();
        HeartbeatNoteEntity midday = populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        midday.setGeneratedAt(Instant.now().minusSeconds(3600).truncatedTo(ChronoUnit.MICROS));
        repository.saveAndFlush(midday);
        HeartbeatNoteEntity evening = populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_EVENING);
        populator.note(other, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        assertThat(repository.findFirstByCreatedByAndNoteDateOrderByGeneratedAtDesc(user, DAY))
                .hasValueSatisfying(n -> assertThat(n.getId()).isEqualTo(evening.getId()));
    }
}
