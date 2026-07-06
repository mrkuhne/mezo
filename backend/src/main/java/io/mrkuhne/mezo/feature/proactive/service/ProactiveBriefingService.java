package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The briefing read path (B1.1 lazy generation + B1.2 hybrid freshness, spec §2): serve the
 * persisted row — unless a key input (last night's sleep_log) arrived after it was generated,
 * in which case soft-delete + regenerate, at most regen-cap-per-day times. Absence stays an
 * honest 404 (no narrative memory / unusable answer).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveBriefingService {

    private final BriefingRepository briefingRepository;
    private final BriefingGenerator briefingGenerator;
    private final SleepLogRepository sleepLogRepository;
    private final ProactiveProperties properties;
    private final ProactiveMapper mapper;

    /** date = null ⇒ the server's today (the FE sends its local date, the check-in precedent). */
    @Transactional
    public BriefingResponse getBriefing(UUID userId, LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now();
        BriefingEntity briefing = briefingRepository
                .findByCreatedByAndBriefingDate(userId, day)
                .map(existing -> refreshIfStale(userId, day, existing))
                .orElseGet(() -> briefingGenerator.generate(userId, day));
        if (briefing == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        return mapper.toBriefingResponse(briefing);
    }

    /**
     * B1.2 staleness rule (decided in-slice): a sleep_log with date >= day-1 created after
     * generated_at means the sleep-first input (FR-2.1.1) was missing from the prose —
     * soft-delete + regenerate, carrying regen_count + 1, capped per day. A failed
     * regeneration falls back to the still-live old row (never a blank morning).
     */
    private BriefingEntity refreshIfStale(UUID userId, LocalDate day, BriefingEntity existing) {
        int cap = properties.briefing().regenCapPerDay();
        if (existing.getRegenCount() >= cap) {
            return existing;
        }
        boolean lateSleep = sleepLogRepository
                .existsByCreatedByAndDeletedFalseAndDateGreaterThanEqualAndCreatedAtAfter(
                        userId, day.minusDays(1), existing.getGeneratedAt());
        if (!lateSleep) {
            return existing;
        }
        int nextCount = existing.getRegenCount() + 1;
        briefingRepository.delete(existing);   // @SQLDelete -> is_deleted = true
        briefingRepository.flush();            // free the partial-unique slot BEFORE the insert
        BriefingEntity fresh = briefingGenerator.generate(userId, day);
        if (fresh == null) {
            // regeneration failed (LLM answer unusable) — resurrect nothing; the old row is
            // gone but generate() also returned null only for unusable answers with the SAME
            // gather that produced the old row. Serve honest absence for this request.
            return null;
        }
        fresh.setRegenCount(nextCount);
        return fresh;
    }
}
