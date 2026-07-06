package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code weekly_suggestion} rows (proactive W1). */
@TestComponent
@RequiredArgsConstructor
public class WeeklySuggestionPopulator {

    private final WeeklySuggestionRepository weeklySuggestionRepository;

    public WeeklySuggestionEntity suggestion(UUID createdBy, LocalDate weekStart) {
        WeeklySuggestionEntity entity = new WeeklySuggestionEntity();
        entity.setCreatedBy(createdBy);
        entity.setWeekStart(weekStart);
        entity.setProse("Heti tervjavaslat teszt.");
        entity.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return weeklySuggestionRepository.saveAndFlush(entity);
    }
}
