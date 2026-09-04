package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.entity.SportSlotSkipEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSlotSkipRepository;
import io.mrkuhne.mezo.feature.train.service.SportSlotSkipService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SportSlotSkipPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persistence IT for {@link SportSlotSkipEntity} (proactive coaching S5, mezo-d58h.5): the unique
 * index rejects a duplicate (user, slot identity, date), the DB CHECK rejects an out-of-range
 * {@code day_of_week}, and a soft-deleted skip stops matching through {@link SportSlotSkipService}
 * (not just the repository) — the {@code ChallengePersistenceIT} precedent for asserting a DB
 * constraint via {@code DataIntegrityViolationException}.
 */
@Transactional
class SportSlotSkipPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate DATE = LocalDate.parse("2026-09-11"); // a Friday

    @Autowired private SportSlotSkipPopulator populator;
    @Autowired private SportSlotSkipRepository repository;
    @Autowired private SportSlotSkipService service;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    @Test
    void testSave_shouldRoundTripSkip_whenPersisted() {
        UUID user = ownerId();
        SportSlotSkipEntity saved = populator.createSkip(user, 4, "18:00", DATE);

        SportSlotSkipEntity reloaded = repository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getCreatedBy()).isEqualTo(user);
        assertThat(reloaded.getDayOfWeek()).isEqualTo(4);
        assertThat(reloaded.getTime()).isEqualTo("18:00");
        assertThat(reloaded.getDate()).isEqualTo(DATE);
    }

    @Test
    void testSave_shouldRejectDuplicate_whenSameUserSlotIdentityAndDate() {
        UUID user = ownerId();
        populator.createSkip(user, 4, "18:00", DATE);

        SportSlotSkipEntity duplicate = new SportSlotSkipEntity();
        duplicate.setCreatedBy(user);
        duplicate.setDayOfWeek(4);
        duplicate.setTime("18:00");
        duplicate.setDate(DATE);

        assertThatThrownBy(() -> populator.save(duplicate))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testSave_shouldRejectRow_whenDayOfWeekOutsideRange() {
        UUID user = ownerId();

        SportSlotSkipEntity bad = new SportSlotSkipEntity();
        bad.setCreatedBy(user);
        bad.setDayOfWeek(7); // valid range is 0..6 — the DB CHECK is the guard, no entity @Max
        bad.setTime("18:00");
        bad.setDate(DATE);

        assertThatThrownBy(() -> populator.save(bad))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testIsSkipped_shouldReturnFalse_whenSkipWasSoftDeleted() {
        UUID user = ownerId();
        SportSlotSkipEntity skip = populator.createSkip(user, 4, "18:00", DATE);
        assertThat(service.isSkipped(user, 4, "18:00", DATE)).isTrue();

        populator.softDelete(skip);

        assertThat(service.isSkipped(user, 4, "18:00", DATE)).isFalse();
    }
}
