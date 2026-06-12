package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service/repository-level tests for the T3 sport flows. Starts by pinning the new
 * sport_schedule_slot persistence shape (CHECKs, soft delete, owner+day ordering);
 * grows with SportService in Tasks 3–4.
 */
@Transactional
class SportServiceIT extends AbstractIntegrationTest {

    @Autowired private SportScheduleSlotRepository slotRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /** JPA-managed shared EntityManager — the one allowed exception to constructor injection. */
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testCreateScheduleSlot_shouldRoundTripAllFields_whenPersisted() {
        UUID user = databasePopulator.populateUser("sport@test.local");

        SportScheduleSlotEntity slot = trainPopulator.createScheduleSlot(user, 5, "10:00", 120, "match");
        entityManager.clear();

        SportScheduleSlotEntity reloaded = slotRepository.findById(slot.getId()).orElseThrow();
        assertThat(reloaded.getDayOfWeek()).isEqualTo(5);
        assertThat(reloaded.getTime()).isEqualTo("10:00");
        assertThat(reloaded.getDurationMin()).isEqualTo(120);
        assertThat(reloaded.getKind()).isEqualTo("match");
        assertThat(reloaded.getLocation()).isEqualTo("BVSC csarnok");
        assertThat(reloaded.getIntensityLabel()).isEqualTo("közepes");
        assertThat(reloaded.getCreatedBy()).isEqualTo(user);
    }

    @Test
    void testCreateScheduleSlot_shouldRejectRow_whenDayOfWeekOutOfRange() {
        UUID user = databasePopulator.populateUser("sport@test.local");
        assertThatThrownBy(() -> trainPopulator.createScheduleSlot(user, 7, "10:00", 90, "training"))
            .hasMessageContaining("ck_sport_schedule_slot_day_of_week");
    }

    @Test
    void testCreateScheduleSlot_shouldRejectRow_whenKindUnknown() {
        UUID user = databasePopulator.populateUser("sport@test.local");
        assertThatThrownBy(() -> trainPopulator.createScheduleSlot(user, 0, "18:15", 90, "race"))
            .hasMessageContaining("ck_sport_schedule_slot_kind");
    }

    @Test
    void testFinder_shouldScopeByOwnerAndHideSoftDeleted_whenQueried() {
        UUID a = databasePopulator.populateUser("sport-a@test.local");
        UUID b = databasePopulator.populateUser("sport-b@test.local");
        SportScheduleSlotEntity tue = trainPopulator.createScheduleSlot(a, 1, "17:00", 90, "training");
        SportScheduleSlotEntity mon = trainPopulator.createScheduleSlot(a, 0, "18:15", 90, "training");
        trainPopulator.createScheduleSlot(b, 0, "09:00", 60, "training");

        List<SportScheduleSlotEntity> slots =
            slotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(a);
        assertThat(slots).extracting(SportScheduleSlotEntity::getId)
            .containsExactly(mon.getId(), tue.getId());

        slotRepository.delete(tue); // @SQLDelete flips is_deleted
        entityManager.flush();
        entityManager.clear();
        assertThat(slotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(a))
            .extracting(SportScheduleSlotEntity::getId).containsExactly(mon.getId());
    }
}
