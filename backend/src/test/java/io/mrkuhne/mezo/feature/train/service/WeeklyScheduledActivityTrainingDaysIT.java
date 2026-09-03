package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Slice 3: the distinct scheduled training weekdays (gym ∪ sport) that size the day-type split. */
@Transactional
class WeeklyScheduledActivityTrainingDaysIT extends AbstractIntegrationTest {

    @Autowired private WeeklyScheduledActivityService service;
    @Autowired private GymScheduleSlotRepository gymRepo;
    @Autowired private SportScheduleSlotRepository sportRepo;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void unionsGymAndSportWeekdaysDistinct() {
        UUID owner = databasePopulator.populateUser("weekly-training-days@test.local");
        gymSlot(owner, 0, "17:30");           // Mon
        gymSlot(owner, 3, "17:30");           // Thu
        sportSlot(owner, 3, "19:00", 90);     // Thu again — must not double-count
        sportSlot(owner, 5, "10:00", 120);    // Sat

        assertThat(service.scheduledTrainingDayOfWeeks(owner)).containsExactlyInAnyOrder(0, 3, 5);
    }

    @Test
    void emptyScheduleYieldsEmptySet() {
        UUID owner = databasePopulator.populateUser("weekly-training-days-empty@test.local");
        assertThat(service.scheduledTrainingDayOfWeeks(owner)).isEmpty();
    }

    private void gymSlot(UUID owner, int dow, String time) {
        GymScheduleSlotEntity g = new GymScheduleSlotEntity();
        g.setCreatedBy(owner);
        g.setDayOfWeek(dow);
        g.setTime(time);
        gymRepo.save(g);
    }

    private void sportSlot(UUID owner, int dow, String time, int durationMin) {
        SportScheduleSlotEntity s = new SportScheduleSlotEntity();
        s.setCreatedBy(owner);
        s.setDayOfWeek(dow);
        s.setTime(time);
        s.setDurationMin(durationMin);
        s.setKind("training");
        s.setSport("volleyball");
        sportRepo.save(s);
    }
}
