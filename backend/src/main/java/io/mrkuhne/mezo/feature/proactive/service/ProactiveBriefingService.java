package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.BriefingResponse;
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

/** The briefing read path (B1.1): persisted row, or lazy generation (hybrid model, spec §2). */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveBriefingService {

    private final BriefingRepository briefingRepository;
    private final BriefingGenerator briefingGenerator;
    private final ProactiveMapper mapper;

    /** date = null ⇒ the server's today (the FE sends its local date, the check-in precedent). */
    @Transactional
    public BriefingResponse getBriefing(UUID userId, LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now();
        BriefingEntity briefing = briefingRepository
                .findByCreatedByAndBriefingDate(userId, day)
                .orElseGet(() -> briefingGenerator.generate(userId, day));
        if (briefing == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        return mapper.toBriefingResponse(briefing);
    }
}
