package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpEventEntity;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class LevelUpEventPopulator {

    private final LevelUpEventRepository repository;

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
}
