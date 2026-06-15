package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the gym-schedule aggregate (one recurring weekly time slot) — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB constraints fire.
 */
@TestComponent
@RequiredArgsConstructor
public class GymSchedulePopulator {

    private final GymScheduleSlotRepository repository;

    public GymScheduleSlotEntity createSlot(UUID createdBy, int dayOfWeek, String time) {
        GymScheduleSlotEntity e = new GymScheduleSlotEntity();
        e.setCreatedBy(createdBy);
        e.setDayOfWeek(dayOfWeek);
        e.setTime(time);
        return repository.saveAndFlush(e);
    }
}
