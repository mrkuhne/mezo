package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code companion_message} rows (companion-feed). */
@TestComponent
@RequiredArgsConstructor
public class CompanionMessagePopulator {

    private final CompanionMessageRepository companionMessageRepository;

    public CompanionMessageEntity createMessage(
            UUID owner, LocalDate date, String kind, String eyebrow, List<String> body) {
        CompanionMessageEntity entity = new CompanionMessageEntity();
        entity.setCreatedBy(owner);
        entity.setMessageDate(date);
        entity.setKind(kind);
        entity.setContent(new CompanionMessageEnvelope(eyebrow, body, List.of()));
        entity.setGeneratedAt(Instant.now());
        return companionMessageRepository.saveAndFlush(entity);
    }
}
