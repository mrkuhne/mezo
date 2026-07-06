package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.MemoirResponse;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
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

/**
 * The memoir read path: the latest persisted row; else lazily generate the LAST COMPLETED week
 * (the ISO-Monday of the previous week). Still-empty (no narrative memory) ⇒ honest 404.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveMemoirService {

    private final MemoirRepository memoirRepository;
    private final MemoirGenerator generator;
    private final ProactiveMapper mapper;

    @Transactional
    public MemoirResponse getMemoir(UUID userId) {
        MemoirEntity memoir = memoirRepository
                .findFirstByCreatedByOrderByWeekStartDesc(userId)
                .orElseGet(() -> generator.generate(userId, LocalDate.now()
                        .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1)));
        if (memoir == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        return mapper.toMemoirResponse(memoir);
    }
}
