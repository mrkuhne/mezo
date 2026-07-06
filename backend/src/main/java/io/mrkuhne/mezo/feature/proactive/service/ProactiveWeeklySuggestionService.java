package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The weekly-suggestion read path: persisted row or lazy generation; honest 404 otherwise. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveWeeklySuggestionService {

    private final WeeklySuggestionRepository weeklySuggestionRepository;
    private final WeeklySuggestionGenerator generator;
    private final ProactiveMapper mapper;

    /** date = null ⇒ server today; the week identity is the ISO Monday of that day. */
    @Transactional
    public WeeklySuggestionResponse getWeeklySuggestion(UUID userId, LocalDate date) {
        LocalDate weekStart = (date != null ? date : LocalDate.now())
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        WeeklySuggestionEntity suggestion = weeklySuggestionRepository
                .findByCreatedByAndWeekStart(userId, weekStart)
                .orElseGet(() -> generator.generate(userId, weekStart));
        if (suggestion == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        return mapper.toWeeklySuggestionResponse(suggestion);
    }
}
