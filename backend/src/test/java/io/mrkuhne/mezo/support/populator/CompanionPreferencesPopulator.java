package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.CompanionPreferencesEntity;
import io.mrkuhne.mezo.feature.companion.repository.CompanionPreferencesRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class CompanionPreferencesPopulator {
    private final CompanionPreferencesRepository repository;

    public CompanionPreferencesEntity preferences(UUID owner, String about, String instructions, boolean learned) {
        var entity = new CompanionPreferencesEntity();
        entity.setCreatedBy(owner);
        entity.setAboutMe(about);
        entity.setCustomInstructions(instructions);
        entity.setUseLearnedProfile(learned);
        return repository.saveAndFlush(entity);
    }
}
