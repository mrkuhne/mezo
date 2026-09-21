package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.character.entity.CharacterCouncilEditionEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterCouncilEditionRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class CharacterCouncilPopulator {
    private final CharacterCouncilEditionRepository editions;

    public CharacterCouncilEditionEntity expiredEdition(UUID owner, LocalDate day) {
        var row = new CharacterCouncilEditionEntity();
        row.setCreatedBy(owner);
        row.setDay(day);
        row.setStatus("PROCESSING");
        row.setAttempts(1);
        row.setProcessingToken(UUID.randomUUID());
        row.setStartedAt(Instant.now().minusSeconds(7200));
        return editions.saveAndFlush(row);
    }
}
