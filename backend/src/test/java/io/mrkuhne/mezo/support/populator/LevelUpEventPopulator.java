package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpEventEntity;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.jdbc.core.JdbcTemplate;

@TestComponent
@RequiredArgsConstructor
public class LevelUpEventPopulator {

    private final LevelUpEventRepository repository;
    private final JdbcTemplate jdbcTemplate;

    public LevelUpEventEntity createEvent(UUID createdBy, String sourceType, UUID sourceRefId,
        LevelUpResult payload) {
        LevelUpEventEntity e = new LevelUpEventEntity();
        e.setCreatedBy(createdBy);
        e.setSourceType(sourceType);
        e.setSourceRefId(sourceRefId);
        e.setTotalXp(payload.totalXp());
        e.setPayload(payload);
        return repository.saveAndFlush(e);
    }

    /** Back-dated event for trait/streak tests — @CreationTimestamp forbids setting occurredAt on insert. */
    public LevelUpEventEntity createEventAt(UUID createdBy, String sourceType, UUID sourceRefId,
        LevelUpResult payload, java.time.Instant occurredAt) {
        LevelUpEventEntity e = createEvent(createdBy, sourceType, sourceRefId, payload);
        jdbcTemplate.update("update level_up_event set occurred_at = ? where id = ?",
            java.sql.Timestamp.from(occurredAt), e.getId());
        return e;
    }
}
