package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.ReadinessChoiceEntity;
import io.mrkuhne.mezo.feature.train.entity.ReadinessChoiceEntity.Choice;
import io.mrkuhne.mezo.feature.train.repository.ReadinessChoiceRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the readiness-choice aggregate (Check-in 2.0, mezo-ck2). */
@TestComponent
@RequiredArgsConstructor
public class ReadinessChoicePopulator {

    private final ReadinessChoiceRepository repository;

    public ReadinessChoiceEntity createChoice(UUID owner, LocalDate date, Choice choice) {
        ReadinessChoiceEntity e = new ReadinessChoiceEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setChoice(choice);
        return repository.saveAndFlush(e);
    }
}
