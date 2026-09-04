package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.entity.WorkoutDayAdjustmentEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutDayAdjustmentRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WorkoutDayAdjustmentPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persistence IT for {@link WorkoutDayAdjustmentEntity} (proactive coaching S5, mezo-d58h.5): the
 * unique index rejects a duplicate (user, date), the DB CHECK rejects an out-of-range
 * {@code set_delta}, and a soft-deleted adjustment stops matching through the repository finder —
 * see {@code SportSlotSkipPersistenceIT} precedent.
 */
@Transactional
class WorkoutDayAdjustmentPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate DATE = LocalDate.parse("2026-09-12"); // a Saturday

    @Autowired private WorkoutDayAdjustmentPopulator populator;
    @Autowired private WorkoutDayAdjustmentRepository repository;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    @Test
    void testSave_shouldRoundTripAdjustment_whenPersisted() {
        UUID user = ownerId();
        WorkoutDayAdjustmentEntity saved = populator.createAdjustment(user, DATE, (short) -2);

        WorkoutDayAdjustmentEntity reloaded = repository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getCreatedBy()).isEqualTo(user);
        assertThat(reloaded.getDate()).isEqualTo(DATE);
        assertThat(reloaded.getSetDelta()).isEqualTo((short) -2);
    }

    @Test
    void testSave_shouldRejectDuplicate_whenSameUserAndDate() {
        UUID user = ownerId();
        populator.createAdjustment(user, DATE, (short) -2);

        WorkoutDayAdjustmentEntity duplicate = new WorkoutDayAdjustmentEntity();
        duplicate.setCreatedBy(user);
        duplicate.setDate(DATE);
        duplicate.setSetDelta((short) -1);

        assertThatThrownBy(() -> repository.saveAndFlush(duplicate))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testSave_shouldRejectRow_whenSetDeltaAboveZero() {
        UUID user = ownerId();

        // Use rawInsert to bypass bean validation and hit the DB CHECK directly
        // (may throw ConstraintViolationException via Hibernate or wrapped in DataIntegrityViolationException)
        assertThatThrownBy(() -> populator.rawInsert(user, DATE, (short) 1))
            .isInstanceOf(Exception.class)
            .hasMessageContaining("ck_workout_day_adjustment_set_delta");
    }

    @Test
    void testSave_shouldRejectRow_whenSetDeltaBelowNegativeThree() {
        UUID user = ownerId();
        LocalDate otherDate = DATE.plusDays(1);

        // Use rawInsert to bypass bean validation and hit the DB CHECK directly
        // (may throw ConstraintViolationException via Hibernate or wrapped in DataIntegrityViolationException)
        assertThatThrownBy(() -> populator.rawInsert(user, otherDate, (short) -4))
            .isInstanceOf(Exception.class)
            .hasMessageContaining("ck_workout_day_adjustment_set_delta");
    }

    @Test
    void testFindByCreatedByAndDate_shouldReturnEmpty_whenAdjustmentWasSoftDeleted() {
        UUID user = ownerId();
        WorkoutDayAdjustmentEntity adjustment = populator.createAdjustment(user, DATE, (short) -2);
        assertThat(repository.findByCreatedByAndDateAndDeletedFalse(user, DATE))
            .isPresent()
            .contains(adjustment);

        populator.softDelete(adjustment);

        assertThat(repository.findByCreatedByAndDateAndDeletedFalse(user, DATE)).isEmpty();
    }

    @Test
    void testSave_shouldAllowNewRow_whenPreviousAdjustmentWasSoftDeletedForSameDateAndUser() {
        UUID user = ownerId();

        // Create first adjustment and soft-delete it
        WorkoutDayAdjustmentEntity first = populator.createAdjustment(user, DATE, (short) -2);
        populator.softDelete(first);

        // Create new adjustment for same (user, date) — should succeed because unique index
        // filters on is_deleted = false, so the deleted row does not block the insert
        WorkoutDayAdjustmentEntity second = populator.createAdjustment(user, DATE, (short) -1);

        assertThat(repository.findByCreatedByAndDateAndDeletedFalse(user, DATE))
            .isPresent()
            .contains(second);
        assertThat(second.getSetDelta()).isEqualTo((short) -1);
    }
}
