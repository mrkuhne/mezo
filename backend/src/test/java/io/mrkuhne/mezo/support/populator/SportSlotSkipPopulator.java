package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.SportSlotSkipEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSlotSkipRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for {@link SportSlotSkipEntity} (proactive coaching S5, mezo-d58h.5) — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB constraints (the unique index, the day_of_week CHECK) fire.
 */
@TestComponent
@RequiredArgsConstructor
public class SportSlotSkipPopulator {

    private final SportSlotSkipRepository repository;

    public SportSlotSkipEntity createSkip(UUID createdBy, int dayOfWeek, String time, LocalDate date) {
        SportSlotSkipEntity s = new SportSlotSkipEntity();
        s.setCreatedBy(createdBy);
        s.setDayOfWeek(dayOfWeek);
        s.setTime(time);
        s.setDate(date);
        return repository.saveAndFlush(s);
    }

    /** Persist a hand-built (e.g. deliberately out-of-range) row — DB CHECK violation tests. */
    public SportSlotSkipEntity save(SportSlotSkipEntity entity) {
        return repository.saveAndFlush(entity);
    }

    /** Soft-delete a skip (repository {@code delete} → {@code @SQLDelete} flips is_deleted). */
    public void softDelete(SportSlotSkipEntity entity) {
        repository.delete(entity);
        repository.flush();
    }
}
