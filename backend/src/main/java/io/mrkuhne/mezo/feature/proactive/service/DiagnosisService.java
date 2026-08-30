package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.DiagnosisResponse;
import io.mrkuhne.mezo.feature.proactive.config.DiagnosisProperties;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.DiagnosisRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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

    private final DiagnosisRepository diagnosisRepository;
    private final DiagnosisGenerator generator;
    private final LogFreshnessProbe logFreshnessProbe;
    private final DiagnosisProperties properties;
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
    public DiagnosisResponse generate(UUID userId, String phenomenon) {
        LocalDate today = LocalDate.now();
        Instant dayStart = today.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
        if (diagnosisRepository.countGeneratedOn(userId, dayStart, dayEnd) >= properties.maxPerDay()) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("DIAGNOSIS_QUOTA_EXCEEDED").build(), HttpStatus.TOO_MANY_REQUESTS);
        }
        DiagnosisEntity generated = generator.generate(userId, today);
        if (generated == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("DIAGNOSIS_INSUFFICIENT_DATA").build(), HttpStatus.CONFLICT);
        }
        return withStale(userId, generated);
    }

    private DiagnosisResponse withStale(UUID userId, DiagnosisEntity entity) {
        DiagnosisResponse response = mapper.toDiagnosisResponse(entity);
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(entity.getWindowDays() - 1L);
        response.setStale(logFreshnessProbe.anyLoggedAfter(userId, from, to, entity.getGeneratedAt()));
        return response;
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
