package io.mrkuhne.mezo.feature.progression.sport;

import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import java.math.RoundingMode;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Resolves a just-saved sport_session row into a {@link SportSignal} of raw metrics (no XP math).
 * The lookup is ownership-scoped — {@code createdBy} is part of the query, not a passenger param.
 */
@Component
@RequiredArgsConstructor
public class SportSignalCalculator {

    private final SportSessionRepository sportSessionRepository;

    public SportSignal compute(UUID createdBy, UUID sessionId) {
        SportSessionEntity s = sportSessionRepository.findByIdAndCreatedBy(sessionId, createdBy)
            .orElseThrow(() -> new IllegalStateException(
                "sport_session not found for owner: " + sessionId));
        Integer rpe = s.getRpe() == null ? null
            : s.getRpe().setScale(0, RoundingMode.HALF_UP).intValue();
        return new SportSignal(s.getId(), s.getSport(), s.getDurationMin(),
            s.getSetsPlayed(), s.getRounds(), rpe);
    }
}
