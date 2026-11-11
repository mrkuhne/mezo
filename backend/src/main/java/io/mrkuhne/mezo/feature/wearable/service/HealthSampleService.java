package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.api.dto.HealthSampleIn;
import io.mrkuhne.mezo.api.dto.IngestResult;
import io.mrkuhne.mezo.feature.biometrics.weight.service.HealthWeightService;
import io.mrkuhne.mezo.feature.biometrics.weight.service.HealthWeightService.HealthWeighIn;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightLogSavedEvent;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.repository.HealthSampleRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Apple Health samples → {@code health_sample}, keyed by the client's external id (Boop B1, mezo-r36n9.11).
 * A re-sent id updates its row and revives it if it was deleted. {@code body_mass} samples ALSO land in
 * {@code weight_log} through {@link HealthWeightService} (one recompute/event per batch, recent only).
 */
@Service
@RequiredArgsConstructor
public class HealthSampleService {

    private static final String BODY_MASS = "body_mass";
    /** weight_log.weight_kg is numeric(5,2); anything outside this is a bad sample, kept in health_sample only. */
    private static final double MIN_WEIGHT_KG = 20;
    private static final double MAX_WEIGHT_KG = 400;

    private final HealthSampleRepository repository;
    private final HealthWeightService weightService;
    private final GoalEngineService goalEngineService;
    private final ApplicationEventPublisher eventPublisher;
    private final WearableProperties properties;
    private final ObjectMapper objectMapper;

    @Transactional
    public IngestResult ingest(UUID createdBy, List<HealthSampleIn> samples, LocalDate today) {
        WearableBatches.requireAtMost(samples.size(), properties.maxSamples());
        for (HealthSampleIn s : samples) {
            if (s.getEnd().isBefore(s.getStart())) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.error("WEARABLE_SAMPLE_END_BEFORE_START").build(), HttpStatus.BAD_REQUEST);
            }
        }
        ZoneId zone = ZoneId.of(properties.zone());
        Set<String> existing = new HashSet<>(
            repository.findExistingExternalIds(createdBy, samples.stream().map(HealthSampleIn::getExternalId).toList()));
        Set<String> seen = new HashSet<>();
        List<HealthWeighIn> weighIns = new ArrayList<>();
        int inserted = 0;
        for (HealthSampleIn s : samples) {
            repository.upsert(createdBy, s.getExternalId(), s.getMetric().getValue(), s.getStart().toInstant(),
                s.getEnd().toInstant(), s.getValue(), s.getUnit(), s.getSourceName(), s.getSourceBundle(),
                s.getDevice(), Boolean.TRUE.equals(s.getUserEntered()),
                s.getMeta() == null ? null : objectMapper.writeValueAsString(s.getMeta()));
            if (!existing.contains(s.getExternalId()) && seen.add(s.getExternalId())) {
                inserted++;
            }
            if (BODY_MASS.equals(s.getMetric().getValue()) && plausibleWeightKg(s.getValue())) {
                weighIns.add(new HealthWeighIn(s.getExternalId(),
                    s.getStart().atZoneSameInstant(zone).toLocalDate(), s.getValue()));
            }
        }
        // A backfill must not flood: one recompute + one companion event per batch, only for a new recent weigh-in.
        weightService.upsert(createdBy, weighIns, today).ifPresent(newest -> {
            goalEngineService.recomputeActiveGoal(createdBy);
            eventPublisher.publishEvent(new WeightLogSavedEvent(createdBy, newest));
        });
        return new IngestResult(inserted, samples.size() - inserted);
    }

    private static boolean plausibleWeightKg(Double kg) {
        return kg != null && kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG;
    }
}
