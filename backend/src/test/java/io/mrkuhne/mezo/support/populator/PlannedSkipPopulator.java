package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Kind;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.repository.PlannedSkipRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for {@link PlannedSkipEntity} (Kihagyás S1, mezo-q4xt2.1) — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB constraints (the unique index, the target CHECK) fire.
 */
@TestComponent
@RequiredArgsConstructor
public class PlannedSkipPopulator {

    private final PlannedSkipRepository repository;

    public PlannedSkipEntity create(
        UUID createdBy, LocalDate date, Kind kind, Integer dayOfWeek, String time,
        String sessionKey, Reason reason) {
        PlannedSkipEntity s = new PlannedSkipEntity();
        s.setCreatedBy(createdBy);
        s.setDate(date);
        s.setKind(kind);
        s.setDayOfWeek(dayOfWeek);
        s.setTime(time);
        s.setSessionKey(sessionKey);
        s.setReasonCategory(reason);
        return repository.saveAndFlush(s);
    }

    /** Persist a hand-built (e.g. deliberately invalid) row — DB CHECK violation tests. */
    public PlannedSkipEntity save(PlannedSkipEntity entity) {
        return repository.saveAndFlush(entity);
    }

    /** Soft-delete a skip (repository {@code delete} → {@code @SQLDelete} flips is_deleted). */
    public void softDelete(PlannedSkipEntity entity) {
        repository.delete(entity);
        repository.flush();
    }
}
