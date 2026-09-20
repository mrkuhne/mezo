package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.DiagnosisResponse;
import io.mrkuhne.mezo.api.dto.ExperimentResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.proactive.config.DiagnosisProperties;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.DiagnosisRepository;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The diagnosis read/generate surface (mezo-hqfi.2, spec §3.5/§5). Reads are FREE — only
 * generation consumes the daily quota, so re-opening a report never costs anything.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class DiagnosisService {

    private static final List<String> OPEN_STATUSES =
            List.of(ExperimentEntity.STATUS_PROPOSED, ExperimentEntity.STATUS_ACTIVE);

    /** Weigh-in gate (mezo-85x5r): fewer distinct weigh-in days in the anchor window ⇒ 409. */
    private static final int MIN_WEIGHINS = 3;

    private final DiagnosisRepository diagnosisRepository;
    private final DiagnosisGenerator generator;
    private final LogFreshnessProbe logFreshnessProbe;
    private final DiagnosisProperties properties;
    private final ExperimentRepository experimentRepository;
    private final WeightLogRepository weightLogRepository;
    private final ProactiveMapper mapper;

    @Transactional(readOnly = true)
    public List<DiagnosisResponse> list(UUID userId, String phenomenon) {
        return diagnosisRepository
                .findByCreatedByAndPhenomenonOrderByGeneratedAtDesc(userId, phenomenon)
                .stream().map(entity -> withStale(userId, entity)).toList();
    }

    @Transactional(readOnly = true)
    public DiagnosisResponse get(UUID userId, UUID id) {
        DiagnosisEntity entity = diagnosisRepository
                .findByIdAndCreatedByAndDeletedFalse(id, userId)
                .orElseThrow(DiagnosisService::notFound);
        return withStale(userId, entity);
    }

    @Transactional
    public DiagnosisResponse generate(UUID userId, String phenomenon, LocalDate anchorStart) {
        LocalDate today = LocalDate.now();
        boolean isWeight = DiagnosisEntity.PHENOMENON_WEIGHT.equals(phenomenon);
        if (isWeight) {
            if (anchorStart == null || anchorStart.getDayOfWeek() != DayOfWeek.MONDAY) {
                throw new SystemRuntimeErrorException(
                        SystemMessage.error("DIAGNOSIS_ANCHOR_NOT_MONDAY").build(), HttpStatus.BAD_REQUEST);
            }
            // A FUTURE week has no weigh-ins by definition — 409 "too few weigh-ins" would be a
            // misleading answer (it implies the week could still clear the floor); 400 says
            // plainly that the request itself doesn't make sense yet.
            if (anchorStart.isAfter(today)) {
                throw new SystemRuntimeErrorException(
                        SystemMessage.error("DIAGNOSIS_ANCHOR_IN_FUTURE").build(), HttpStatus.BAD_REQUEST);
            }
        } else if (anchorStart != null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("DIAGNOSIS_ANCHOR_NOT_SUPPORTED").build(), HttpStatus.BAD_REQUEST);
        }

        if (isWeight) {
            // Reuse FIRST, before the weigh-in gate: opening an existing, still-valid report must
            // never 409, even if the live weigh-in count has since dropped below the floor (a
            // weigh-in edited/deleted after generation) — reads are free (spec §3.5).
            DiagnosisEntity existing = diagnosisRepository
                    .findFirstByCreatedByAndPhenomenonAndAnchorStartAndDeletedFalseOrderByGeneratedAtDesc(
                            userId, phenomenon, anchorStart)
                    .orElse(null);
            if (existing != null && !isStale(userId, existing)) {
                return withStale(userId, existing);
            }

            LocalDate windowTo = AnchoredWeek.windowTo(anchorStart, today);
            long weighInDays = weightLogRepository
                    .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscCreatedAtAsc(
                            userId, anchorStart, windowTo)
                    .stream().map(WeightLogEntity::getDate).distinct().count();
            if (weighInDays < MIN_WEIGHINS) {
                throw new SystemRuntimeErrorException(
                        SystemMessage.error("DIAGNOSIS_INSUFFICIENT_WEIGHINS").build(), HttpStatus.CONFLICT);
            }
        }

        Instant dayStart = today.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
        if (diagnosisRepository.countGeneratedOn(userId, dayStart, dayEnd) >= properties.maxPerDay()) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("DIAGNOSIS_QUOTA_EXCEEDED").build(), HttpStatus.TOO_MANY_REQUESTS);
        }
        DiagnosisEntity generated = generator.generate(userId, today, phenomenon, anchorStart);
        if (generated == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("DIAGNOSIS_INSUFFICIENT_DATA").build(), HttpStatus.CONFLICT);
        }
        return withStale(userId, generated);
    }

    /**
     * The tap IS the acceptance (spec §4): the row is created {@code active} starting today, not
     * routed through {@code proposed}. Idempotent per metric — an open experiment on the same
     * metric is returned as-is rather than duplicated.
     */
    @Transactional
    public ExperimentResponse startExperiment(UUID userId, UUID diagnosisId, int rank) {
        DiagnosisEntity diagnosis = diagnosisRepository
                .findByIdAndCreatedByAndDeletedFalse(diagnosisId, userId)
                .orElseThrow(DiagnosisService::notFound);
        DiagnosisSuspectsEnvelope.Suspect suspect = diagnosis.getSuspects().suspects().stream()
                .filter(s -> s.rank() == rank).findFirst()
                .orElseThrow(DiagnosisService::notFound);

        return experimentRepository
                .findFirstByCreatedByAndMetricKeyAndStatusInAndDeletedFalse(
                        userId, suspect.metricKey(), OPEN_STATUSES)
                .map(mapper::toExperimentResponse)
                .orElseGet(() -> {
                    ExperimentEntity experiment = new ExperimentEntity();
                    experiment.setCreatedBy(userId);
                    experiment.setTitle(suspect.title());
                    experiment.setHypothesis(suspect.probeText());
                    experiment.setStatus(ExperimentEntity.STATUS_ACTIVE);
                    experiment.setMetricKey(suspect.metricKey());
                    experiment.setExpectedDirection(suspect.expectedDirection());
                    experiment.setStartDate(LocalDate.now());
                    experiment.setTotalDays(suspect.totalDays());
                    experiment.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
                    experiment.setSource(ExperimentEntity.SOURCE_DIAGNOSIS);
                    experiment.setSourceDiagnosisId(diagnosis.getId());
                    return mapper.toExperimentResponse(experimentRepository.saveAndFlush(experiment));
                });
    }

    private DiagnosisResponse withStale(UUID userId, DiagnosisEntity entity) {
        DiagnosisResponse response = mapper.toDiagnosisResponse(entity);
        response.setStale(isStale(userId, entity));
        return response;
    }

    /** {@code true} when something landed in the entity's own window after it was generated —
     *  the anchor window for {@code weight}, the rolling {@code windowDays} window otherwise. */
    private boolean isStale(UUID userId, DiagnosisEntity entity) {
        LocalDate from;
        LocalDate to;
        if (entity.getAnchorStart() != null) {
            from = entity.getAnchorStart();
            to = AnchoredWeek.windowTo(from, LocalDate.now());
        } else {
            to = LocalDate.now();
            from = to.minusDays(entity.getWindowDays() - 1L);
        }
        return logFreshnessProbe.anyLoggedAfter(userId, from, to, entity.getGeneratedAt());
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
