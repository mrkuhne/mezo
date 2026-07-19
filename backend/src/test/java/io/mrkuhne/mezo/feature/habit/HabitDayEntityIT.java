package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** habit_day DDL + partial-unique identity + soft delete round-trip (mezo-d1jb). */
class HabitDayEntityIT extends AbstractIntegrationTest {

    @Autowired private UserPopulator userPopulator;
    @Autowired private HabitDayRepository repository;

    @Test
    void testSave_shouldRoundTripAndSoftDelete_whenPersisted() {
        UUID owner = userPopulator.createUser("habit-a@test.hu").getId();
        HabitDayEntity e = new HabitDayEntity();
        e.setCreatedBy(owner);
        e.setHabitDate(LocalDate.now());
        e.setHabitKey("morning_sunlight");
        repository.saveAndFlush(e);

        var found = repository.findByCreatedByAndHabitDate(owner, LocalDate.now());
        assertThat(found).hasSize(1);
        assertThat(found.getFirst().getStatus()).isEqualTo(HabitDayEntity.STATUS_PENDING);
        assertThat(found.getFirst().getXpAwarded()).isZero();

        repository.delete(found.getFirst());
        repository.flush();
        assertThat(repository.findByCreatedByAndHabitDate(owner, LocalDate.now())).isEmpty();
    }
}
