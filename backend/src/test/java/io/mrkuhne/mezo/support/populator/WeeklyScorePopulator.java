package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.WeeklyScoreEntity;
import io.mrkuhne.mezo.feature.companion.repository.WeeklyScoreRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code weekly_score} rows (companion, mezo-d20.7.5). */
@TestComponent
@RequiredArgsConstructor
public class WeeklyScorePopulator {

    private final WeeklyScoreRepository weeklyScoreRepository;

    /** A cached weekly score stamped {@code computedAt} — pass a past instant to fake a stale row. */
    public WeeklyScoreEntity weeklyScore(UUID createdBy, LocalDate weekStart, int score, Instant computedAt) {
        WeeklyScoreEntity entity = new WeeklyScoreEntity();
        entity.setCreatedBy(createdBy);
        entity.setWeekStart(weekStart);
        entity.setScore(score);
        entity.setSleepAvg(BigDecimal.valueOf(score).setScale(2));
        entity.setComputedAt(computedAt.truncatedTo(ChronoUnit.MICROS));
        return weeklyScoreRepository.saveAndFlush(entity);
    }

    public Optional<WeeklyScoreEntity> find(UUID createdBy, LocalDate weekStart) {
        return weeklyScoreRepository.findByCreatedByAndWeekStart(createdBy, weekStart);
    }
}
