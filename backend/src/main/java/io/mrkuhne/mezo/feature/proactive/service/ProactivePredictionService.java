package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.PredictionResponse;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The prediction read path (P1): all live predictions, newest window first. Lazily generates the
 * CURRENT week's batch when that week has no rows yet (the weekly-suggestion idiom — needs
 * CONFIRMED patterns). An empty list is the honest empty state — never a 404 (a list endpoint).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactivePredictionService {

    private final PredictionRepository predictionRepository;
    private final PredictionGenerator generator;
    private final ProactiveMapper mapper;

    @Transactional
    public List<PredictionResponse> getPredictions(UUID userId) {
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        if (!predictionRepository.existsByCreatedByAndWeekStart(userId, weekStart)) {
            generator.generate(userId, weekStart);   // lazy current-week batch; empty = honest
        }
        return predictionRepository.findByCreatedByOrderByValidFromDescGeneratedAtDesc(userId)
                .stream().map(mapper::toPredictionResponse).toList();
    }
}
