package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.habit.HabitCatalog;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class HabitPopulator {

    private final HabitDayRepository repository;
    private final HabitCatalog catalog;

    /** All catalog habits as pending rows for the given date. */
    public List<HabitDayEntity> pendingDay(UUID owner, LocalDate date) {
        return catalog.all().stream().map(def -> {
            HabitDayEntity e = new HabitDayEntity();
            e.setCreatedBy(owner);
            e.setHabitDate(date);
            e.setHabitKey(def.key());
            return repository.saveAndFlush(e);
        }).toList();
    }

    public HabitDayEntity row(UUID owner, LocalDate date, String key, String status) {
        HabitDayEntity e = new HabitDayEntity();
        e.setCreatedBy(owner);
        e.setHabitDate(date);
        e.setHabitKey(key);
        e.setStatus(status);
        return repository.saveAndFlush(e);
    }
}
