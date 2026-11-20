package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.config.SeasonProperties;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.train.port.SeasonGatePort;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * {@link SeasonGatePort} — train asks, the season answers (spec §5.12-5): a block may start when a season is active,
 * or a planned one starts within {@code plannedLeadDays} (7) of the block's start. Behind
 * {@code mezo.season.mesocycle-gate.enabled}.
 */
@Component
@RequiredArgsConstructor
public class SeasonGateAdapter implements SeasonGatePort {

    private final SeasonRepository seasonRepository;
    private final SeasonProperties properties;

    @Override
    public boolean allowsMesocycleStart(UUID owner, LocalDate start) {
        if (!properties.mesocycleGate().enabled() || seasonRepository.findActive(owner).isPresent()) {
            return true;
        }
        LocalDate latest = start.plusDays(properties.mesocycleGate().plannedLeadDays());
        return seasonRepository.findByCreatedByAndStatus(owner, SeasonEntity.STATUS_PLANNED).stream()
            .anyMatch(s -> !s.getStartDate().isAfter(latest) && !s.endDate().isBefore(start));
    }
}
