package io.mrkuhne.mezo.feature.activity.service;

import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.companion.TodayActivitySource;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Activity side of the companion {@code get_daily_practice} tool's activity-log line — see
 * {@link TodayActivitySource}. Deliberately a plain repository read, NOT {@link ActivityService},
 * to keep the companion → activity dependency out of the graph entirely (a direct
 * {@code ActivityService} import from {@code companion.tools} would close a NEW slice cycle —
 * {@code ActivityService} itself already depends on {@code feature.quest}, which depends on
 * {@code feature.companion}).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ACTIVITY_SWITCH, havingValue = "true")
public class DailyActivityAdapter implements TodayActivitySource {

    private final ActivityLogRepository repository;

    @Override
    public List<ActivityLine> activitiesForDay(UUID createdBy, LocalDate date) {
        return repository.findByCreatedByAndOccurredOnOrderByCreatedAtDesc(createdBy, date).stream()
                .map(e -> new ActivityLine(e.getText(), e.getXpAwarded()))
                .toList();
    }

    @Override
    public Map<LocalDate, Integer> awardedXpByDay(UUID createdBy, LocalDate from, LocalDate to) {
        Map<LocalDate, Integer> xp = new HashMap<>();
        repository.findByCreatedByAndOccurredOnBetween(createdBy, from, to).forEach(e -> {
            if (e.getXpAwarded() != null && e.getXpAwarded() > 0) {
                xp.merge(e.getOccurredOn(), e.getXpAwarded(), Integer::sum);
            }
        });
        return xp;
    }
}
