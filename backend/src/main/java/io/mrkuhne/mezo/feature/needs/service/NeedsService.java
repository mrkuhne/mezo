package io.mrkuhne.mezo.feature.needs.service;

import io.mrkuhne.mezo.api.dto.NeedsCloseRequest;
import io.mrkuhne.mezo.api.dto.NeedsCloseResponse;
import io.mrkuhne.mezo.api.dto.NeedsRings;
import io.mrkuhne.mezo.api.dto.NeedsSummaryResponse;
import io.mrkuhne.mezo.feature.needs.config.NeedsProperties;
import io.mrkuhne.mezo.feature.needs.entity.NeedsDayEntity;
import io.mrkuhne.mezo.feature.needs.mapper.NeedsMapper;
import io.mrkuhne.mezo.feature.needs.repository.NeedsDayRepository;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.needs.NeedsSignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Napi Életjel-ring zárás (mezo-dhzk): one row per user+date, idempotent per date, awarding
 * per-ring + all-green bonus XP onto the recovery LIFE skill through the shared progression
 * tail, and rolling a same-user all-green streak forward/reset. Gated {@code NEEDS_SWITCH}.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NEEDS_SWITCH, havingValue = "true")
public class NeedsService {

    private final NeedsDayRepository repository;
    private final NeedsMapper mapper;
    private final NeedsProperties props;
    private final ObjectProvider<ProgressionGate> progressionGate;
    private final ProgressionService progressionService;

    @Transactional
    public NeedsCloseResponse close(UUID userId, NeedsCloseRequest req) {
        if (!req.getDate().equals(LocalDate.now())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("NEEDS_NOT_TODAY").build(), HttpStatus.CONFLICT);
        }

        return repository.findByCreatedByAndNeedsDateAndDeletedFalse(userId, req.getDate())
            .map(mapper::toCloseResponse)
            .orElseGet(() -> closeNew(userId, req));
    }

    @Transactional(readOnly = true)
    public NeedsSummaryResponse summary(UUID userId) {
        return mapper.toSummaryResponse(
            repository.findFirstByCreatedByAndDeletedFalseOrderByNeedsDateDesc(userId).orElse(null));
    }

    private NeedsCloseResponse closeNew(UUID userId, NeedsCloseRequest req) {
        NeedsRings rings = req.getRings();
        int[] values = {rings.getEnergia(), rings.getHidratacio(), rings.getPihenes(),
            rings.getMozgas(), rings.getLelek(), rings.getRend()};
        int greenCount = 0;
        for (int v : values) {
            if (v >= props.greenThreshold()) {
                greenCount++;
            }
        }
        boolean allGreen = greenCount == 6;
        int xp = greenCount * props.perRingXp() + (allGreen ? props.allGreenBonusXp() : 0);

        var prev = repository.findByCreatedByAndNeedsDateAndDeletedFalse(userId, req.getDate().minusDays(1));
        int streakDays = allGreen
            ? prev.filter(NeedsDayEntity::isAllGreen).map(p -> p.getStreakDays() + 1).orElse(1)
            : 0;

        NeedsDayEntity row = new NeedsDayEntity();
        row.setCreatedBy(userId);
        row.setNeedsDate(req.getDate());
        row.setEnergia(values[0]);
        row.setHidratacio(values[1]);
        row.setPihenes(values[2]);
        row.setMozgas(values[3]);
        row.setLelek(values[4]);
        row.setRend(values[5]);
        row.setGreenCount(greenCount);
        row.setAllGreen(allGreen);
        row.setXpAwarded(xp);
        row.setStreakDays(streakDays);
        row = repository.saveAndFlush(row);

        if (xp > 0 && progressionGate.getIfAvailable() != null) {
            progressionService.applyNeeds(userId,
                new NeedsSignal(row.getId(), xp, "Életjelek — életben tartva", req.getDate()));
        }

        return mapper.toCloseResponse(row);
    }
}
